#!/usr/bin/env node
/**
 * Frachtwerk Telemetrie-Client
 * ------------------------------------------------------------
 * Liest die Spieldaten von ETS2/ATS über den Funbit ETS2 Telemetry Server
 * (http://localhost:25555) und meldet Touren + Live-Status an Frachtwerk.
 *
 *   node frachtwerk-client.js --server https://deine-instanz.de --token fw_xxx
 *   node frachtwerk-client.js --server ... --token ... --demo     (Simulation ohne Spiel)
 *
 * Optionen können auch in einer Datei "frachtwerk.json" neben diesem Skript stehen:
 *   { "server": "https://…", "token": "fw_…" }
 *
 * Keine Abhängigkeiten – benötigt nur Node.js 18 oder neuer.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Als Frachtwerk-Client.exe liegt die Konfiguration neben der .exe
let isSea = false; try { isSea = require('node:sea').isSea(); } catch {}
const BASE = isSea ? path.dirname(process.execPath) : __dirname;
// Eingabe mit Zeilen-Warteschlange: funktioniert auch, wenn mehrere Zeilen auf einmal ankommen
let rl = null; const lines = []; const waiting = [];
const ask = (q) => new Promise((r) => {
  if (!rl) {
    let input; try { input = process.stdin; } catch { process.stdout.write(q + '\n'); return r(''); } // keine Eingabe verfügbar -> Standardwert
    rl = readline.createInterface({ input, terminal: !!input.isTTY, output: process.stdout });
    rl.on('line', (l) => (waiting.length ? waiting.shift()(l) : lines.push(l)));
    rl.on('close', () => { while (waiting.length) waiting.shift()(''); });
  }
  process.stdout.write(q);
  const done = (a) => r(String(a).trim());
  lines.length ? done(lines.shift()) : waiting.push(done);
});
const doneAsking = () => { rl?.close(); rl = null; };
async function fatal(msg) {
  console.error(msg);
  if (isSea || process.platform === 'win32') await ask('\nEnter drücken zum Beenden …');
  process.exit(1);
}

// ---------------- Konfiguration ----------------
const args = process.argv.slice(2);
const arg = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : def; };
let fileCfg = {};
const cfgPath = path.join(BASE, 'frachtwerk.json');
if (fs.existsSync(cfgPath)) { try { fileCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { console.warn('⚠ frachtwerk.json konnte nicht gelesen werden'); } }

const CFG = {
  server: String(arg('server', fileCfg.server || process.env.FRACHTWERK_SERVER || 'http://localhost:8080')).replace(/\/$/, ''),
  token: arg('token', fileCfg.token || process.env.FRACHTWERK_TOKEN || ''),
  telemetry: arg('telemetry', fileCfg.telemetry || 'http://localhost:25555/api/ets2/telemetry'),
  interval: Number(arg('interval', fileCfg.interval || 1000)),
  demo: !!arg('demo', false),
};
const STATE_FILE = path.join(BASE, '.frachtwerk-state.json');

const C = { r: '\x1b[0m', d: '\x1b[2m', o: '\x1b[38;5;214m', g: '\x1b[32m', c: '\x1b[36m', red: '\x1b[31m', b: '\x1b[1m' };
const log = (...m) => console.log(`${C.d}${new Date().toLocaleTimeString('de-DE')}${C.r}`, ...m);

/** Ersteinrichtung: fragt Server & Token ab und speichert sie in frachtwerk.json */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const openBrowser = (url) => {
  const { exec } = require('child_process');
  exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`, () => {});
};
const saveCfg = (extra = {}) => {
  let cur = {}; try { cur = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
  fs.writeFileSync(cfgPath, JSON.stringify({ ...cur, server: CFG.server, token: CFG.token, ...extra }, null, 2));
};
const reachable = async (url) => { try { return (await request(`${url}/api/health`)).ok; } catch { return false; } };

/** Ersteinrichtung: Server finden, dann per Code im Browser koppeln (kein Token-Kopieren nötig) */
async function setup() {
  console.log(`\n${C.o}${C.b}  ▲ FRACHTWERK${C.r} ${C.d}Einrichtung${C.r}\n`);
  // 1) Server suchen: Konfiguration, dann lokaler Frachtwerk-Server, sonst fragen
  let server = fileCfg.server || (arg('server') !== undefined ? CFG.server : null);
  if (!server || !(await reachable(server))) {
    for (const cand of ['http://localhost:8080', 'http://127.0.0.1:8080']) if (await reachable(cand)) { server = cand; break; }
  }
  while (!server || !(await reachable(server))) {
    if (server) console.log(`${C.red}Unter ${server} läuft kein Frachtwerk.${C.r}`);
    const a = await ask('Adresse deines Frachtwerk-Servers (z. B. https://frachtwerk.meine-firma.de): ');
    server = a ? (/^https?:\/\//.test(a) ? a : `https://${a}`).replace(/\/$/, '') : null;
  }
  CFG.server = server.replace(/\/$/, '');
  log(`${C.g}✔ Server gefunden:${C.r} ${CFG.server}`);

  // 2) Koppeln
  const p = await send('/client/pair/start', {}).catch(() => null);
  if (!p) return manualToken();
  const url = `${CFG.server}/app/pair?code=${p.code}`;
  console.log(`\n  Dein Code:  ${C.o}${C.b}${p.code.split('').join(' ')}${C.r}\n`);
  console.log(`  Ich öffne jetzt deinen Browser. Melde dich an und klicke auf ${C.b}„Verbinden“${C.r}.`);
  console.log(`  ${C.d}Falls sich nichts öffnet: ${url}${C.r}\n`);
  openBrowser(url);
  const until = Date.now() + p.expires_in * 1000;
  while (Date.now() < until) {
    await sleep(2000);
    try {
      const r = await request(`${CFG.server}/api/client/pair/poll?secret=${encodeURIComponent(p.secret)}`);
      const d = r.json();
      if (d.status === 'done') { CFG.token = d.token; saveCfg(); log(`${C.g}✔ Verbunden mit dem Konto ${C.b}${d.user}${C.r}`); return; }
      if (!r.ok) break;
    } catch {}
  }
  console.log(`${C.red}Die Kopplung ist abgelaufen.${C.r}`);
  return manualToken();
}

async function manualToken() {
  console.log('Alternativ: Token aus Frachtwerk → „Client & Token“ hier einfügen.');
  for (let i = 0; i < 3; i++) {
    const token = await ask('API-Token (beginnt mit fw_): ');
    if (/^fw_[\w-]{10,}$/.test(token)) { CFG.token = token; saveCfg(); return; }
    console.log(`${C.red}Das sieht nicht nach einem Token aus.${C.r}`);
  }
  return fatal('Einrichtung abgebrochen. Starte den Client einfach neu.');
}

// ---------------- Funbit Telemetry Server automatisch einrichten (Windows) ----------------
const FUNBIT_ZIP = 'https://github.com/Funbit/ets2-telemetry-server/archive/refs/heads/master.zip';
const FUNBIT_DIR = path.join(process.env.LOCALAPPDATA || BASE, 'Frachtwerk', 'funbit');
function findFunbit() {
  const cands = [fileCfg.funbit, path.join(FUNBIT_DIR, 'ets2-telemetry-server-master', 'server', 'Ets2Telemetry.exe')].filter(Boolean);
  return cands.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}
function download(url, dest, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Zu viele Weiterleitungen'));
    require('https').get(url, { headers: { 'User-Agent': 'Frachtwerk-Client' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve(download(new URL(res.headers.location, url).toString(), dest, hops + 1)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const out = fs.createWriteStream(dest); res.pipe(out); out.on('finish', () => out.close(resolve)); out.on('error', reject);
    }).on('error', reject);
  });
}
function startFunbit(exe) {
  const { spawn } = require('child_process');
  try { spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore' }).unref(); return true; } catch { return false; }
}
const telemetryUp = async () => { try { return (await request(CFG.telemetry)).ok; } catch { return false; } };

async function ensureFunbit() {
  if (CFG.demo || process.platform !== 'win32' || (await telemetryUp())) return;
  let exe = findFunbit();
  if (!exe) {
    console.log(`\n${C.o}Für die Spieldaten brauchst du einmalig den kostenlosen Funbit ETS2 Telemetry Server.${C.r}`);
    const a = (await ask('Soll ich ihn jetzt herunterladen und starten? [J/n]: ')).toLowerCase();
    if (a === 'n' || a === 'nein') return;
    try {
      fs.mkdirSync(FUNBIT_DIR, { recursive: true });
      const zip = path.join(FUNBIT_DIR, 'funbit.zip');
      log('Lade Funbit herunter …'); await download(FUNBIT_ZIP, zip);
      const head = Buffer.alloc(2); const fd = fs.openSync(zip, 'r'); fs.readSync(fd, head, 0, 2, 0); fs.closeSync(fd);
      if (head.toString() !== 'PK' || fs.statSync(zip).size < 500_000) throw new Error('Download unvollständig (Internet/Firewall?)');
      log('Entpacke …');
      const cp = require('child_process');
      try { cp.execFileSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${FUNBIT_DIR}' -Force`], { stdio: 'ignore' }); }
      catch { cp.execFileSync('tar.exe', ['-xf', zip, '-C', FUNBIT_DIR], { stdio: 'ignore' }); } // Windows 10+ hat tar eingebaut
      exe = findFunbit();
      if (!exe) throw new Error('Ets2Telemetry.exe nicht im Archiv gefunden');
      saveCfg({ funbit: exe });
      console.log(`\n${C.o}${C.b}  Einmalig: Im Funbit-Fenster auf „Install“ klicken${C.r} (installiert das Plugin in ETS2/ATS).\n`);
    } catch (e) {
      console.log(`${C.red}Automatische Einrichtung fehlgeschlagen:${C.r} ${e.message}`);
      console.log('Bitte manuell: https://github.com/Funbit/ets2-telemetry-server → herunterladen, Ets2Telemetry.exe starten, „Install“ klicken.');
      openBrowser('https://github.com/Funbit/ets2-telemetry-server');
      return;
    }
  }
  log('Starte Funbit Telemetry Server …');
  startFunbit(exe);
  for (let i = 0; i < 15 && !(await telemetryUp()); i++) await sleep(1000);
}

// ---------------- API ----------------
// HTTP über die http-Module statt fetch: robuster (alte Windows-Versionen, Wine, Firmen-Netzwerke)
function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? require('https') : require('http');
    const req = lib.request(u, { method, headers: body ? { ...headers, 'Content-Length': Buffer.byteLength(body) } : headers, timeout: 15000 }, (res) => {
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

async function send(pathname, body) {
  const res = await request(`${CFG.server}/api${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${CFG.token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ---------------- Tour-Zustand ----------------
let job = null; // { id, start:{odo,fuel,wear,truckWear}, planned, fuelUsed, lastFuel, maxSpeed, speedSum, speedN, maxWear, lastRemaining, income, ... }
const saveState = () => { try { job ? fs.writeFileSync(STATE_FILE, JSON.stringify(job)) : fs.existsSync(STATE_FILE) && fs.unlinkSync(STATE_FILE); } catch {} };
try { if (fs.existsSync(STATE_FILE)) { job = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); log(`${C.c}↻ Laufende Tour #${job.id} wiederhergestellt${C.r}`); } } catch {}

const truckWear = (t) => ((t.wearEngine || 0) + (t.wearTransmission || 0) + (t.wearCabin || 0) + (t.wearChassis || 0) + (t.wearWheels || 0)) / 5;
const hasJob = (d) => !!(d.job && d.job.destinationCity && d.job.income > 0);
const durationMin = (s) => { // Funbit liefert Dauer als Datum ab "0001-01-01T00:00:00Z"
  if (!s) return 0; const t = Date.parse(s); const base = Date.parse('0001-01-01T00:00:00Z');
  return Number.isFinite(t) ? Math.max(0, (t - base) / 60000) : 0;
};

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
    id: r.id, income: d.job.income, planned, cargo: payload.cargo, from: payload.origin_city, to: payload.dest_city,
    start: { odo: d.truck.odometer, wear: d.trailer?.wear || 0, truckWear: truckWear(d.truck) },
    lastFuel: d.truck.fuel, fuelUsed: 0, maxSpeed: 0, speedSum: 0, speedN: 0, maxWear: d.trailer?.wear || 0, lastRemaining: planned, lastOdo: d.truck.odometer, lastTruckWear: truckWear(d.truck),
  };
  saveState();
  log(`${C.o}▶ Tour gestartet${C.r} #${job.id}  ${C.b}${job.from} → ${job.to}${C.r}  ${payload.cargo} (${payload.cargo_mass.toFixed(1)} t)  ${payload.income.toLocaleString('de-DE')} €`);
}

function track(d) {
  if (!job) return;
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
  if (delivered) log(`${C.g}✔ Abgeliefert${C.r} #${job.id}  ${body.driven_km} km · ${body.fuel_used} l · ${body.damage} % Schaden  →  Lohn ${C.b}${(r.job?.payout || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}${C.r} (${r.job?.review === 'approved' ? 'freigegeben' : 'in Prüfung'})`);
  else log(`${C.red}✖ Tour abgebrochen${C.r} #${job.id}`);
  job = null; saveState();
}

let lastLive = 0;
async function live(d) {
  if (Date.now() - lastLive < (CFG.demo ? 1500 : 3000)) return;
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

// ---------------- Hauptschleife ----------------
let busy = false, connected = null;
async function tick(d) {
  if (busy) return; busy = true;
  try {
    if (!d.game?.connected) { if (connected !== false) log(`${C.d}… warte auf Spiel${C.r}`); connected = false; return; }
    if (connected !== true) { log(`${C.g}● Spiel verbunden${C.r} (${d.game.gameName || 'ETS2'})`); connected = true; }
    const active = hasJob(d);
    if (active && !job) await onStart(d);
    else if (active && job && (d.job.destinationCity !== job.to || d.job.income !== job.income)) { await onFinish(); await onStart(d); } // neuer Auftrag direkt
    else if (!active && job) await onFinish();
    if (job) { track(d); saveState(); }
    await live(d);
  } catch (e) { log(`${C.red}Fehler:${C.r} ${e.message}`); } finally { busy = false; }
}

async function poll() {
  try {
    const res = await request(CFG.telemetry);
    await tick(res.json());
  } catch {
    if (connected !== 'nosrv') log(`${C.red}Telemetry-Server nicht erreichbar${C.r} (${CFG.telemetry})\n         → Starte Ets2Telemetry.exe (Funbit) und klicke dort einmal auf „Install“. Ich versuche es weiter …`);
    connected = 'nosrv';
  }
}

// ---------------- Demo-Simulation ----------------
function demoFeed() {
  // Echte Spielkoordinaten einiger Städte (ETS2) – die Demo fährt sichtbar über die Live-Map
  const C = [['Hamburg', -29, -16502], ['Berlin', 11199, -10160], ['München', 3840, 14377], ['Wien', 21788, 14230], ['Prag', 14642, 3689], ['Frankfurt', -6057, 2536], ['Köln', -11704, -2743], ['Leipzig', 7444, -3592]];
  const a = C[Math.floor(Math.random() * C.length)]; let b = a; while (b === a) b = C[Math.floor(Math.random() * C.length)];
  const total = Math.hypot(b[1] - a[1], b[2] - a[2]) * 0.019; // Spieleinheiten -> km (Kartenmaßstab)
  const ticks = 60; // Tour dauert ~25 s im Zeitraffer
  let t = 0, odo = 182340, fuel = 600, wear = 0.002;
  const income = Math.round(total * 55 + 4000);
  return () => {
    t++;
    const k = Math.min(1, Math.max(0, (t - 3) / ticks));
    const x = a[1] + (b[1] - a[1]) * k, z = a[2] + (b[2] - a[2]) * k;
    const remaining = total * (1 - k);
    if (t >= 3 && k < 1) {
      odo += total / ticks; fuel -= total / ticks * 0.33;
      if (Math.random() < 0.03) wear += 0.004;
      return { game: { connected: true, paused: false, gameName: 'ETS2' }, truck: { make: 'Scania', model: 'S 730', speed: 72 + Math.random() * 16, odometer: odo, fuel, fuelCapacity: 1400, wearEngine: 0.01, placement: { x, z } },
        trailer: { attached: true, name: 'Maschinenteile', mass: 18200, wear }, job: { income, sourceCity: a[0], sourceCompany: 'Posped', destinationCity: b[0], destinationCompany: 'Tradeaux' },
        navigation: { estimatedDistance: remaining * 1000, estimatedTime: new Date(Date.parse('0001-01-01T00:00:00Z') + remaining * 45000).toISOString() } };
    }
    if (k >= 1) { setTimeout(() => { log(`${C2.c}Demo beendet.${C2.r} Schau dir die Tour in Frachtwerk an!`); process.exit(0); }, 2500); }
    return { game: { connected: true, gameName: 'ETS2' }, truck: { make: 'Scania', model: 'S 730', speed: 0, odometer: odo, fuel, fuelCapacity: 1400, placement: { x, z } }, trailer: { attached: false }, job: { income: 0, destinationCity: '' }, navigation: {} };
  };
}
const C2 = C;

// ---------------- Start ----------------
(async () => {
  if (!CFG.token || CFG.token === true) await setup();
  console.log(`\n${C.o}${C.b}  ▲ FRACHTWERK${C.r} ${C.d}Telemetrie-Client${C.r}\n`);
  for (let attempt = 0; ; attempt++) {
    try {
      const me = await send('/client/ping');
      log(`Angemeldet als ${C.b}${me.user}${C.r}${me.company ? ` · ${me.company}` : ' · Freifahrer'}  ${C.d}(${CFG.server})${C.r}`);
      break;
    } catch (e) {
      if (/401|angemeldet/i.test(e.message) && attempt === 0) { log(`${C.red}Der gespeicherte Token ist nicht mehr gültig – neu verbinden.${C.r}`); CFG.token = ''; await setup(); continue; }
      return fatal(`${C.red}Verbindung zu Frachtwerk fehlgeschlagen:${C.r} ${e.message}\nIst der Server ${CFG.server} erreichbar? (Läuft Frachtwerk-Server.exe bzw. ist die Adresse richtig?)`);
    }
  }
  doneAsking();
  await ensureFunbit();
  if (CFG.demo) {
    log(`${C.c}Demo-Modus: simuliere eine Tour im Zeitraffer…${C.r}`);
    const feed = demoFeed();
    setInterval(() => tick(feed()), 400);
  } else {
    log(`Lese Telemetrie von ${CFG.telemetry}`);
    poll(); setInterval(poll, CFG.interval);
  }
})();
process.on('SIGINT', () => { saveState(); console.log('\nBis zur nächsten Tour! 🚚'); process.exit(0); });
