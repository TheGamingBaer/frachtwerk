const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { get } = require('./db');
const { membership } = require('./logic');

// JWT-Secret: aus ENV oder einmalig generiert und gespeichert
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const f = path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'x')), '.jwt-secret');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();

const sign = (user) => jwt.sign({ uid: user.id }, SECRET, { expiresIn: '30d' });
const newApiToken = () => 'fw_' + crypto.randomBytes(24).toString('base64url');

/** Nur Login-JWT (kein API-Token) */
function loadUserFromToken(token) {
  try { const { uid } = jwt.verify(token, SECRET); return get('SELECT * FROM users WHERE id=?', uid) || null; } catch { return null; }
}

function loadUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  if (token.startsWith('fw_')) return get('SELECT * FROM users WHERE api_token=?', token) || null;
  try {
    const { uid } = jwt.verify(token, SECRET);
    return get('SELECT * FROM users WHERE id=?', uid) || null;
  } catch { return null; }
}

function auth(req, res, next) {
  const user = loadUser(req);
  if (!user) return res.status(401).json({ error: 'Nicht angemeldet' });
  if (user.banned) return res.status(403).json({ error: 'Dein Konto wurde gesperrt' });
  req.user = user;
  req.member = membership(user.id);
  next();
}

const RANK = { driver: 1, dispatcher: 2, admin: 3, owner: 4 };
/** Mindestrolle in der eigenen Firma verlangen */
const role = (min) => (req, res, next) => {
  if (!req.member) return res.status(403).json({ error: 'Du bist in keiner Firma' });
  if (RANK[req.member.role] < RANK[min]) return res.status(403).json({ error: 'Keine Berechtigung' });
  req.company = get('SELECT * FROM companies WHERE id=?', req.member.company_id);
  next();
};

function publicUser(u) {
  if (!u) return null;
  const { password_hash, api_token, email, discord_id, has_password, reset_hash, reset_expires, banned, ...rest } = u;
  return rest;
}

module.exports = { sign, auth, role, newApiToken, publicUser, RANK, SECRET, loadUserFromToken };
