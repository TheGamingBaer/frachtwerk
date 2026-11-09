// Frachtwerk.exe – Desktop-App für Fahrer (und optional Server für die eigene Spedition)
//  • installiert sich beim ersten Start selbst (Startmenü, Desktop, „Apps“-Liste, Autostart)
//  • läuft unsichtbar im Hintergrund mit Symbol neben der Uhr (Tray)
//  • öffnet Frachtwerk als eigenes App-Fenster
//  • erfasst Touren automatisch (Funbit-Telemetrie) und aktualisiert sich selbst
process.removeAllListeners('warning');
/* global __APP_VERSION__, __APP_MARKER__ */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';
const VERSION_MARKER = typeof __APP_MARKER__ !== 'undefined' ? __APP_MARKER__ : ''; // vom Server im Programm gesucht (Auto-Update)
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const cp = require('child_process');
const A = require('../../client/agent');
const { createPresence } = require('./discord-rpc');

const WIN = process.platform === 'win32';
let sea = null; try { sea = require('node:sea'); if (!sea.isSea()) sea = null; } catch {}
const PORT = 47842; // lokale Steuerung (nur 127.0.0.1)
const APPDATA = WIN ? path.join(process.env.LOCALAPPDATA || os.homedir(), 'Frachtwerk') : path.join(os.homedir(), '.frachtwerk');
const INSTALL_DIR = WIN ? path.join(process.env.LOCALAPPDATA || os.homedir(), 'Programs', 'Frachtwerk') : null;
const INSTALLED_EXE = WIN ? path.join(INSTALL_DIR, 'Frachtwerk.exe') : null;
const CFG_FILE = path.join(APPDATA, 'config.json');
const LOG_FILE = path.join(APPDATA, 'frachtwerk.log');
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
fs.mkdirSync(APPDATA, { recursive: true });

// ---------------- Protokoll ----------------
function log(...m) {
  const line = `${new Date().toISOString()} ${m.join(' ')}\n`;
  try { if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 1_000_000) fs.renameSync(LOG_FILE, LOG_FILE + '.1'); fs.appendFileSync(LOG_FILE, line); } catch {}
  if (!sea || !WIN) process.stdout.write(line);
}
process.on('uncaughtException', (e) => log('FEHLER', e.stack || e.message));
process.on('unhandledRejection', (e) => log('FEHLER', e?.stack || e));

// ---------------- Eingebettete Dateien ----------------
function asset(name, enc) {
  if (sea) { const b = Buffer.from(sea.getAsset(name)); return enc ? b.toString(enc) : b; }
  const local = { 'setup.html': path.join(__dirname, 'setup.html'), 'tray.ps1': path.join(__dirname, 'tray.ps1'), 'icon.ico': path.join(__dirname, '..', '.cache', 'icon.ico'), 'icon.png': path.join(__dirname, '..', '..', 'web', 'public', 'icon-192.png') }[name];
  try { return fs.readFileSync(local, enc); } catch { return enc ? '' : Buffer.alloc(0); }
}

// ---------------- Konfiguration ----------------
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch {}
const saveCfg = () => { try { fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2)); } catch (e) { log('Konfiguration nicht gespeichert:', e.message); } };

/** Server-Adresse, die der Frachtwerk-Server beim Download ans Programm angehängt hat */
function embeddedServer(file = process.execPath) {
  try {
    const fd = fs.openSync(file, 'r'); const size = fs.fstatSync(fd).size; const len = Math.min(4096, size);
    const buf = Buffer.alloc(len); fs.readSync(fd, buf, 0, len, size - len); fs.closeSync(fd);
    const m = buf.toString('latin1').match(/FRACHTWERK-CONFIG:([A-Za-z0-9+/=]+):END/);
    return m ? JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')).server || null : null;
  } catch { return null; }
}

// ---------------- Windows-Helfer ----------------
const run = (file, args) => new Promise((res) => cp.execFile(file, args, { windowsHide: true }, (err, out) => res({ ok: !err, out: String(out || '') })));
const ps = (script) => run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]);
const psq = (s) => `'${String(s).replace(/'/g, "''")}'`; // PowerShell-String
function messageBox(text, title = 'Frachtwerk') {
  if (!WIN) return log(title + ':', text);
  cp.spawn('powershell.exe', ['-NoProfile', '-Command', `Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show(${psq(text)}, ${psq(title)})`], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
}
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const UNINSTALL_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Frachtwerk';
async function setAutostart(on) {
  cfg.autostart = !!on; saveCfg();
  if (!WIN) return;
  if (on) await run('reg.exe', ['add', RUN_KEY, '/v', 'Frachtwerk', '/t', 'REG_SZ', '/d', `"${INSTALLED_EXE}" --background`, '/f']);
  else await run('reg.exe', ['delete', RUN_KEY, '/v', 'Frachtwerk', '/f']);
}
async function createShortcuts(exe) {
  const startMenu = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Frachtwerk.lnk');
  await ps(`$s = New-Object -ComObject WScript.Shell;
    foreach ($p in @(${psq(startMenu)}, (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Frachtwerk.lnk'))) {
      $l = $s.CreateShortcut($p); $l.TargetPath = ${psq(exe)}; $l.WorkingDirectory = ${psq(path.dirname(exe))};
      $l.IconLocation = ${psq(exe + ',0')}; $l.Description = 'Frachtwerk – Touren & Abrechnung für ETS2/ATS'; $l.Save() }`);
}
async function registerUninstall(exe) {
  const add = (name, type, val) => run('reg.exe', ['add', UNINSTALL_KEY, '/v', name, '/t', type, '/d', val, '/f']);
  await add('DisplayName', 'REG_SZ', 'Frachtwerk');
  await add('DisplayVersion', 'REG_SZ', APP_VERSION);
  await add('Publisher', 'REG_SZ', 'Frachtwerk');
  await add('DisplayIcon', 'REG_SZ', `${exe},0`);
  await add('InstallLocation', 'REG_SZ', path.dirname(exe));
  await add('UninstallString', 'REG_SZ', `"${exe}" --uninstall`);
  await add('NoModify', 'REG_DWORD', '1');
  await add('NoRepair', 'REG_DWORD', '1');
  await add('EstimatedSize', 'REG_DWORD', String(Math.round(fs.statSync(exe).size / 1024)));
}

// ---------------- Einzelne Instanz ----------------
function askRunning(pathname, method = 'POST') {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: pathname, method, timeout: 1500 }, (res) => { res.resume(); resolve(res.statusCode < 500); });
    req.on('error', () => resolve(false)); req.on('timeout', () => { req.destroy(); resolve(false); }); req.end();
  });
}

// ---------------- App-Fenster ----------------
function findBrowser() {
  const pf = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
  const cands = [];
  for (const base of pf) cands.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  return cands.find((c) => { try { return fs.existsSync(c); } catch { return false; } }) || null;
}
function openWindow(url) {
  log('Öffne Fenster:', url);
  if (WIN) {
    const b = findBrowser();
    if (b) { cp.spawn(b, [`--app=${url}`, '--window-size=1360,880'], { detached: true, stdio: 'ignore' }).unref(); return; }
    // windowsVerbatimArguments: sonst verfälscht Node die Anführungszeichen für cmd.exe
    cp.spawn('cmd.exe', ['/d', '/s', '/c', `"start "" "${url}""`], { windowsHide: true, detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
  } else cp.exec(`${process.platform === 'darwin' ? 'open' : 'xdg-open'} "${url}"`, () => {});
}
const setupUrl = (hash = '') => `http://127.0.0.1:${PORT}/${hash}`;
const appUrl = (p = '/app') => (cfg.server && cfg.token ? cfg.server + p : setupUrl());

// ---------------- Zustand ----------------
let presence = null, presenceInfo = { company: null, siteName: 'Frachtwerk', logo: null }, jobStartedAt = null, trayFails = 0, agent = null, pairing = null, pairAbort = null, hostInfo = null, trayProc = null, quitting = false, updateVersion = null;
const notifications = [];
const notify = (title, text) => { notifications.push({ title, text }); if (notifications.length > 5) notifications.shift(); log('Hinweis:', title, '–', text); };
const eur = (n) => (n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

function trayState() {
  const a = agent?.status() || {};
  const status = !cfg.token ? 'Nicht verbunden – klicken zum Einrichten'
    : a.state === 'driving' ? `● ${a.text}` : a.state === 'idle' ? '● Im Spiel – kein Auftrag' : a.state === 'waiting-game' ? '○ Warte auf ETS2 / ATS'
    : a.state === 'no-telemetry' ? '⚠ Spieldaten fehlen (Funbit)' : a.state === 'offline' ? '⚠ Server nicht erreichbar' : a.state === 'auth' ? '⚠ Bitte neu verbinden' : '… startet';
  return { tooltip: `Frachtwerk – ${status.replace(/^[●○⚠] /, '')}`, status, autostart: !!cfg.autostart, discord: cfg.discordPresence !== false, notifications: notifications.splice(0), quit: quitting };
}

// ---------------- Agent (Touren-Erfassung) ----------------
async function startAgent() {
  if (agent) { agent.stop(); agent.removeAllListeners(); agent = null; }
  if (!cfg.server || !cfg.token) return;
  agent = A.createAgent({ server: cfg.server, token: cfg.token, stateFile: path.join(APPDATA, 'tour.json') });
  agent.on('log', (t) => log(t));
  let lastState = null;
  agent.on('status', ({ state, text }) => {
    if (state !== lastState) log('Status:', state, text || '');
    if (state === 'auth' && lastState !== 'auth') { notify('Bitte neu verbinden', 'Deine Anmeldung ist abgelaufen. Klicke hier, um Frachtwerk neu zu verbinden.'); cfg.token = null; saveCfg(); startAgent(); }
    if (state === 'no-telemetry' && lastState !== 'no-telemetry') ensureFunbit();
    if (state === 'offline' && lastState && lastState !== 'offline') notify('Server nicht erreichbar', 'Frachtwerk versucht es automatisch weiter.');
    lastState = state;
  });
  agent.on('job-start', () => { jobStartedAt = Date.now(); });
  agent.on('job-finish', () => { jobStartedAt = null; });
  agent.on('job-start', (j) => notify('Tour gestartet', `${j.from} → ${j.to} · ${j.cargo} (${j.cargo_mass.toFixed(1).replace('.', ',')} t)`));
  agent.on('job-finish', ({ job, result, delivered }) => delivered
    ? notify(`Abgeliefert in ${job.to}`, `${Math.round(result.driven_km)} km · ${String(result.damage).replace('.', ',')} % Schaden · Lohn ${eur(result.payout)}`)
    : notify('Tour abgebrochen', `${job.from} → ${job.to}`));
  agent.start();
  setupPresence();
}

// ---------------- Discord Rich Presence ----------------
const clip = (t, n = 128) => { t = String(t || '').trim(); return t.length < 2 ? `${t}  `.slice(0, 2) : t.slice(0, n); };
async function setupPresence() {
  if (presence) { presence.stop(); presence = null; }
  if (cfg.discordPresence === false || !cfg.server) return;
  let appId = process.env.FRACHTWERK_DISCORD_APP_ID || cfg.discordAppId || null;
  try {
    const site = (await A.request(`${cfg.server}/api/site`)).json();
    appId = site.discord_app_id || appId;
    presenceInfo.siteName = site.site_name || 'Frachtwerk';
    const logo = site.logo_url ? new URL(site.logo_url, cfg.server).toString() : `${cfg.server}/icon-512.png`;
    presenceInfo.logo = logo.startsWith('https://') ? logo : null; // Discord lädt nur öffentliche https-Bilder
  } catch {}
  try { presenceInfo.company = (await agent?.ping())?.company || null; } catch {}
  if (!/^\d{15,22}$/.test(String(appId || ''))) { log('Discord-Status: keine Application-ID hinterlegt (Admin → Website)'); return; }
  presence = createPresence({ clientId: appId, log });
}
function presenceActivity() {
  const a = agent?.status(); if (!a) return null;
  if (a.state !== 'driving' && a.state !== 'idle') return null; // nur während das Spiel läuft
  const game = /ats|american/i.test(a.game || '') ? 'ATS' : 'ETS2';
  const j = a.job;
  const act = j
    ? { details: clip(`${j.from} → ${j.to}`), state: clip(`${j.cargo}${j.cargo_mass ? ` · ${j.cargo_mass.toFixed(1).replace('.', ',')} t` : ''} · noch ${Math.max(0, Math.round(j.lastRemaining || 0))} km`) }
    : { details: 'Freie Fahrt', state: clip(presenceInfo.company ? `Fährt für ${presenceInfo.company}` : 'Wartet auf den nächsten Auftrag') };
  if (j && jobStartedAt) act.timestamps = { start: jobStartedAt };
  act.assets = { large_image: presenceInfo.logo || 'logo', large_text: clip(`${presenceInfo.siteName} · ${game}${presenceInfo.company ? ` · ${presenceInfo.company}` : ''}`) };
  if (cfg.server?.startsWith('https://')) act.buttons = [{ label: 'Live-Map ansehen', url: `${cfg.server}/map` }, { label: `${presenceInfo.siteName} öffnen`.slice(0, 32), url: cfg.server }];
  return act;
}
setInterval(() => { if (presence) presence.set(presenceActivity()); }, 5000).unref();

// ---------------- Funbit automatisch ----------------
let funbitBusy = false;
async function ensureFunbit(force = false) {
  if (!WIN || funbitBusy) return;
  funbitBusy = true;
  try {
    let exe = A.findFunbit(cfg.funbit);
    if (!exe && (force || !cfg.funbitDeclined)) {
      notify('Spieldaten werden eingerichtet', 'Frachtwerk lädt den kostenlosen Funbit Telemetry Server herunter …');
      exe = await A.installFunbit((t) => log(t));
      cfg.funbit = exe; saveCfg();
      notify('Einmal „Install“ klicken', 'Im Funbit-Fenster einmal auf „Install“ klicken – damit liefert ETS2 die Daten.');
    }
    if (exe) { log('Starte Funbit:', exe); A.startFunbit(exe); }
  } catch (e) {
    log('Funbit-Einrichtung fehlgeschlagen:', e.message);
    notify('Spieldaten: manuelle Einrichtung nötig', 'Automatischer Download fehlgeschlagen. Über „Status & Einstellungen“ erneut versuchen.');
  } finally { funbitBusy = false; }
}

// ---------------- Kopplung ----------------
async function beginPairing(server) {
  server = String(server || '').trim().replace(/\/+$/, '');
  if (!server) throw new Error('Bitte eine Adresse eingeben');
  if (!/^https?:\/\//.test(server)) server = (/^(localhost|127\.|192\.168\.|10\.)/.test(server) ? 'http://' : 'https://') + server;
  if (!(await A.reachable(server))) throw new Error(`Unter ${server} läuft kein Frachtwerk. Stimmt die Adresse?`);
  const p = await A.startPairing(server);
  pairAbort?.abort(); pairAbort = new AbortController();
  pairing = { server, code: p.code, url: `${server}/app/pair?code=${p.code}` };
  log('Kopplung gestartet:', server, p.code);
  A.pollPairing(server, p.secret, { timeoutMs: p.expires_in * 1000, signal: pairAbort.signal }).then(async (d) => {
    if (!pairing || pairing.code !== p.code) return;
    pairing = null;
    if (!d) return notify('Verbindung abgelaufen', 'Bitte erneut verbinden.');
    cfg.server = server; cfg.token = d.token; cfg.user = d.user; saveCfg();
    notify('Verbunden', `Angemeldet als ${d.user}. Deine Touren werden ab jetzt automatisch erfasst.`);
    await startAgent();
    checkUpdate();
  });
  return pairing;
}

// ---------------- Eigener Server (Betreiber-Modus) ----------------
async function startHost(demo) {
  if (hostInfo) return hostInfo;
  const dataDir = fs.existsSync(path.join(path.dirname(process.execPath), 'Frachtwerk-Daten')) ? path.join(path.dirname(process.execPath), 'Frachtwerk-Daten') : path.join(APPDATA, 'Server');
  fs.mkdirSync(dataDir, { recursive: true });
  process.env.DB_PATH ||= path.join(dataDir, 'frachtwerk.db');
  process.env.DOWNLOADS_DIR ||= WIN ? INSTALL_DIR : path.dirname(process.execPath); // Fahrer laden Frachtwerk.exe direkt hier herunter
  if (sea) {
    const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
    const manifest = JSON.parse(sea.getAsset('manifest.json', 'utf8'));
    const map = new Map();
    for (const [url, key] of Object.entries(manifest)) map.set(url, { body: Buffer.from(sea.getAsset(key)), type: TYPES[path.extname(url)] || 'application/octet-stream' });
    global.FW_EMBEDDED = map;
  }
  const { get } = require('../../server/src/db');
  if (demo && !get("SELECT id FROM users WHERE username='demo'")) require('../../server/src/seed').seedDemo();
  const port = Number(cfg.hostPort || 8080);
  await require('../../server/src/index').start(port);
  const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${port}`);
  hostInfo = { port, urls: [`http://localhost:${port}`, ...lan], demo: !!get("SELECT id FROM users WHERE username='demo'") };
  if (hostInfo.demo) require('../../server/scripts/simulate').simulate({ server: `http://127.0.0.1:${port}`, drivers: 8, speed: 9 }).catch(() => {});
  cfg.host = { enabled: true, port, demo: !!demo }; saveCfg();
  log('Server läuft:', hostInfo.urls.join(' '));
  return hostInfo;
}

// ---------------- Auto-Update ----------------
const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
async function checkUpdate() {
  if (!WIN || !sea || !cfg.server || process.execPath.toLowerCase() !== INSTALLED_EXE.toLowerCase()) return;
  try {
    const d = (await A.request(`${cfg.server}/api/downloads`)).json();
    if (!d.app?.available || !d.app.version || !newer(d.app.version, APP_VERSION)) return;
    updateVersion = d.app.version;
    log('Update verfügbar:', d.app.version);
    const tmp = path.join(INSTALL_DIR, 'Frachtwerk.update.exe');
    await new Promise((resolve, reject) => {
      const lib = cfg.server.startsWith('https') ? require('https') : http;
      lib.get(`${cfg.server}/download/Frachtwerk.exe`, (res) => {
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        const out = fs.createWriteStream(tmp); res.pipe(out); out.on('finish', () => out.close(resolve)); out.on('error', reject);
      }).on('error', reject);
    });
    if (fs.statSync(tmp).size < 20_000_000) throw new Error('Update unvollständig');
    notify(`Frachtwerk ${d.app.version} wird installiert`, 'Die App startet gleich neu – das dauert nur ein paar Sekunden.');
    // Nach dem Beenden: Datei tauschen und neu starten
    const bat = path.join(APPDATA, 'update.cmd');
    fs.writeFileSync(bat, `@echo off\r\nchcp 65001 >nul\r\nping -n 4 127.0.0.1 >nul\r\nmove /y "${tmp}" "${INSTALLED_EXE}" >nul\r\nstart "" "${INSTALLED_EXE}" --background --updated\r\ndel "%~f0"\r\n`);
    setTimeout(() => { cp.spawn('cmd.exe', ['/c', bat], { windowsHide: true, detached: true, stdio: 'ignore' }).unref(); quit(); }, 4000);
  } catch (e) { log('Update fehlgeschlagen:', e.message); }
}

// ---------------- Lokale Steuerung (Setup-Seite & Tray) ----------------
function readBody(req) { return new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); }); }
async function action(name) {
  switch (name) {
    case 'open': return openWindow(appUrl('/app'));
    case 'map': return openWindow(appUrl('/app/map'));
    case 'jobs': return openWindow(appUrl('/app/jobs'));
    case 'settings': return openWindow(setupUrl('#settings'));
    case 'autostart': return setAutostart(!cfg.autostart);
    case 'discord': cfg.discordPresence = cfg.discordPresence === false; saveCfg(); return setupPresence();
    case 'funbit': return ensureFunbit(true);
    case 'logout': cfg.token = null; cfg.user = null; saveCfg(); return startAgent();
    case 'quit': return quit();
  }
}
const control = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  // Nur lokale Seiten dürfen steuern (Schutz vor fremden Webseiten)
  const origin = req.headers.origin;
  if (req.method === 'POST' && origin && origin !== `http://127.0.0.1:${PORT}` && origin !== `http://localhost:${PORT}`) return json(403, { error: 'Nicht erlaubt' });
  try {
    if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(asset('setup.html', 'utf8')); }
    if (req.method === 'GET' && url.pathname === '/icon.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(asset('icon.png')); }
    if (req.method === 'GET' && url.pathname === '/ping') return json(200, { ok: true, version: APP_VERSION });
    if (req.method === 'GET' && url.pathname === '/state') {
      return json(200, { version: APP_VERSION, windows: WIN, configured: !!(cfg.server && cfg.token), server: cfg.server || null, user: cfg.user || null, knownServer: cfg.server || embeddedServer() || null,
        pairing: pairing && { code: pairing.code, url: pairing.url }, agent: agent?.status() || null, autostart: !!cfg.autostart, discord: cfg.discordPresence !== false, discordConnected: !!presence?.connected, host: hostInfo, update: updateVersion });
    }
    if (req.method === 'GET' && url.pathname === '/tray/state') return json(200, trayState());
    if (req.method === 'POST' && url.pathname === '/tray/action') { await action(url.searchParams.get('name')); return json(200, { ok: true }); }
    if (req.method === 'POST' && url.pathname === '/show') { await action('open'); return json(200, { ok: true }); }
    if (req.method === 'POST' && url.pathname === '/action') { const b = await readBody(req); await action(b.name); return json(200, { ok: true }); }
    if (req.method === 'POST' && url.pathname === '/setup/connect') { const b = await readBody(req); return json(200, await beginPairing(b.server)); }
    if (req.method === 'POST' && url.pathname === '/setup/host') { const b = await readBody(req); const h = await startHost(!!b.demo); return json(200, await beginPairing(`http://localhost:${h.port}`)); }
    json(404, { error: 'Nicht gefunden' });
  } catch (e) { log('Fehler:', e.message); json(400, { error: e.message }); }
});

function startTray() {
  if (!WIN) return;
  try {
    const script = path.join(APPDATA, 'tray.ps1'); const ico = path.join(APPDATA, 'frachtwerk.ico');
    fs.writeFileSync(script, asset('tray.ps1')); fs.writeFileSync(ico, asset('icon.ico'));
    const started = Date.now();
    trayProc = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-WindowStyle', 'Hidden', '-File', script, '-Port', String(PORT), '-Icon', ico], { windowsHide: true, stdio: 'ignore' });
    trayProc.on('error', (e) => log('Tray-Fehler:', e.message));
    trayProc.on('exit', (code) => {
      trayProc = null; if (quitting) return;
      trayFails = Date.now() - started < 15_000 ? trayFails + 1 : 0;
      log('Tray beendet:', code, trayFails ? `(${trayFails}. Fehlstart)` : '');
      if (trayFails >= 3) { log('Tray-Symbol nicht verfügbar – Frachtwerk läuft ohne Symbol weiter.'); return openWindow(setupUrl('#settings')); }
      setTimeout(startTray, 3000);
    });
  } catch (e) { log('Tray konnte nicht starten:', e.message); }
}

function quit() {
  if (quitting) return; quitting = true;
  presence?.stop();
  log('Beende Frachtwerk');
  agent?.stop();
  setTimeout(() => { try { trayProc?.kill(); } catch {} process.exit(0); }, 2500); // Tray holt sich vorher das Beenden-Signal
}

// ---------------- Installation / Deinstallation ----------------
async function install() {
  fs.mkdirSync(INSTALL_DIR, { recursive: true });
  if (path.resolve(process.execPath).toLowerCase() !== path.resolve(INSTALLED_EXE).toLowerCase()) fs.copyFileSync(process.execPath, INSTALLED_EXE);
  await createShortcuts(INSTALLED_EXE);
  await registerUninstall(INSTALLED_EXE);
  if (cfg.autostart === undefined) await setAutostart(true); else if (cfg.autostart) await setAutostart(true);
  cfg.installedVersion = APP_VERSION; saveCfg();
  log('Installiert nach', INSTALLED_EXE);
}

async function uninstall() {
  await new Promise((r) => { const q = http.request({ host: '127.0.0.1', port: PORT, path: '/tray/action?name=quit', method: 'POST', timeout: 1500 }, (s) => { s.resume(); r(); }); q.on('error', r); q.end(); });
  await run('reg.exe', ['delete', RUN_KEY, '/v', 'Frachtwerk', '/f']);
  await run('reg.exe', ['delete', UNINSTALL_KEY, '/f']);
  for (const p of [path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Frachtwerk.lnk')]) try { fs.unlinkSync(p); } catch {}
  await ps(`Remove-Item -LiteralPath (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Frachtwerk.lnk') -ErrorAction SilentlyContinue`);
  for (const f of ['config.json', 'tray.ps1', 'frachtwerk.ico', 'tour.json', 'frachtwerk.log', 'frachtwerk.log.1']) try { fs.unlinkSync(path.join(APPDATA, f)); } catch {}
  // Programmordner nach dem Beenden löschen (über eine kleine Batch-Datei); Server-Daten (APPDATA\Server) bleiben erhalten
  const bat = path.join(os.tmpdir(), 'frachtwerk-uninstall.cmd');
  fs.writeFileSync(bat, `@echo off\r\nchcp 65001 >nul\r\nping -n 4 127.0.0.1 >nul\r\nrmdir /s /q "${INSTALL_DIR}"\r\ndel "%~f0"\r\n`);
  cp.spawn('cmd.exe', ['/d', '/c', bat], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
  messageBox(fs.existsSync(path.join(APPDATA, 'Server')) ? `Frachtwerk wurde entfernt.\n\nDie Daten deines Servers bleiben gesichert unter:\n${path.join(APPDATA, 'Server')}` : 'Frachtwerk wurde entfernt. Gute Fahrt!');
  setTimeout(() => process.exit(0), 1500);
}

// ---------------- Start ----------------
(async () => {
  log(`Frachtwerk ${APP_VERSION} startet`, process.execPath, argv.join(' '), VERSION_MARKER ? '' : '(Entwicklung)');
  if (flag('--uninstall')) return uninstall();

  // Start aus dem Download-Ordner: (neu) installieren und von dort starten.
  // Läuft schon eine ältere Version, wird sie vorher beendet.
  if (WIN && sea && !flag('--portable') && path.resolve(process.execPath).toLowerCase() !== path.resolve(INSTALLED_EXE).toLowerCase()) {
    try {
      if (await askRunning('/ping', 'GET')) {
        await askRunning('/tray/action?name=quit');
        for (let i = 0; i < 20 && (await askRunning('/ping', 'GET')); i++) await new Promise((r) => setTimeout(r, 500));
        await new Promise((r) => setTimeout(r, 1500)); // Datei freigeben lassen
      }
      const known = embeddedServer(); if (known && !cfg.server) { cfg.server = known; saveCfg(); }
      await install();
      cp.spawn(INSTALLED_EXE, ['--installed'], { detached: true, stdio: 'ignore' }).unref();
      return process.exit(0);
    } catch (e) { log('Installation fehlgeschlagen, starte direkt:', e.message); }
  }

  // Läuft schon? Dann nur das Fenster zeigen (z. B. Klick auf das Taskleisten-Symbol).
  if (await askRunning('/ping', 'GET')) { if (!flag('--background')) await askRunning('/show'); return process.exit(0); }
  if (flag('--installed') || flag('--updated')) { await registerUninstall(INSTALLED_EXE).catch(() => {}); if (cfg.autostart) await setAutostart(true); }

  await new Promise((resolve, reject) => { control.once('error', reject); control.listen(PORT, '127.0.0.1', resolve); }).catch((e) => { log('Steuerung belegt:', e.message); process.exit(0); });
  startTray();
  if (cfg.host?.enabled) await startHost(cfg.host.demo).catch((e) => { log('Server-Start fehlgeschlagen:', e.message); notify('Server konnte nicht starten', e.message); });
  if (!cfg.server && embeddedServer()) { cfg.server = embeddedServer(); saveCfg(); }
  await startAgent();

  if (flag('--updated')) notify(`Frachtwerk ${APP_VERSION} ist da`, 'Update erfolgreich installiert.');
  else if (!flag('--background')) openWindow(cfg.token ? appUrl('/app') : setupUrl());
  else if (!cfg.token) openWindow(setupUrl());
  if (flag('--installed')) notify('Frachtwerk ist installiert', 'Du findest Frachtwerk im Startmenü, auf dem Desktop und hier neben der Uhr.');
  setTimeout(checkUpdate, 15_000); setInterval(checkUpdate, 6 * 3600_000);
})();
