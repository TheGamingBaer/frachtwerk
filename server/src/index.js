const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const { api } = require('./api');
const { discordRouter } = require('./discord');
const { adminRouter } = require('./admin');
const Backup = require('./backup');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression({ filter: (req, res) => !req.path.includes('stream') && compression.filter(req, res) }));
app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'Frachtwerk', time: new Date().toISOString() }));
const downloadsDir = process.env.DOWNLOADS_DIR || path.join(__dirname, '..', '..', 'downloads');
app.get('/api/downloads', (req, res) => res.json({ client_exe: fs.existsSync(path.join(downloadsDir, 'Frachtwerk-Client.exe')) }));
app.use('/api/auth', discordRouter);
app.use('/api', adminRouter);
app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Unbekannter Endpunkt' }));

// Eingebettete Dateien (Frachtwerk-Server.exe) oder Dateisystem
const embedded = global.FW_EMBEDDED || null; // Map: '/pfad' -> { body: Buffer, type }
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

// Client-Download (Telemetrie-Bridge)
const clientDir = path.join(__dirname, '..', '..', 'client');
app.get('/download/frachtwerk-client.js', (req, res) => {
  if (embedded?.has('/__client.js')) { res.setHeader('Content-Disposition', 'attachment; filename="frachtwerk-client.js"'); return res.type('text/javascript').send(embedded.get('/__client.js').body); }
  res.download(path.join(clientDir, 'frachtwerk-client.js'));
});
// Fertige Windows-Programme, falls neben dem Server abgelegt (downloads/Frachtwerk-Client.exe)
app.get('/download/:file', (req, res, next) => {
  const f = path.join(downloadsDir, path.basename(req.params.file));
  fs.existsSync(f) ? res.download(f) : next();
});

// Gebaute Web-App ausliefern (SPA)
if (embedded) {
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    const f = embedded.get(req.path);
    if (f && req.path !== '/__client.js') { res.setHeader('Cache-Control', req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'); return res.type(f.type).send(f.body); }
    if (req.path.startsWith('/api/') || req.path.startsWith('/download/')) return next();
    const idx = embedded.get('/index.html'); res.type('text/html; charset=utf-8').send(idx.body);
  });
} else {
  const dist = path.join(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Serverfehler' });
});

function start(port = Number(process.env.PORT) || 8080) {
  return new Promise((resolve, reject) => {
    const srv = app.listen(port, () => { console.log(`🚚 Frachtwerk läuft auf http://localhost:${port}`); Backup.schedule(); resolve(srv); });
    srv.on('error', reject);
  });
}

module.exports = { app, start, TYPES };
if (require.main === module) start();
