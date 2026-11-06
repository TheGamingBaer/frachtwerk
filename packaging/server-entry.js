// Startprogramm für Frachtwerk-Server.exe
// Daten liegen im Ordner "Frachtwerk-Daten" neben der .exe. Web-App & Client sind eingebettet.
process.removeAllListeners('warning');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { exec } = require('child_process');

let sea = null; try { sea = require('node:sea'); if (!sea.isSea()) sea = null; } catch {}
const BASE = sea ? path.dirname(process.execPath) : path.join(__dirname, '..');
const DATA = path.join(BASE, 'Frachtwerk-Daten');
fs.mkdirSync(DATA, { recursive: true });

// Einstellungen aus Frachtwerk-Daten/einstellungen.env (KEY=WERT pro Zeile) übernehmen
const envFile = path.join(DATA, 'einstellungen.env');
if (!fs.existsSync(envFile)) {
  fs.writeFileSync(envFile, [
    '# Frachtwerk-Einstellungen – Zeilen ohne # werden beim Start übernommen.',
    '# PORT=8080',
    '# PUBLIC_URL=https://deine-adresse.de',
    '# DISCORD_CLIENT_ID=', '# DISCORD_CLIENT_SECRET=',
    '# SMTP_HOST=', '# SMTP_PORT=587', '# SMTP_USER=', '# SMTP_PASS=', '# SMTP_FROM=Frachtwerk <noreply@example.de>', '',
  ].join('\r\n'));
}
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
process.env.DB_PATH ||= path.join(DATA, 'frachtwerk.db');
process.env.DOWNLOADS_DIR ||= BASE; // Frachtwerk-Client.exe neben dem Server wird zum Download angeboten

// Eingebettete Web-App laden
if (sea) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const manifest = JSON.parse(sea.getAsset('manifest.json', 'utf8'));
  const map = new Map();
  for (const [url, key] of Object.entries(manifest)) map.set(url, { body: Buffer.from(sea.getAsset(key)), type: TYPES[path.extname(url)] || 'application/octet-stream' });
  global.FW_EMBEDDED = map;
}

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
  const done = (a) => r(String(a).trim().toLowerCase());
  lines.length ? done(lines.shift()) : waiting.push(done);
});
const doneAsking = () => { rl?.close(); rl = null; };
const open = (url) => exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`, () => {});

(async () => {
  console.log('\n\x1b[38;5;214m\x1b[1m  ▲ FRACHTWERK\x1b[0m \x1b[2mServer\x1b[0m');
  console.log(`\x1b[2m  Daten: ${DATA}\x1b[0m\n`);
  const { get } = require('../server/src/db');
  const firstRun = !get('SELECT id FROM users LIMIT 1');
  let demo = false;
  if (firstRun) {
    console.log('Erster Start! Möchtest du Demo-Daten (Beispielfirma „Nordlicht Logistik“, Login demo / demo1234)?');
    demo = process.argv.includes('--demo') || (!process.argv.includes('--no-demo') && ['j', 'ja', 'y', 'yes'].includes(await ask('Demo-Daten anlegen? [j/N]: ')));
    if (demo) require('../server/src/seed').seedDemo();
    else console.log('→ Leere Instanz. Der erste Benutzer, der sich registriert, wird Plattform-Admin.');
  }
  const port = Number(process.env.PORT) || 8080;
  try { await require('../server/src/index').start(port); }
  catch (e) {
    console.error(`\x1b[31mPort ${port} ist belegt.\x1b[0m Läuft Frachtwerk schon? Sonst PORT=… in ${envFile} setzen.`);
    await ask('\nEnter drücken zum Beenden …'); process.exit(1);
  }
  const url = `http://localhost:${port}`;
  const hasDemo = !!get("SELECT id FROM users WHERE username='demo'");
  if (hasDemo && (demo || process.argv.includes('--simulate') || (!process.argv.includes('--no-simulate') && ['j', 'ja', 'y'].includes(await ask('Live-Simulation starten (Demo-Fahrer fahren über die Karte)? [j/N]: '))))) {
    require('../server/scripts/simulate').simulate({ server: url, drivers: 8, speed: 9 });
  }
  // Client gleich mitstarten, wenn er daneben liegt (Windows)
  const clientExe = path.join(BASE, 'Frachtwerk-Client.exe');
  if (process.platform === 'win32' && fs.existsSync(clientExe) && !process.argv.includes('--no-client')) {
    const a = await ask('Frachtwerk-Client (für ETS2) auch starten? [J/n]: ');
    if (a !== 'n' && a !== 'nein') exec(`start "Frachtwerk Client" "${clientExe}"`, { cwd: BASE }, () => {});
  }
  doneAsking();
  console.log(`\n  👉 Öffne \x1b[1m${url}\x1b[0m im Browser${hasDemo ? ' (Demo-Login: demo / demo1234)' : ''}`);
  console.log('  Fenster offen lassen, solange Frachtwerk laufen soll. Beenden mit Strg+C.\n');
  if (!process.argv.includes('--no-browser')) open(hasDemo ? `${url}/login?demo=1` : url);
})();
