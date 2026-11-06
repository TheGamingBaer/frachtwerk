// Baut Frachtwerk-Client.exe und Frachtwerk-Server.exe als Node "Single Executable Applications".
//   cd packaging && npm install && node build.mjs [--linux]
// Voraussetzung: dieselbe Node-Version wie die eingebettete node.exe (siehe NODE_VERSION).
import { build } from 'esbuild';
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync, chmodSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'dist-exe');
const TMP = join(HERE, '.cache', 'build');
const NODE_VERSION = '22.23.4';
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const alsoLinux = process.argv.includes('--linux');
mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });

if (process.versions.node !== NODE_VERSION) { console.error(`Bitte mit Node ${NODE_VERSION} bauen (aktuell ${process.versions.node}).`); process.exit(1); }

// Windows-node.exe aus dem npm-Paket node-win-x64 holen
function winNode() {
  const dir = join(HERE, '.cache', 'node-win');
  const exe = join(dir, 'package', 'bin', 'node.exe');
  if (!existsSync(exe)) {
    mkdirSync(dir, { recursive: true });
    const tgz = execFileSync('npm', ['pack', `node-win-x64@${NODE_VERSION}`, '--silent'], { cwd: join(HERE, '.cache') }).toString().trim().split('\n').pop();
    execFileSync('tar', ['-xzf', join(HERE, '.cache', tgz), '-C', dir]);
  }
  return exe;
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
  execFileSync(process.execPath, [join(HERE, 'node_modules', 'postject', 'dist', 'cli.js'), out, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', FUSE], { stdio: 'inherit' });
  console.log(`✔ ${relative(ROOT, out)} (${(statSync(out).size / 1048576).toFixed(0)} MB)`);
}

const bundle = (entry, outfile) => build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', target: 'node22', format: 'cjs', minify: true, legalComments: 'none', logLevel: 'warning' });

// ---------- Client ----------
await bundle(join(ROOT, 'client', 'frachtwerk-client.js'), join(TMP, 'client.cjs'));
const clientBlob = seaBlob('client', join(TMP, 'client.cjs'));

// ---------- Server ----------
const dist = join(ROOT, 'web', 'dist');
if (!existsSync(join(dist, 'index.html'))) { console.error('web/dist fehlt – zuerst "npm run build" im Hauptordner ausführen.'); process.exit(1); }
const assets = {}; const manifest = {};
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else { const url = '/' + relative(dist, p).split('\\').join('/'); const key = `web${url}`; assets[key] = p; manifest[url] = key; } });
walk(dist);
assets['web/__client.js'] = join(ROOT, 'client', 'frachtwerk-client.js'); manifest['/__client.js'] = 'web/__client.js';
writeFileSync(join(TMP, 'manifest.json'), JSON.stringify(manifest));
assets['manifest.json'] = join(TMP, 'manifest.json');
await bundle(join(HERE, 'server-entry.js'), join(TMP, 'server.cjs'));
const serverBlob = seaBlob('server', join(TMP, 'server.cjs'), assets);

// ---------- Programme erzeugen ----------
const win = winNode();
inject(win, clientBlob, join(OUT, 'Frachtwerk-Client.exe'), true);
inject(win, serverBlob, join(OUT, 'Frachtwerk-Server.exe'), true);
if (alsoLinux) {
  inject(process.execPath, clientBlob, join(OUT, 'frachtwerk-client-linux'), false);
  inject(process.execPath, serverBlob, join(OUT, 'frachtwerk-server-linux'), false);
}
console.log(`\nFertig → ${OUT}`);
