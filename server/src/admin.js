// Plattform-Verwaltung (nur is_admin) + Passwort vergessen
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { get, all, run } = require('./db');
const { auth } = require('./auth');
const Backup = require('./backup');
const { sendMail, resetMail, mailEnabled } = require('./mail');

const router = express.Router();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const baseUrl = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

function createResetLink(req, user) {
  const token = crypto.randomBytes(32).toString('base64url');
  run('UPDATE users SET reset_hash=?, reset_expires=? WHERE id=?', sha(token), Date.now() + 3600_000, user.id);
  return `${baseUrl(req)}/reset?token=${token}`;
}

// ---------- Passwort vergessen ----------
const hits = new Map();
router.post('/auth/forgot', async (req, res) => {
  const k = req.ip; const now = Date.now();
  const h = (hits.get(k) || []).filter((t) => now - t < 15 * 60_000);
  if (h.length >= 5) return res.status(429).json({ error: 'Zu viele Anfragen – bitte später erneut versuchen' });
  h.push(now); hits.set(k, h);
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = email ? get('SELECT * FROM users WHERE email=? AND banned=0', email) : null;
  // Immer gleiche Antwort, damit niemand prüfen kann, welche E-Mails registriert sind
  res.json({ ok: true, mail: mailEnabled() });
  if (user && mailEnabled()) {
    const link = createResetLink(req, user); const m = resetMail(user.display_name, link);
    sendMail(user.email, 'Frachtwerk – neues Passwort', m.text, m.html).catch((e) => console.error('Mail fehlgeschlagen:', e.message));
  }
});

router.post('/auth/reset', (req, res) => {
  const token = String(req.body.token || '');
  const pw = String(req.body.password || '');
  if (pw.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
  const user = token ? get('SELECT * FROM users WHERE reset_hash=?', sha(token)) : null;
  if (!user || !user.reset_expires || user.reset_expires < Date.now()) return res.status(400).json({ error: 'Link ungültig oder abgelaufen' });
  run('UPDATE users SET password_hash=?, has_password=1, reset_hash=NULL, reset_expires=NULL WHERE id=?', bcrypt.hashSync(pw, 10), user.id);
  res.json({ ok: true, username: user.username });
});

// ---------- Admin ----------
const admin = (req, res, next) => (req.user?.is_admin ? next() : res.status(403).json({ error: 'Nur für Plattform-Admins' }));
router.use('/admin', auth, admin);

router.get('/admin/overview', (req, res) => {
  const n = (sql, ...p) => get(sql, ...p).n;
  res.json({
    users: n('SELECT COUNT(*) n FROM users'), banned: n('SELECT COUNT(*) n FROM users WHERE banned=1'),
    companies: n('SELECT COUNT(*) n FROM companies'), jobs: n("SELECT COUNT(*) n FROM jobs WHERE status='delivered'"),
    jobs_week: n("SELECT COUNT(*) n FROM jobs WHERE status='delivered' AND finished_at >= datetime('now','-7 days')"),
    users_week: n("SELECT COUNT(*) n FROM users WHERE created_at >= datetime('now','-7 days')"),
    live: n('SELECT COUNT(*) n FROM live WHERE updated_at > ?', Date.now() - 90_000),
    mail: mailEnabled(), discord: !!process.env.DISCORD_CLIENT_ID, backups: Backup.list().slice(0, 30), backup_dir: Backup.BACKUP_DIR,
  });
});

router.get('/admin/users', (req, res) => {
  const s = `%${String(req.query.q || '').slice(0, 60)}%`;
  res.json(all(`SELECT u.id, u.username, u.display_name, u.email, u.avatar_hue, u.avatar_url, u.is_admin, u.banned, u.created_at, u.discord_name,
      c.name company_name, c.tag company_tag, m.role,
      (SELECT COUNT(*) FROM jobs j WHERE j.user_id=u.id AND j.status='delivered') jobs
    FROM users u LEFT JOIN memberships m ON m.user_id=u.id LEFT JOIN companies c ON c.id=m.company_id
    WHERE u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ? ORDER BY u.created_at DESC LIMIT 200`, s, s, s));
});

router.patch('/admin/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Du kannst dich nicht selbst ändern' });
  const u = get('SELECT * FROM users WHERE id=?', id);
  if (!u) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  if (req.body.banned !== undefined) {
    run('UPDATE users SET banned=? WHERE id=?', req.body.banned ? 1 : 0, id);
    if (req.body.banned) run('DELETE FROM live WHERE user_id=?', id);
  }
  if (req.body.is_admin !== undefined) run('UPDATE users SET is_admin=? WHERE id=?', req.body.is_admin ? 1 : 0, id);
  res.json({ ok: true });
});

router.post('/admin/users/:id/reset-link', (req, res) => {
  const u = get('SELECT * FROM users WHERE id=?', Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  res.json({ link: createResetLink(req, u), expires_in: '1 Stunde' });
});

router.get('/admin/companies', (req, res) => {
  res.json(all(`SELECT c.id, c.name, c.tag, c.slug, c.hue, c.created_at, c.balance, u.display_name owner,
      (SELECT COUNT(*) FROM memberships m WHERE m.company_id=c.id) members,
      (SELECT COUNT(*) FROM jobs j WHERE j.company_id=c.id AND j.status='delivered') jobs
    FROM companies c LEFT JOIN users u ON u.id=c.owner_id ORDER BY c.created_at DESC`));
});

router.delete('/admin/companies/:id', (req, res) => {
  run('DELETE FROM companies WHERE id=?', Number(req.params.id)); res.json({ ok: true });
});

router.post('/admin/backups', (req, res) => {
  try { res.json({ name: Backup.backup() }); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/admin/backups/:name', (req, res) => {
  const f = Backup.filePath(req.params.name);
  if (!f || !fs.existsSync(f)) return res.status(404).json({ error: 'Backup nicht gefunden' });
  res.download(f);
});

module.exports = { adminRouter: router };
