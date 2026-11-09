// Baut die Windows-Programme als Node "Single Executable Applications":
//   dist-exe/Frachtwerk.exe          Desktop-App (Fahrer & Betreiber) – ohne Konsolenfenster, mit Tray-Symbol
//   dist-exe/Frachtwerk-Server.exe   reiner Server mit Konsolenfenster (z. B. für einen Server-PC)
//
//   cd packaging && npm ci && node build.mjs [--linux]
// Voraussetzung: Node-Version = NODE_VERSION (muss zur eingebetteten node.exe passen).
import { build } from 'esbuild';
import * as ResEdit from 'resedit';
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync, chmodSync, rmSync } from 'fs';
import { join, relative, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'dist-exe');
const TMP = join(HERE, '.cache', 'build');
const NODE_VERSION = '22.23.4';
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const ICON = join(HERE, 'assets', 'icon.ico');
const alsoLinux = process.argv.includes('--linux');
mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });
for (const old of ['Frachtwerk-Client.exe', 'frachtwerk-client-linux']) rmSync(join(OUT, old), { force: true }); // ersetzt durch Frachtwerk.exe

if (process.versions.node !== NODE_VERSION) { console.error(`Bitte mit Node ${NODE_VERSION} bauen (aktuell ${process.versions.node}).`); process.exit(1); }
console.log(`Frachtwerk ${VERSION}`);

// Windows-node.exe aus dem npm-Paket node-win-x64
function winNode() {
  const dir = join(HERE, '.cache', 'node-win');
  const exe = join(dir, 'package', 'bin', 'node.exe');
  if (!existsSync(exe)) {
    mkdirSync(dir, { recursive: true });
    const tgz = execFileSync('npm', ['pack', `node-win-x64@${NODE_VERSION}`, '--silent'], { cwd: join(HERE, '.cache'), shell: process.platform === 'win32' }).toString().trim().split('\n').pop();
    execFileSync('tar', ['-xzf', join(HERE, '.cache', tgz), '-C', dir]);
  }
  return exe;
}

/** Icon, Versionsinfo und (optional) Fenster-Subsystem in eine Kopie von node.exe schreiben */
function brand(src, dest, { gui, description, filename }) {
  const exe = ResEdit.NtExecutable.from(readFileSync(src), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const ico = ResEdit.Data.IconFile.from(readFileSync(ICON));
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groups[0]?.id ?? 1, groups[0]?.lang ?? 1033, ico.icons.map((i) => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
  const [a, b, c] = VERSION.split('.').map(Number);
  vi.setFileVersion(a, b, c, 0); vi.setProductVersion(a, b, c, 0);
  const lang = vi.getAllLanguagesForStringValues()[0] || { lang: 1033, codepage: 1200 };
  for (const k of ['Comments', 'PrivateBuild', 'SpecialBuild', 'LegalTrademarks']) try { vi.removeStringValue(lang, k); } catch {}
  vi.setStringValues(lang, { ProductName: 'Frachtwerk', FileDescription: description, CompanyName: 'Frachtwerk', LegalCopyright: 'Frachtwerk – Open Source',
    OriginalFilename: filename, InternalName: filename.replace(/\.exe$/, ''), ProductVersion: VERSION, FileVersion: VERSION });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  const out = Buffer.from(exe.generate());
  if (gui) { const pe = out.readUInt32LE(0x3c); out.writeUInt16LE(2, pe + 24 + 68); } // IMAGE_SUBSYSTEM_WINDOWS_GUI: kein Konsolenfenster
  writeFileSync(dest, out);
  return dest;
}

function seaBlob(name, main, assets) {
  const cfg = { main, output: join(TMP, `${name}.blob`), disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false, ...(assets ? { assets } : {}) };
  const cfgFile = join(TMP, `${name}.sea.json`);
  writeFileSync(cfgFile, JSON.stringify(cfg));
  execFileSync(process.execPath, ['--experimental-sea-config', cfgFile], { stdio: 'inherit' });
  return cfg.output;
}

function inject(base, blob, out, isWin) {
  copyFileSync(base, out);
  if (!isWin) chmodSync(out, 0o755);
  execFileSync(process.execPath, [join(HERE, 'node_modules', 'postject', 'dist', 'cli.js'), out, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', FUSE], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (!isWin) console.log(`✔ ${relative(ROOT, out)} (${(statSync(out).size / 1048576).toFixed(0)} MB)`);
}

const bundle = (entry, outfile) => build({
  entryPoints: [entry], outfile, bundle: true, platform: 'node', target: 'node22', format: 'cjs', minify: true, legalComments: 'none', logLevel: 'warning',
  define: { __APP_VERSION__: JSON.stringify(VERSION), __APP_MARKER__: JSON.stringify(`FRACHTWERK_APP_VERSION=${VERSION}`) },
});

// ---------- Eingebettete Web-App (für den Server-Teil) ----------
const dist = join(ROOT, 'web', 'dist');
if (!existsSync(join(dist, 'index.html'))) { console.error('web/dist fehlt – zuerst "npm run build" im Hauptordner ausführen.'); process.exit(1); }
const webAssets = {}; const manifest = {};
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else { const url = '/' + relative(dist, p).split('\\').join('/'); const key = `web${url}`; webAssets[key] = p; manifest[url] = key; } });
walk(dist);
webAssets['web/__client.js'] = join(ROOT, 'client', 'frachtwerk-client.js'); manifest['/__client.js'] = 'web/__client.js';
webAssets['web/__agent.js'] = join(ROOT, 'client', 'agent.js'); manifest['/__agent.js'] = 'web/__agent.js';
writeFileSync(join(TMP, 'manifest.json'), JSON.stringify(manifest));
webAssets['manifest.json'] = join(TMP, 'manifest.json');

// ---------- Eigenes Fenster (C#/WebView2) ----------
const WIN_DIR = join(HERE, 'window', 'bin', 'Release', 'net48');
execFileSync('dotnet', ['build', join(HERE, 'window', 'FrachtwerkWindow.csproj'), '-c', 'Release', '-nologo', '-v', 'q', `-p:Version=${VERSION}`], { stdio: ['ignore', 'ignore', 'inherit'] });
const windowAssets = {
  'window/FrachtwerkFenster.exe': join(WIN_DIR, 'FrachtwerkFenster.exe'),
  'window/FrachtwerkFenster.exe.config': join(WIN_DIR, 'FrachtwerkFenster.exe.config'),
  'window/Microsoft.Web.WebView2.Core.dll': join(WIN_DIR, 'Microsoft.Web.WebView2.Core.dll'),
  'window/Microsoft.Web.WebView2.WinForms.dll': join(WIN_DIR, 'Microsoft.Web.WebView2.WinForms.dll'),
  'window/WebView2Loader.dll': join(WIN_DIR, 'runtimes', 'win-x64', 'native', 'WebView2Loader.dll'),
};
for (const f of Object.values(windowAssets)) if (!existsSync(f)) { console.error('Fehlt:', f); process.exit(1); }
console.log('✔ Fenster (WebView2) gebaut');

// ---------- Desktop-App ----------
await bundle(join(HERE, 'app', 'main.js'), join(TMP, 'app.cjs'));
const appBlob = seaBlob('app', join(TMP, 'app.cjs'), {
  ...webAssets, ...windowAssets,
  'setup.html': join(HERE, 'app', 'setup.html'), 'tray.ps1': join(HERE, 'app', 'tray.ps1'),
  'icon.ico': ICON, 'icon.png': join(HERE, 'assets', 'icon-256.png'),
});

// ---------- Server (Konsole) ----------
await bundle(join(HERE, 'server-entry.js'), join(TMP, 'server.cjs'));
const serverBlob = seaBlob('server', join(TMP, 'server.cjs'), webAssets);

// ---------- Programme erzeugen ----------
// Reihenfolge wichtig: erst Programmpaket einbetten (postject), danach Icon/Version/Subsystem setzen (resedit).
const win = winNode();
function make(blob, name, opts) {
  const tmp = join(TMP, name);
  inject(win, blob, tmp, true);
  brand(tmp, join(OUT, name), { ...opts, filename: name });
  console.log(`✔ dist-exe/${name} (${(statSync(join(OUT, name)).size / 1048576).toFixed(0)} MB)`);
}
make(appBlob, 'Frachtwerk.exe', { gui: true, description: 'Frachtwerk' });
make(serverBlob, 'Frachtwerk-Server.exe', { gui: false, description: 'Frachtwerk Server' });
if (alsoLinux) {
  inject(process.execPath, appBlob, join(OUT, 'frachtwerk-app-linux'), false);
  inject(process.execPath, serverBlob, join(OUT, 'frachtwerk-server-linux'), false);
}
console.log(`\nFertig → ${OUT}`);
