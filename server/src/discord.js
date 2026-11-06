// Login mit Discord (OAuth2, Authorization-Code-Flow)
// Benötigt: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET und PUBLIC_URL (z. B. https://frachtwerk.example.de)
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { get, run } = require('./db');
const { sign, newApiToken, SECRET, loadUserFromToken } = require('./auth');

const router = express.Router();
const API = (process.env.DISCORD_API_BASE || 'https://discord.com/api').replace(/\/$/, '');
const AUTHORIZE = process.env.DISCORD_AUTHORIZE_URL || 'https://discord.com/oauth2/authorize';
const enabled = () => !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
const baseUrl = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const redirectUri = (req) => `${baseUrl(req)}/api/auth/discord/callback`;

router.get('/providers', (req, res) => res.json({ discord: enabled() }));

// Start: ?mode=login | link (link braucht ?token=<JWT>, weil hier ein Browser-Redirect stattfindet)
router.get('/discord', (req, res) => {
  if (!enabled()) return res.redirect('/login?error=' + encodeURIComponent('Discord-Login ist auf diesem Server nicht eingerichtet'));
  let uid = null;
  if (req.query.mode === 'link') {
    const u = loadUserFromToken(String(req.query.token || ''));
    if (!u) return res.redirect('/login?error=' + encodeURIComponent('Bitte erneut anmelden'));
    uid = u.id;
  }
  const state = jwt.sign({ m: uid ? 'link' : 'login', uid, n: crypto.randomBytes(8).toString('hex'), next: String(req.query.next || '') .slice(0, 100) }, SECRET, { expiresIn: '10m' });
  const q = new URLSearchParams({ response_type: 'code', client_id: process.env.DISCORD_CLIENT_ID, scope: 'identify email', redirect_uri: redirectUri(req), state, prompt: 'none' });
  res.redirect(`${AUTHORIZE}?${q}`);
});

const fail = (res, msg) => res.redirect('/login?error=' + encodeURIComponent(msg));

router.get('/discord/callback', async (req, res) => {
  if (!enabled()) return fail(res, 'Discord-Login ist nicht eingerichtet');
  if (req.query.error) return fail(res, 'Discord-Anmeldung abgebrochen');
  let state;
  try { state = jwt.verify(String(req.query.state || ''), SECRET); } catch { return fail(res, 'Anmeldung abgelaufen – bitte erneut versuchen'); }
  try {
    const tokRes = await fetch(`${API}/oauth2/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: String(req.query.code || ''), redirect_uri: redirectUri(req),
        client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET }),
    });
    if (!tokRes.ok) return fail(res, 'Discord hat die Anmeldung abgelehnt');
    const tok = await tokRes.json();
    const meRes = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!meRes.ok) return fail(res, 'Discord-Profil konnte nicht geladen werden');
    const d = await meRes.json();
    const avatar = d.avatar ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.${d.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256` : null;
    const dname = d.global_name || d.username;

    // Konto verknüpfen
    if (state.m === 'link') {
      const other = get('SELECT id FROM users WHERE discord_id=?', d.id);
      if (other && other.id !== state.uid) return res.redirect('/app/profile?discord=taken');
      run('UPDATE users SET discord_id=?, discord_name=?, avatar_url=COALESCE(?, avatar_url) WHERE id=?', d.id, d.username, avatar, state.uid);
      return res.redirect('/app/profile?discord=linked');
    }

    // Anmelden / registrieren
    let user = get('SELECT * FROM users WHERE discord_id=?', d.id);
    if (!user && d.email && d.verified) {
      user = get('SELECT * FROM users WHERE email=?', d.email.toLowerCase());
      if (user) run('UPDATE users SET discord_id=?, discord_name=? WHERE id=?', d.id, d.username, user.id);
    }
    let isNew = false;
    if (!user) {
      let base = String(d.username || 'fahrer').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 20);
      if (base.length < 3) base = `fahrer${base}`;
      let username = base, i = 1;
      while (get('SELECT id FROM users WHERE username=?', username)) username = `${base}${++i}`;
      const email = d.email && d.verified && !get('SELECT id FROM users WHERE email=?', d.email.toLowerCase()) ? d.email.toLowerCase() : `${d.id}@discord.invalid`;
      const r = run(`INSERT INTO users (username,email,password_hash,display_name,api_token,avatar_hue,discord_id,discord_name,avatar_url,has_password) VALUES (?,?,?,?,?,?,?,?,?,0)`,
        username, email, crypto.randomBytes(32).toString('hex'), dname.slice(0, 40), newApiToken(), Math.floor(Math.random() * 360), d.id, d.username, avatar);
      user = get('SELECT * FROM users WHERE id=?', r.lastInsertRowid);
      isNew = true;
    } else if (avatar) run('UPDATE users SET avatar_url=? WHERE id=?', avatar, user.id);
    if (user.banned) return fail(res, 'Dein Konto wurde gesperrt');

    const next = state.next && state.next.startsWith('/') && !state.next.startsWith('//') ? state.next : isNew ? '/app/onboarding' : '/app';
    res.redirect(`/auth/callback#token=${encodeURIComponent(sign(user))}&next=${encodeURIComponent(next)}`);
  } catch (e) {
    console.error('Discord-Login:', e);
    fail(res, 'Verbindung zu Discord fehlgeschlagen');
  }
});

router.post('/discord/unlink', (req, res) => {
  const h = req.headers.authorization || '';
  const u = loadUserFromToken(h.startsWith('Bearer ') ? h.slice(7) : '');
  if (!u) return res.status(401).json({ error: 'Nicht angemeldet' });
  if (!u.has_password) return res.status(400).json({ error: 'Lege zuerst ein Passwort fest, sonst kannst du dich nicht mehr anmelden.' });
  run('UPDATE users SET discord_id=NULL, discord_name=NULL, avatar_url=NULL WHERE id=?', u.id);
  res.json({ ok: true });
});

module.exports = { discordRouter: router };
