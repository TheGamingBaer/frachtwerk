// Frachtwerk-Agent: liest die Telemetrie (Funbit), erkennt Touren und meldet sie an den Server.
// Wird vom Skript-Client (frachtwerk-client.js) und von der Desktop-App (Frachtwerk.exe) genutzt.
'use strict';
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// ---------------- HTTP (http-Module statt fetch: robust auf allen Windows-Versionen) ----------------
function request(url, { method = 'GET', headers = {}, body, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? require('https') : require('http');
    const req = lib.request(u, { method, headers: body ? { ...headers, 'Content-Length': Buffer.byteLength(body) } : headers, timeout }, (res) => {
      let data = ''; res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: data, json: () => { try { return JSON.parse(data); } catch { return {}; } } }));
    });
    req.on('timeout', () => req.destroy(new Error('Zeitüberschreitung')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function api(server, token) {
  return async (pathname, body) => {
    const res = await request(`${server}/api${pathname}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token || ''}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = res.json();
    if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; throw e; }
    return data;
  };
}

const reachable = async (server) => { try { return (await request(`${server}/api/health`, { timeout: 4000 })).ok; } catch { return false; } };

// ---------------- Kopplung per Code ----------------
async function startPairing(server) { return api(server, '')('/client/pair/start', {}); }
async function pollPairing(server, secret, { timeoutMs = 600_000, intervalMs = 2000, signal } = {}) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until && !signal?.aborted) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const r = await request(`${server}/api/client/pair/poll?secret=${encodeURIComponent(secret)}`);
      const d = r.json();
      if (d.status === 'done') return d;
      if (!r.ok) return null;
    } catch {}
  }
  return null;
}

// ---------------- Funbit Telemetry Server (Windows) ----------------
const FUNBIT_ZIP = 'https://github.com/Funbit/ets2-telemetry-server/archive/refs/heads/master.zip';
const funbitDir = () => path.join(process.env.LOCALAPPDATA || require('os').homedir(), 'Frachtwerk', 'funbit');
function findFunbit(extra) {
  const cands = [extra, path.join(funbitDir(), 'ets2-telemetry-server-master', 'server', 'Ets2Telemetry.exe')].filter(Boolean);
  return cands.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}
function download(url, dest, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Zu viele Weiterleitungen'));
    require('https').get(url, { headers: { 'User-Agent': 'Frachtwerk' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve(download(new URL(res.headers.location, url).toString(), dest, hops + 1)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const out = fs.createWriteStream(dest); res.pipe(out); out.on('finish', () => out.close(resolve)); out.on('error', reject);
    }).on('error', reject);
  });
}
async function installFunbit(log = () => {}) {
  const dir = funbitDir();
  fs.mkdirSync(dir, { recursive: true });
  const zip = path.join(dir, 'funbit.zip');
  log('Lade Funbit Telemetry Server herunter …');
  await download(FUNBIT_ZIP, zip);
  const head = Buffer.alloc(2); const fd = fs.openSync(zip, 'r'); fs.readSync(fd, head, 0, 2, 0); fs.closeSync(fd);
  if (head.toString() !== 'PK' || fs.statSync(zip).size < 500_000) throw new Error('Download unvollständig (Internet/Firewall?)');
  log('Entpacke …');
  const cp = require('child_process');
  try { cp.execFileSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force`], { stdio: 'ignore', windowsHide: true }); }
  catch { cp.execFileSync('tar.exe', ['-xf', zip, '-C', dir], { stdio: 'ignore', windowsHide: true }); }
  const exe = findFunbit();
  if (!exe) throw new Error('Ets2Telemetry.exe nicht im Archiv gefunden');
  return exe;
}
function startFunbit(exe) {
  try { require('child_process').spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore' }).unref(); return true; } catch { return false; }
}

// ---------------- Tour-Erkennung ----------------
const truckWear = (t) => ((t.wearEngine || 0) + (t.wearTransmission || 0) + (t.wearCabin || 0) + (t.wearChassis || 0) + (t.wearWheels || 0)) / 5;
const hasJob = (d) => !!(d.job && d.job.destinationCity && d.job.income > 0);
const durationMin = (s) => { // Funbit liefert Dauer als Datum ab "0001-01-01T00:00:00Z"
  if (!s) return 0; const t = Date.parse(s); const base = Date.parse('0001-01-01T00:00:00Z');
  return Number.isFinite(t) ? Math.max(0, (t - base) / 60000) : 0;
};

/**
 * Agent erstellen.
 * Ereignisse: 'status' ({ state, text }), 'job-start' (job), 'job-finish' ({ job, result, delivered }), 'log' (text)
 * state: 'no-telemetry' | 'waiting-game' | 'driving' | 'idle' | 'offline' | 'auth'
 */
function createAgent({ server, token, telemetry = 'http://localhost:25555/api/ets2/telemetry', interval = 1000, stateFile, liveEvery = 3000 }) {
  const ev = new EventEmitter();
  const send = api(server, token);
  let job = null, busy = false, timer = null, lastLive = 0, state = null, lastData = null;
  const log = (t) => ev.emit('log', t);
  const setState = (s, text) => { if (s !== state || text !== ev.statusText) { state = s; ev.statusText = text; ev.emit('status', { state: s, text, job }); } };
  const saveState = () => { if (!stateFile) return; try { job ? fs.writeFileSync(stateFile, JSON.stringify(job)) : fs.existsSync(stateFile) && fs.unlinkSync(stateFile); } catch {} };
  try { if (stateFile && fs.existsSync(stateFile)) { job = JSON.parse(fs.readFileSync(stateFile, 'utf8')); log(`↻ Laufende Tour #${job.id} wiederhergestellt`); } } catch {}

  async function onStart(d) {
    const planned = (d.navigation?.estimatedDistance || 0) / 1000;
    const payload = {
      game: /ats/i.test(d.game?.gameName || '') ? 'ats' : 'ets2',
      origin_city: d.job.sourceCity, origin_company: d.job.sourceCompany, dest_city: d.job.destinationCity, dest_company: d.job.destinationCompany,
      cargo: d.trailer?.name || 'Unbekannt', cargo_mass: (d.trailer?.mass || 0) / 1000, truck: `${d.truck?.make || ''} ${d.truck?.model || ''}`.trim(),
      planned_km: Math.round(planned), income: d.job.income,
    };
    const r = await send('/client/job/start', payload);
    job = {
      id: r.id, income: d.job.income, planned, cargo: payload.cargo, cargo_mass: payload.cargo_mass, from: payload.origin_city, to: payload.dest_city,
      start: { odo: d.truck.odometer, wear: d.trailer?.wear || 0, truckWear: truckWear(d.truck) },
      lastFuel: d.truck.fuel, fuelUsed: 0, maxSpeed: 0, speedSum: 0, speedN: 0, maxWear: d.trailer?.wear || 0, lastRemaining: planned, lastOdo: d.truck.odometer, lastTruckWear: truckWear(d.truck),
    };
    saveState();
    ev.emit('job-start', job);
  }

  function track(d) {
    const t = d.truck;
    if (t.fuel < job.lastFuel) job.fuelUsed += job.lastFuel - t.fuel; // Nachtanken ignorieren
    job.lastFuel = t.fuel;
    const sp = Math.abs(t.speed || 0);
    job.maxSpeed = Math.max(job.maxSpeed, sp);
    if (sp > 3) { job.speedSum += sp; job.speedN++; }
    if (d.trailer?.attached) job.maxWear = Math.max(job.maxWear, d.trailer.wear || 0);
    job.lastRemaining = (d.navigation?.estimatedDistance || 0) / 1000;
    job.lastOdo = t.odometer;
    job.lastTruckWear = truckWear(t);
  }

  async function onFinish() {
    const driven = Math.max(0, job.lastOdo - job.start.odo);
    // Abgeliefert, wenn das Ziel fast erreicht war oder der Großteil der Strecke gefahren wurde
    const delivered = job.lastRemaining < 2.5 || (job.planned > 0 && driven >= job.planned * 0.85);
    const body = {
      status: delivered ? 'delivered' : 'cancelled', driven_km: Math.round(driven * 10) / 10, fuel_used: Math.round(job.fuelUsed * 10) / 10,
      damage: Math.round(Math.max(0, job.maxWear - job.start.wear) * 1000) / 10, truck_damage: Math.round(Math.max(0, job.lastTruckWear - job.start.truckWear) * 1000) / 10,
      max_speed: Math.round(job.maxSpeed), avg_speed: job.speedN ? Math.round(job.speedSum / job.speedN) : 0,
    };
    const r = await send(`/client/job/${job.id}/finish`, body);
    const done = job; job = null; saveState();
    ev.emit('job-finish', { job: done, result: { ...body, ...(r.job || {}) }, delivered });
  }

  async function live(d) {
    if (Date.now() - lastLive < liveEvery) return;
    lastLive = Date.now();
    const p = d.truck?.placement || {};
    await send('/client/telemetry', {
      game: /ats/i.test(d.game?.gameName || '') ? 'ats' : 'ets2', paused: !!d.game?.paused, speed: Math.abs(d.truck?.speed || 0), truck: `${d.truck?.make || ''} ${d.truck?.model || ''}`.trim(),
      cargo: hasJob(d) ? d.trailer?.name : '', origin: hasJob(d) ? d.job.sourceCity : '', destination: hasJob(d) ? d.job.destinationCity : '',
      remaining_km: (d.navigation?.estimatedDistance || 0) / 1000, eta_min: durationMin(d.navigation?.estimatedTime), fuel: d.truck?.fuel || 0, fuel_capacity: d.truck?.fuelCapacity || 0,
      damage: job ? Math.max(0, (job.maxWear - job.start.wear) * 100) : 0, x: p.x || 0, z: p.z || 0, heading: p.heading || 0,
      cargo_mass: hasJob(d) ? (d.trailer?.mass || 0) / 1000 : 0, income: hasJob(d) ? d.job.income : 0,
    }).catch(() => {});
  }

  async function tick(d) {
    if (busy) return; busy = true;
    try {
      lastData = d;
      if (!d.game?.connected) { setState('waiting-game', 'Warte auf ETS2 / ATS'); return; }
      const active = hasJob(d);
      if (active && !job) await onStart(d);
      else if (active && job && (d.job.destinationCity !== job.to || d.job.income !== job.income)) { await onFinish(); await onStart(d); } // neuer Auftrag direkt
      else if (!active && job) await onFinish();
      if (job) { track(d); saveState(); setState('driving', `${job.from} → ${job.to} · noch ${Math.round(job.lastRemaining)} km`); }
      else setState('idle', 'Im Spiel · kein Auftrag');
      await live(d);
    } catch (e) {
      if (e.status === 401) setState('auth', 'Anmeldung abgelaufen – bitte neu verbinden');
      else setState('offline', `Server nicht erreichbar (${e.message})`);
    } finally { busy = false; }
  }

  async function poll() {
    try { const res = await request(telemetry, { timeout: 3000 }); await tick(res.json()); }
    catch { setState('no-telemetry', 'Funbit Telemetry Server läuft nicht'); }
  }

  ev.start = () => { if (!timer) { poll(); timer = setInterval(poll, interval); } return ev; };
  ev.stop = () => { clearInterval(timer); timer = null; saveState(); };
  ev.feed = (d) => tick(d);                 // für Demo/Tests
  ev.status = () => ({ state, text: ev.statusText, job, game: lastData?.game?.gameName || null, speed: Math.abs(lastData?.truck?.speed || 0) });
  ev.ping = () => send('/client/ping');
  return ev;
}

// ---------------- Demo-Tour (ohne Spiel) ----------------
function demoFeed(onEnd) {
  const C = [['Hamburg', -29, -16502], ['Berlin', 11199, -10160], ['München', 3840, 14377], ['Wien', 21788, 14230], ['Prag', 14642, 3689], ['Frankfurt', -6057, 2536], ['Köln', -11704, -2743], ['Leipzig', 7444, -3592]];
  const a = C[Math.floor(Math.random() * C.length)]; let b = a; while (b === a) b = C[Math.floor(Math.random() * C.length)];
  const total = Math.hypot(b[1] - a[1], b[2] - a[2]) * 0.019;
  const ticks = 60;
  let t = 0, odo = 182340, fuel = 600, wear = 0.002, ended = false;
  const income = Math.round(total * 55 + 4000);
  return () => {
    t++;
    const k = Math.min(1, Math.max(0, (t - 3) / ticks));
    const x = a[1] + (b[1] - a[1]) * k, z = a[2] + (b[2] - a[2]) * k;
    const remaining = total * (1 - k);
    if (t >= 3 && k < 1) {
      odo += total / ticks; fuel -= (total / ticks) * 0.33;
      if (Math.random() < 0.03) wear += 0.004;
      return { game: { connected: true, paused: false, gameName: 'ETS2' }, truck: { make: 'Scania', model: 'S 730', speed: 72 + Math.random() * 16, odometer: odo, fuel, fuelCapacity: 1400, wearEngine: 0.01, placement: { x, z } },
        trailer: { attached: true, name: 'Maschinenteile', mass: 18200, wear }, job: { income, sourceCity: a[0], sourceCompany: 'Posped', destinationCity: b[0], destinationCompany: 'Tradeaux' },
        navigation: { estimatedDistance: remaining * 1000, estimatedTime: new Date(Date.parse('0001-01-01T00:00:00Z') + remaining * 45000).toISOString() } };
    }
    if (k >= 1 && !ended) { ended = true; setTimeout(() => onEnd && onEnd(), 2500); }
    return { game: { connected: true, gameName: 'ETS2' }, truck: { make: 'Scania', model: 'S 730', speed: 0, odometer: odo, fuel, fuelCapacity: 1400, placement: { x, z } }, trailer: { attached: false }, job: { income: 0, destinationCity: '' }, navigation: {} };
  };
}

module.exports = { request, api, reachable, startPairing, pollPairing, findFunbit, installFunbit, startFunbit, createAgent, demoFeed, hasJob };
