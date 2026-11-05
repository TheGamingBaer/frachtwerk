const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const { api } = require('./api');
const { discordRouter } = require('./discord');

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
app.use('/api/auth', discordRouter);
app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Unbekannter Endpunkt' }));

// Client-Download (Telemetrie-Bridge)
const clientDir = path.join(__dirname, '..', '..', 'client');
app.get('/download/frachtwerk-client.js', (req, res) => res.download(path.join(clientDir, 'frachtwerk-client.js')));

// Gebaute Web-App ausliefern (SPA)
const dist = path.join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Serverfehler' });
});

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => console.log(`🚚 Frachtwerk läuft auf http://localhost:${PORT}`));
