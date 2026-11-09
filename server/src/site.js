// Website-Inhalte, die Admins ohne Programmieren ändern: Logo, Startseite, Galerie, Impressum, Datenschutz
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db, get, run, DB_PATH } = require('./db');
const { auth } = require('./auth');

db.exec('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT)');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(path.dirname(DB_PATH), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DEFAULTS = {
  site_name: 'Frachtwerk',
  logo_url: '',
  hero_kicker: 'Für ETS2 & ATS · kostenlos',
  hero_title: 'Fahren. Abliefern.',
  hero_accent: 'Lohnzettel.',
  hero_text: 'Frachtwerk erfasst jede Tour aus ETS2 und ATS, rechnet den Lohn nach euren Regeln ab und zeigt eure Fahrer live auf der Karte. Kostenlos, für jede Spedition.',
  hero_image: '',
  gallery_title: 'Von der Straße',
  gallery: [],
  discord_url: '',
  discord_app_id: '',
  impressum: '',
  datenschutz: '',
};
const TEXT_LIMITS = { site_name: 40, logo_url: 200, hero_kicker: 80, hero_title: 80, hero_accent: 80, hero_text: 400, hero_image: 200, gallery_title: 60, discord_url: 200, discord_app_id: 22, impressum: 8000, datenschutz: 30000 };

function readSite() {
  const out = { ...DEFAULTS };
  for (const r of db.prepare('SELECT key, value FROM site_settings').all()) { try { out[r.key] = JSON.parse(r.value); } catch {} }
  return out;
}

// Erkennt Bildformat an den ersten Bytes (Dateiendung/Content-Type allein ist nicht vertrauenswürdig)
function imageType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('latin1', 0, 3) === 'GIF') return 'gif';
  return null;
}
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const localUpload = (u) => typeof u === 'string' && /^\/uploads\/[a-f0-9]{24}\.(png|jpg|webp|gif)$/.test(u);
const safeUrl = (u) => (typeof u === 'string' && (u === '' || localUpload(u) || /^https:\/\/[^\s"'<>]+$/.test(u)) ? u.slice(0, 300) : '');

const router = express.Router();

router.get('/api/site', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.json(readSite()); });

router.get('/uploads/:name', (req, res) => {
  const m = String(req.params.name).match(/^([a-f0-9]{24})\.(png|jpg|webp|gif)$/);
  const f = m && path.join(UPLOAD_DIR, req.params.name);
  if (!f || !fs.existsSync(f)) return res.status(404).end();
  res.setHeader('Content-Type', MIME[m[2]]); res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  fs.createReadStream(f).pipe(res);
});

const admin = [auth, (req, res, next) => (req.user?.is_admin ? next() : res.status(403).json({ error: 'Nur für Plattform-Admins' }))];

router.post('/api/admin/upload', admin, express.raw({ type: () => true, limit: '8mb' }), (req, res) => {
  const buf = req.body;
  const type = Buffer.isBuffer(buf) ? imageType(buf) : null;
  if (!type) return res.status(400).json({ error: 'Bitte ein Bild als PNG, JPG, WebP oder GIF hochladen (max. 8 MB)' });
  const name = `${crypto.randomBytes(12).toString('hex')}.${type}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  res.json({ url: `/uploads/${name}` });
});

router.put('/api/admin/site', admin, express.json({ limit: '200kb' }), (req, res) => {
  const b = req.body || {};
  const save = (k, v) => run('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, JSON.stringify(v));
  for (const [k, max] of Object.entries(TEXT_LIMITS)) {
    if (b[k] === undefined) continue;
    let v = String(b[k] ?? '').slice(0, max);
    if (['logo_url', 'hero_image', 'discord_url'].includes(k)) v = safeUrl(v);
    if (k === 'discord_app_id' && !/^(\d{15,22})?$/.test(v)) return res.status(400).json({ error: 'Die Discord Application ID besteht nur aus Ziffern (15–22 Stellen).' });
    save(k, v);
  }
  if (Array.isArray(b.gallery)) save('gallery', b.gallery.slice(0, 24).map((g) => ({ url: safeUrl(g?.url), caption: String(g?.caption || '').slice(0, 120) })).filter((g) => g.url));
  res.json(readSite());
});

module.exports = { siteRouter: router, readSite };
