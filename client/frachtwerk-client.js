#!/usr/bin/env node
/**
 * Frachtwerk Telemetrie-Client (Konsole) – für Mac/Linux oder ohne Desktop-App.
 * Unter Windows ist Frachtwerk.exe (Desktop-App mit Tray-Icon) die bequemere Variante.
 *
 *   node frachtwerk-client.js                        Einrichtung per Code im Browser
 *   node frachtwerk-client.js --server URL --token fw_…
 *   node frachtwerk-client.js --demo                 simulierte Tour ohne Spiel
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const A = require('./agent');

let isSea = false; try { isSea = require('node:sea').isSea(); } catch {}
const BASE = isSea ? path.dirname(process.execPath) : __dirname;
const C = { r: '\x1b[0m', d: '\x1b[2m', o: '\x1b[38;5;214m', g: '\x1b[32m', c: '\x1b[36m', red: '\x1b[31m', b: '\x1b[1m' };
const log = (...m) => console.log(`${C.d}${new Date().toLocaleTimeString('de-DE')}${C.r}`, ...m);
const eur = (n) => (n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

// Eingabe mit Zeilen-Warteschlange (funktioniert auch bei schneller/umgeleiteter Eingabe)
let rl = null; const lines = []; const waiting = [];
const ask = (q) => new Promise((r) => {
  if (!rl) {
    let input; try { input = process.stdin; } catch { process.stdout.write(q + '\n'); return r(''); }
    rl = readline.createInterface({ input, terminal: !!input.isTTY, output: process.stdout });
    rl.on('line', (l) => (waiting.length ? waiting.shift()(l) : lines.push(l)));
    rl.on('close', () => { while (waiting.length) waiting.shift()(''); });
  }
  process.stdout.write(q);
  const done = (a) => r(String(a).trim());
  lines.length ? done(lines.shift()) : waiting.push(done);
});
const doneAsking = () => { rl?.close(); rl = null; };
async function fatal(msg) { console.error(msg); if (isSea || process.platform === 'win32') await ask('\nEnter drücken zum Beenden …'); process.exit(1); }

// ---------------- Konfiguration ----------------
const args = process.argv.slice(2);
const arg = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : def; };
const cfgPath = path.join(BASE, 'frachtwerk.json');
let fileCfg = {}; try { fileCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
const CFG = {
  server: arg('server', fileCfg.server || process.env.FRACHTWERK_SERVER || ''),
  token: arg('token', fileCfg.token || process.env.FRACHTWERK_TOKEN || ''),
  telemetry: arg('telemetry', fileCfg.telemetry || 'http://localhost:25555/api/ets2/telemetry'),
  interval: Number(arg('interval', fileCfg.interval || 1000)),
  demo: !!arg('demo', false),
};
const saveCfg = (extra = {}) => { let cur = {}; try { cur = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {} fs.writeFileSync(cfgPath, JSON.stringify({ ...cur, server: CFG.server, token: CFG.token, ...extra }, null, 2)); };
const openBrowser = (url) => require('child_process').exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`, () => {});

async function setup() {
  console.log(`\n${C.o}${C.b}  ▲ FRACHTWERK${C.r} ${C.d}Einrichtung${C.r}\n`);
  let server = typeof CFG.server === 'string' && CFG.server ? CFG.server.replace(/\/$/, '') : null;
  if (!server || !(await A.reachable(server))) {
    server = null;
    for (const cand of ['http://localhost:8080', 'http://127.0.0.1:8080']) if (await A.reachable(cand)) { server = cand; break; }
  }
  while (!server) {
    const a = await ask('Adresse deines Frachtwerk-Servers (z. B. https://frachtwerk.meine-firma.de): ');
    if (!a) return fatal('Keine Adresse angegeben.');
    const cand = (/^https?:\/\//.test(a) ? a : `https://${a}`).replace(/\/$/, '');
    if (await A.reachable(cand)) server = cand; else console.log(`${C.red}Unter ${cand} läuft kein Frachtwerk.${C.r}`);
  }
  CFG.server = server;
  log(`${C.g}✔ Server:${C.r} ${server}`);
  const p = await A.startPairing(server).catch(() => null);
  if (p) {
    const url = `${server}/app/pair?code=${p.code}`;
    console.log(`\n  Dein Code:  ${C.o}${C.b}${p.code.split('').join(' ')}${C.r}\n`);
    console.log(`  Ich öffne deinen Browser – dort auf ${C.b}„Verbinden“${C.r} klicken.`);
    console.log(`  ${C.d}Falls sich nichts öffnet: ${url}${C.r}\n`);
    openBrowser(url);
    const d = await A.pollPairing(server, p.secret, { timeoutMs: p.expires_in * 1000 });
    if (d) { CFG.token = d.token; saveCfg(); log(`${C.g}✔ Verbunden mit ${C.b}${d.user}${C.r}`); return; }
    console.log(`${C.red}Die Kopplung ist abgelaufen.${C.r}`);
  }
  console.log('Alternativ: Token aus Frachtwerk → „App herunterladen“ → „Erweitert“ einfügen.');
  for (let i = 0; i < 3; i++) {
    const t = await ask('API-Token (beginnt mit fw_): ');
    if (/^fw_[\w-]{10,}$/.test(t)) { CFG.token = t; saveCfg(); return; }
    console.log(`${C.red}Das sieht nicht nach einem Token aus.${C.r}`);
  }
  return fatal('Einrichtung abgebrochen. Starte den Client einfach neu.');
}

async function ensureFunbit() {
  if (CFG.demo || process.platform !== 'win32') return;
  try { if ((await A.request(CFG.telemetry, { timeout: 2000 })).ok) return; } catch {}
  let exe = A.findFunbit(fileCfg.funbit);
  if (!exe) {
    console.log(`\n${C.o}Für die Spieldaten brauchst du einmalig den kostenlosen Funbit ETS2 Telemetry Server.${C.r}`);
    const a = (await ask('Soll ich ihn jetzt herunterladen und starten? [J/n]: ')).toLowerCase();
    if (a === 'n' || a === 'nein') return;
    try { exe = await A.installFunbit((t) => log(t)); saveCfg({ funbit: exe }); console.log(`\n${C.o}${C.b}  Einmalig: Im Funbit-Fenster auf „Install“ klicken.${C.r}\n`); }
    catch (e) { console.log(`${C.red}Automatische Einrichtung fehlgeschlagen:${C.r} ${e.message}\nBitte manuell: https://github.com/Funbit/ets2-telemetry-server`); return; }
  }
  log('Starte Funbit Telemetry Server …');
  A.startFunbit(exe);
}

(async () => {
  if (!CFG.token || CFG.token === true) await setup();
  console.log(`\n${C.o}${C.b}  ▲ FRACHTWERK${C.r} ${C.d}Telemetrie-Client${C.r}\n`);
  for (let attempt = 0; ; attempt++) {
    try {
      const me = await A.api(CFG.server, CFG.token)('/client/ping');
      log(`Angemeldet als ${C.b}${me.user}${C.r}${me.company ? ` · ${me.company}` : ' · Freifahrer'}  ${C.d}(${CFG.server})${C.r}`);
      break;
    } catch (e) {
      if (e.status === 401 && attempt === 0) { log(`${C.red}Gespeicherte Anmeldung ungültig – neu verbinden.${C.r}`); CFG.token = ''; await setup(); continue; }
      return fatal(`${C.red}Verbindung zu Frachtwerk fehlgeschlagen:${C.r} ${e.message}\nIst der Server ${CFG.server} erreichbar?`);
    }
  }
  doneAsking();
  await ensureFunbit();
  doneAsking();

  const agent = A.createAgent({ server: CFG.server, token: CFG.token, telemetry: CFG.telemetry, interval: CFG.interval, stateFile: path.join(BASE, '.frachtwerk-state.json'), liveEvery: CFG.demo ? 1500 : 3000 });
  agent.on('log', (t) => log(t));
  agent.on('status', ({ state, text }) => {
    const col = { driving: C.g, idle: C.g, 'waiting-game': C.d, 'no-telemetry': C.red, offline: C.red, auth: C.red }[state] || '';
    log(`${col}● ${text}${C.r}${state === 'no-telemetry' ? `\n         → Ets2Telemetry.exe (Funbit) starten und einmal „Install“ klicken. Ich versuche es weiter …` : ''}`);
  });
  agent.on('job-start', (j) => log(`${C.o}▶ Tour gestartet${C.r} #${j.id}  ${C.b}${j.from} → ${j.to}${C.r}  ${j.cargo} (${j.cargo_mass.toFixed(1)} t)  ${eur(j.income)}`));
  agent.on('job-finish', ({ job, result, delivered }) => delivered
    ? log(`${C.g}✔ Abgeliefert${C.r} #${job.id}  ${result.driven_km} km · ${result.fuel_used} l · ${result.damage} % Schaden  →  Lohn ${C.b}${eur(result.payout)}${C.r} (${result.review === 'approved' ? 'freigegeben' : 'in Prüfung'})`)
    : log(`${C.red}✖ Tour abgebrochen${C.r} #${job.id}`));

  if (CFG.demo) {
    log(`${C.c}Demo-Modus: simuliere eine Tour im Zeitraffer…${C.r}`);
    const feed = A.demoFeed(() => { log(`${C.c}Demo beendet.${C.r} Schau dir die Tour in Frachtwerk an!`); process.exit(0); });
    setInterval(() => agent.feed(feed()), 400);
  } else {
    log(`Lese Telemetrie von ${CFG.telemetry}`);
    agent.start();
  }
  process.on('SIGINT', () => { agent.stop(); console.log('\nBis zur nächsten Tour! 🚚'); process.exit(0); });
})();
