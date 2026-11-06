const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { get, all, run, tx } = require('./db');
const { sign, auth, role, newApiToken, publicUser, RANK } = require('./auth');
const L = require('./logic');
const Live = require('./live');
const { notify, embeds, validWebhook, post: postWebhook, EVENTS } = require('./notify');

const api = express.Router();
const wrap = (fn) => (req, res, next) => { try { const r = fn(req, res, next); if (r && r.catch) r.catch(next); } catch (e) { next(e); } };
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'firma';
const inviteCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

// ---------- simples Rate-Limit für Auth ----------
const hits = new Map();
const limit = (max, windowMs) => (req, res, next) => {
  const k = req.ip + req.path; const now = Date.now();
  const h = (hits.get(k) || []).filter((t) => now - t < windowMs);
  if (h.length >= max) return bad(res, 'Zu viele Versuche – bitte kurz warten', 429);
  h.push(now); hits.set(k, h); next();
};

// =====================================================================
// AUTH
// =====================================================================
api.post('/auth/register', limit(10, 60_000), wrap((req, res) => {
  const username = str(req.body.username, 24);
  const email = str(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) return bad(res, 'Benutzername: 3–24 Zeichen, nur Buchstaben, Zahlen, _ . -');
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Ungültige E-Mail-Adresse');
  if (password.length < 8) return bad(res, 'Passwort muss mindestens 8 Zeichen haben');
  if (get('SELECT id FROM users WHERE username=? OR email=?', username, email)) return bad(res, 'Benutzername oder E-Mail bereits vergeben', 409);
  const first = !get('SELECT id FROM users LIMIT 1');
  const r = run(`INSERT INTO users (username,email,password_hash,display_name,api_token,avatar_hue,is_admin) VALUES (?,?,?,?,?,?,?)`,
    username, email, bcrypt.hashSync(password, 10), username, newApiToken(), Math.floor(Math.random() * 360), first ? 1 : 0);
  const user = get('SELECT * FROM users WHERE id=?', r.lastInsertRowid);
  res.json({ token: sign(user) });
}));

api.post('/auth/login', limit(15, 60_000), wrap((req, res) => {
  const login = str(req.body.login, 120);
  const user = get('SELECT * FROM users WHERE username=? OR email=?', login, login.toLowerCase());
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password_hash)) return bad(res, 'Login fehlgeschlagen', 401);
  if (user.banned) return bad(res, 'Dein Konto wurde gesperrt', 403);
  res.json({ token: sign(user) });
}));

api.get('/me', auth, wrap((req, res) => {
  const stats = L.userStats(req.user.id);
  const { password_hash, reset_hash, reset_expires, ...me } = req.user;
  run("UPDATE users SET last_seen=datetime('now') WHERE id=?", req.user.id);
  res.json({ user: me, member: req.member, stats, level: L.levelFromXp(req.user.xp), achievements: L.achievementsFor(stats),
    pendingApplication: get(`SELECT a.*, c.name company_name FROM applications a JOIN companies c ON c.id=a.company_id WHERE a.user_id=? AND a.status='pending'`, req.user.id) || null });
}));

api.patch('/me', auth, wrap((req, res) => {
  const b = req.body;
  run(`UPDATE users SET display_name=?, bio=?, country=?, avatar_hue=?, live_public=? WHERE id=?`,
    str(b.display_name, 40) || req.user.username, str(b.bio, 500), str(b.country, 4) || 'DE', Math.round(num(b.avatar_hue, 28)) % 360,
    b.live_public === undefined ? req.user.live_public : (b.live_public ? 1 : 0), req.user.id);
  res.json({ ok: true });
}));

api.post('/me/token', auth, wrap((req, res) => {
  const t = newApiToken(); run('UPDATE users SET api_token=? WHERE id=?', t, req.user.id); res.json({ api_token: t });
}));

api.post('/me/password', auth, wrap((req, res) => {
  if (req.user.has_password && !bcrypt.compareSync(String(req.body.current || ''), req.user.password_hash)) return bad(res, 'Aktuelles Passwort falsch');
  if (String(req.body.next || '').length < 8) return bad(res, 'Neues Passwort zu kurz');
  run('UPDATE users SET password_hash=?, has_password=1 WHERE id=?', bcrypt.hashSync(String(req.body.next), 10), req.user.id); res.json({ ok: true });
}));

api.get('/me/payslips', auth, wrap((req, res) => {
  res.json(all(`SELECT pi.*, p.period, p.created_at, c.name company_name FROM payroll_items pi JOIN payrolls p ON p.id=pi.payroll_id
    JOIN companies c ON c.id=p.company_id WHERE pi.user_id=? ORDER BY p.period DESC`, req.user.id));
}));

// =====================================================================
// ÖFFENTLICH
// =====================================================================
api.get('/public/stats', wrap((req, res) => {
  const j = get(`SELECT COUNT(*) jobs, COALESCE(SUM(driven_km),0) km, COALESCE(SUM(income),0) income, COALESCE(SUM(cargo_mass),0) tonnage FROM jobs WHERE status='delivered'`);
  res.json({ ...j, users: get('SELECT COUNT(*) n FROM users').n, companies: get('SELECT COUNT(*) n FROM companies').n,
    live: get('SELECT COUNT(*) n FROM live WHERE updated_at > ?', Date.now() - 60_000).n });
}));

const companyListSql = `SELECT c.id,c.name,c.tag,c.slug,c.description,c.hue,c.games,c.language,c.join_mode,c.created_at,
  (SELECT COUNT(*) FROM memberships m WHERE m.company_id=c.id) members,
  (SELECT COALESCE(SUM(driven_km),0) FROM jobs j WHERE j.company_id=c.id AND j.status='delivered') km,
  (SELECT COUNT(*) FROM jobs j WHERE j.company_id=c.id AND j.status='delivered') jobs
  FROM companies c`;

api.get('/companies', wrap((req, res) => {
  const s = `%${str(req.query.search, 60)}%`;
  res.json(all(`${companyListSql} WHERE c.name LIKE ? OR c.tag LIKE ? ORDER BY km DESC LIMIT 100`, s, s));
}));

api.get('/companies/:slug', wrap((req, res) => {
  const c = get(`${companyListSql} WHERE c.slug=?`, req.params.slug);
  if (!c) return bad(res, 'Firma nicht gefunden', 404);
  const members = all(`SELECT u.id,u.username,u.display_name,u.avatar_hue, u.avatar_url,u.xp,u.country,m.role,m.rank_title,m.joined_at,
    (SELECT COALESCE(SUM(driven_km),0) FROM jobs j WHERE j.user_id=u.id AND j.company_id=m.company_id AND j.status='delivered') km
    FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.company_id=? ORDER BY km DESC`, c.id);
  const recent = all(`SELECT j.id,j.origin_city,j.dest_city,j.cargo,j.cargo_mass,j.driven_km,j.finished_at,u.display_name driver
    FROM jobs j JOIN users u ON u.id=j.user_id WHERE j.company_id=? AND j.status='delivered' ORDER BY j.finished_at DESC LIMIT 8`, c.id);
  const events = all(`SELECT id,title,start_at,origin,destination,server FROM events WHERE company_id=? AND start_at >= datetime('now','-1 day') ORDER BY start_at LIMIT 5`, c.id);
  res.json({ ...c, members, recent, events });
}));

api.get('/users/:username', wrap((req, res) => {
  const u = get('SELECT * FROM users WHERE username=?', req.params.username);
  if (!u) return bad(res, 'Fahrer nicht gefunden', 404);
  const stats = L.userStats(u.id);
  res.json({ user: publicUser(u), member: L.membership(u.id), stats, level: L.levelFromXp(u.xp), achievements: L.achievementsFor(stats),
    recent: all(`SELECT id,origin_city,dest_city,cargo,cargo_mass,driven_km,damage,finished_at FROM jobs WHERE user_id=? AND status='delivered' ORDER BY finished_at DESC LIMIT 10`, u.id) });
}));

api.get('/leaderboard', wrap((req, res) => {
  const metric = { km: 'SUM(j.driven_km)', income: 'SUM(j.income)', jobs: 'COUNT(j.id)', tonnage: 'SUM(j.cargo_mass)' }[req.query.metric] || 'SUM(j.driven_km)';
  const since = req.query.period === 'month' ? "datetime('now','start of month')" : req.query.period === 'week' ? "datetime('now','-7 days')" : "'1970-01-01'";
  const where = []; const p = [];
  if (req.query.company) { where.push('j.company_id=?'); p.push(num(req.query.company)); }
  if (req.query.type === 'companies') {
    return res.json(all(`SELECT c.id,c.name,c.tag,c.slug,c.hue, ${metric} value, COUNT(j.id) jobs, SUM(j.driven_km) km
      FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.status='delivered' AND j.review!='rejected' AND j.finished_at >= ${since}
      GROUP BY c.id ORDER BY value DESC LIMIT 50`));
  }
  res.json(all(`SELECT u.id,u.username,u.display_name,u.avatar_hue, u.avatar_url,u.xp,u.country, ${metric} value, COUNT(j.id) jobs, SUM(j.driven_km) km,
      (SELECT c.tag FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.user_id=u.id) company_tag
    FROM jobs j JOIN users u ON u.id=j.user_id WHERE j.status='delivered' AND j.review!='rejected' AND j.finished_at >= ${since}
    ${where.length ? 'AND ' + where.join(' AND ') : ''} GROUP BY u.id ORDER BY value DESC LIMIT 50`, ...p));
}));

// =====================================================================
// FIRMEN
// =====================================================================
api.post('/companies', auth, wrap((req, res) => {
  if (req.member) return bad(res, 'Du bist bereits in einer Firma');
  const name = str(req.body.name, 48);
  const tag = str(req.body.tag, 6).toUpperCase();
  if (name.length < 3) return bad(res, 'Firmenname zu kurz');
  if (!/^[A-Z0-9]{2,6}$/.test(tag)) return bad(res, 'Kürzel: 2–6 Buchstaben/Zahlen');
  if (get('SELECT id FROM companies WHERE name=?', name)) return bad(res, 'Name bereits vergeben', 409);
  let slug = slugify(name); let i = 1; while (get('SELECT id FROM companies WHERE slug=?', slug)) slug = `${slugify(name)}-${++i}`;
  const id = tx(() => {
    const r = run(`INSERT INTO companies (name,tag,slug,description,hue,games,join_mode,invite_code,owner_id,balance) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      name, tag, slug, str(req.body.description, 1000), Math.round(num(req.body.hue, 28)) % 360, ['ets2', 'ats', 'both'].includes(req.body.games) ? req.body.games : 'ets2',
      ['open', 'apply', 'invite'].includes(req.body.join_mode) ? req.body.join_mode : 'apply', inviteCode(), req.user.id, 250000);
    run(`INSERT INTO memberships (user_id,company_id,role,rank_title) VALUES (?,?, 'owner','Geschäftsführer')`, req.user.id, r.lastInsertRowid);
    run(`INSERT INTO transactions (company_id,type,amount,description) VALUES (?, 'deposit', 250000, 'Startkapital')`, r.lastInsertRowid);
    run(`DELETE FROM applications WHERE user_id=? AND status='pending'`, req.user.id);
    return r.lastInsertRowid;
  });
  res.json({ id, slug });
}));

function joinCompany(req, res, c, code) {
  if (req.member) return bad(res, 'Du bist bereits in einer Firma');
  if (!c) return bad(res, 'Firma nicht gefunden', 404);
  const viaCode = code && code === c.invite_code;
  if (c.join_mode === 'open' || viaCode) {
    tx(() => {
      run(`INSERT INTO memberships (user_id,company_id) VALUES (?,?)`, req.user.id, c.id);
      run(`DELETE FROM applications WHERE user_id=? AND status='pending'`, req.user.id);
    });
    notify(c.id, 'member', embeds.member(req.user.display_name));
    return res.json({ joined: true, slug: c.slug });
  }
  if (c.join_mode === 'invite') return bad(res, 'Diese Firma nimmt nur mit Einladungscode auf');
  if (get(`SELECT id FROM applications WHERE user_id=? AND status='pending'`, req.user.id)) return bad(res, 'Du hast bereits eine offene Bewerbung');
  run(`INSERT INTO applications (company_id,user_id,message) VALUES (?,?,?)`, c.id, req.user.id, str(req.body.message, 1000));
  notify(c.id, 'application', embeds.application(req.user.display_name, req.body.message));
  res.json({ applied: true });
}

api.post('/companies/:id/join', auth, wrap((req, res) =>
  joinCompany(req, res, get('SELECT * FROM companies WHERE id=?', num(req.params.id)), str(req.body.invite_code, 20).toUpperCase())));

api.post('/join-by-code', auth, wrap((req, res) => {
  const code = str(req.body.code, 20).toUpperCase();
  const c = code ? get('SELECT * FROM companies WHERE invite_code=?', code) : null;
  if (!c) return bad(res, 'Ungültiger Einladungscode', 404);
  joinCompany(req, res, c, code);
}));

api.delete('/applications/mine', auth, wrap((req, res) => {
  run(`DELETE FROM applications WHERE user_id=? AND status='pending'`, req.user.id); res.json({ ok: true });
}));

api.post('/company/leave', auth, role('driver'), wrap((req, res) => {
  if (req.member.role === 'owner') return bad(res, 'Als Inhaber musst du die Firma erst übertragen oder auflösen');
  run('DELETE FROM memberships WHERE user_id=?', req.user.id); res.json({ ok: true });
}));

api.get('/company', auth, role('driver'), wrap((req, res) => {
  const c = req.company;
  const members = all(`SELECT u.id,u.username,u.display_name,u.avatar_hue, u.avatar_url,u.xp,u.country,m.role,m.rank_title,m.joined_at,
     COUNT(j.id) jobs, COALESCE(SUM(j.driven_km),0) km, COALESCE(SUM(j.income),0) income, COALESCE(SUM(j.payout),0) payout,
     COALESCE(AVG(j.damage),0) avg_damage, MAX(j.finished_at) last_job
     FROM memberships m JOIN users u ON u.id=m.user_id
     LEFT JOIN jobs j ON j.user_id=u.id AND j.company_id=m.company_id AND j.status='delivered' AND j.review!='rejected'
     WHERE m.company_id=? GROUP BY u.id ORDER BY ${"CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'dispatcher' THEN 2 ELSE 3 END"}, km DESC`, c.id);
  const isAdmin = RANK[req.member.role] >= RANK.admin;
  res.json({ ...c, invite_code: isAdmin ? c.invite_code : null, discord_webhook: isAdmin ? c.discord_webhook : null, members, myRole: req.member.role,
    pendingApplications: isAdmin ? get(`SELECT COUNT(*) n FROM applications WHERE company_id=? AND status='pending'`, c.id).n : 0,
    pendingJobs: get(`SELECT COUNT(*) n FROM jobs WHERE company_id=? AND review='pending' AND status='delivered'`, c.id).n });
}));

api.patch('/company', auth, role('admin'), wrap((req, res) => {
  const b = req.body; const c = req.company;
  const pick = (k, fn) => (b[k] === undefined ? c[k] : fn(b[k]));
  run(`UPDATE companies SET description=?, hue=?, games=?, language=?, join_mode=?, discord=?, rate_per_km=?, revenue_share=?, fuel_price=?,
    company_pays_fuel=?, damage_penalty=?, clean_bonus=?, max_speed_limit=?, speeding_penalty=?, auto_approve=?, min_distance=? WHERE id=?`,
    pick('description', (v) => str(v, 1000)), pick('hue', (v) => Math.round(num(v)) % 360), pick('games', (v) => (['ets2', 'ats', 'both'].includes(v) ? v : c.games)),
    pick('language', (v) => str(v, 5)), pick('join_mode', (v) => (['open', 'apply', 'invite'].includes(v) ? v : c.join_mode)), pick('discord', (v) => str(v, 200)),
    pick('rate_per_km', (v) => Math.max(0, num(v))), pick('revenue_share', (v) => Math.min(100, Math.max(0, num(v)))), pick('fuel_price', (v) => Math.max(0, num(v))),
    pick('company_pays_fuel', (v) => (v ? 1 : 0)), pick('damage_penalty', (v) => Math.max(0, num(v))), pick('clean_bonus', (v) => Math.max(0, num(v))),
    pick('max_speed_limit', (v) => Math.max(0, Math.round(num(v)))), pick('speeding_penalty', (v) => Math.max(0, num(v))), pick('auto_approve', (v) => (v ? 1 : 0)),
    pick('min_distance', (v) => Math.max(0, Math.round(num(v)))), c.id);
  if (b.discord_webhook !== undefined) {
    const url = str(b.discord_webhook, 300);
    if (url && !validWebhook(url)) return bad(res, 'Ungültige Discord-Webhook-URL');
    run('UPDATE companies SET discord_webhook=? WHERE id=?', url, c.id);
  }
  if (Array.isArray(b.webhook_events)) run('UPDATE companies SET webhook_events=? WHERE id=?', b.webhook_events.filter((e) => EVENTS.includes(e)).join(','), c.id);
  res.json({ ok: true });
}));

api.post('/company/webhook/test', auth, role('admin'), wrap(async (req, res) => {
  const url = str(req.body.url, 300) || req.company.discord_webhook;
  if (!validWebhook(url)) return bad(res, 'Ungültige Discord-Webhook-URL');
  const ok = await postWebhook(url, { title: '🚚 Frachtwerk ist verbunden!', description: `Ab jetzt landen Neuigkeiten von **${req.company.name}** hier im Kanal.`, color: 0xff8a1f });
  ok ? res.json({ ok: true }) : bad(res, 'Discord hat die Nachricht abgelehnt – stimmt die URL?');
}));

api.post('/company/invite', auth, role('admin'), wrap((req, res) => {
  const code = inviteCode(); run('UPDATE companies SET invite_code=? WHERE id=?', code, req.company.id); res.json({ invite_code: code });
}));

api.delete('/company', auth, role('owner'), wrap((req, res) => {
  if (str(req.body.confirm, 60) !== req.company.name) return bad(res, 'Bitte Firmennamen zur Bestätigung eingeben');
  run('DELETE FROM companies WHERE id=?', req.company.id); res.json({ ok: true });
}));

api.get('/company/applications', auth, role('admin'), wrap((req, res) => {
  res.json(all(`SELECT a.*, u.username, u.display_name, u.avatar_hue, u.avatar_url, u.xp, u.country,
    (SELECT COALESCE(SUM(driven_km),0) FROM jobs WHERE user_id=u.id AND status='delivered') km,
    (SELECT COUNT(*) FROM jobs WHERE user_id=u.id AND status='delivered') jobs
    FROM applications a JOIN users u ON u.id=a.user_id WHERE a.company_id=? ORDER BY a.status='pending' DESC, a.created_at DESC LIMIT 100`, req.company.id));
}));

api.post('/company/applications/:id', auth, role('admin'), wrap((req, res) => {
  const a = get(`SELECT * FROM applications WHERE id=? AND company_id=? AND status='pending'`, num(req.params.id), req.company.id);
  if (!a) return bad(res, 'Bewerbung nicht gefunden', 404);
  if (req.body.action === 'accept') {
    if (get('SELECT 1 FROM memberships WHERE user_id=?', a.user_id)) { run(`UPDATE applications SET status='rejected' WHERE id=?`, a.id); return bad(res, 'Fahrer ist inzwischen in einer anderen Firma'); }
    tx(() => { run(`UPDATE applications SET status='accepted' WHERE id=?`, a.id); run(`INSERT INTO memberships (user_id,company_id) VALUES (?,?)`, a.user_id, req.company.id); });
    notify(req.company.id, 'member', embeds.member(get('SELECT display_name FROM users WHERE id=?', a.user_id).display_name));
  } else run(`UPDATE applications SET status='rejected' WHERE id=?`, a.id);
  res.json({ ok: true });
}));

api.patch('/company/members/:uid', auth, role('admin'), wrap((req, res) => {
  const uid = num(req.params.uid);
  const m = get('SELECT * FROM memberships WHERE user_id=? AND company_id=?', uid, req.company.id);
  if (!m) return bad(res, 'Mitglied nicht gefunden', 404);
  if (m.role === 'owner') return bad(res, 'Inhaber kann nicht geändert werden');
  let newRole = m.role;
  if (req.body.role && ['admin', 'dispatcher', 'driver'].includes(req.body.role)) {
    if (req.body.role === 'admin' && req.member.role !== 'owner') return bad(res, 'Nur der Inhaber ernennt Admins');
    if (m.role === 'admin' && req.member.role !== 'owner') return bad(res, 'Nur der Inhaber ändert Admins');
    newRole = req.body.role;
  }
  run('UPDATE memberships SET role=?, rank_title=? WHERE user_id=?', newRole, str(req.body.rank_title, 30) || m.rank_title, uid);
  res.json({ ok: true });
}));

api.delete('/company/members/:uid', auth, role('admin'), wrap((req, res) => {
  const m = get('SELECT * FROM memberships WHERE user_id=? AND company_id=?', num(req.params.uid), req.company.id);
  if (!m) return bad(res, 'Mitglied nicht gefunden', 404);
  if (m.role === 'owner' || (m.role === 'admin' && req.member.role !== 'owner')) return bad(res, 'Keine Berechtigung');
  run('DELETE FROM memberships WHERE user_id=?', m.user_id); res.json({ ok: true });
}));

api.post('/company/transfer', auth, role('owner'), wrap((req, res) => {
  const m = get('SELECT * FROM memberships WHERE user_id=? AND company_id=?', num(req.body.user_id), req.company.id);
  if (!m || m.user_id === req.user.id) return bad(res, 'Mitglied nicht gefunden');
  tx(() => {
    run(`UPDATE memberships SET role='admin', rank_title='Admin' WHERE user_id=?`, req.user.id);
    run(`UPDATE memberships SET role='owner', rank_title='Geschäftsführer' WHERE user_id=?`, m.user_id);
    run('UPDATE companies SET owner_id=? WHERE id=?', m.user_id, req.company.id);
  });
  res.json({ ok: true });
}));

// Firmen-Dashboard: Kennzahlen & Verläufe
api.get('/company/overview', auth, role('driver'), wrap((req, res) => {
  const id = req.company.id;
  const month = get(`SELECT COUNT(*) jobs, COALESCE(SUM(driven_km),0) km, COALESCE(SUM(income),0) income, COALESCE(SUM(payout),0) payout,
     COALESCE(SUM(fuel_used),0) fuel, COALESCE(AVG(damage),0) damage, COALESCE(SUM(cargo_mass),0) tonnage
     FROM jobs WHERE company_id=? AND status='delivered' AND review!='rejected' AND finished_at >= datetime('now','start of month')`, id);
  const lastMonth = get(`SELECT COUNT(*) jobs, COALESCE(SUM(driven_km),0) km, COALESCE(SUM(income),0) income
     FROM jobs WHERE company_id=? AND status='delivered' AND review!='rejected' AND finished_at >= datetime('now','start of month','-1 month') AND finished_at < datetime('now','start of month')`, id);
  const daily = all(`SELECT date(finished_at) day, COUNT(*) jobs, ROUND(SUM(driven_km)) km, ROUND(SUM(income)) income, ROUND(SUM(payout)) payout
     FROM jobs WHERE company_id=? AND status='delivered' AND review!='rejected' AND finished_at >= date('now','-29 days') GROUP BY day ORDER BY day`, id);
  const cargo = all(`SELECT cargo name, COUNT(*) n, ROUND(SUM(income)) income FROM jobs WHERE company_id=? AND status='delivered' GROUP BY cargo ORDER BY n DESC LIMIT 6`, id);
  const routes = all(`SELECT dest_city city, COUNT(*) n FROM jobs WHERE company_id=? AND status='delivered' GROUP BY dest_city ORDER BY n DESC LIMIT 6`, id);
  const top = all(`SELECT u.id,u.username,u.display_name,u.avatar_hue, u.avatar_url, ROUND(SUM(j.driven_km)) km, COUNT(*) jobs FROM jobs j JOIN users u ON u.id=j.user_id
     WHERE j.company_id=? AND j.status='delivered' AND j.finished_at >= datetime('now','start of month') GROUP BY u.id ORDER BY km DESC LIMIT 5`, id);
  res.json({ month, lastMonth, daily, cargo, routes, top, balance: req.company.balance });
}));

// ---------- Finanzen ----------
api.get('/company/transactions', auth, role('dispatcher'), wrap((req, res) => {
  const id = req.company.id;
  const rows = all(`SELECT t.*, u.display_name user_name FROM transactions t LEFT JOIN users u ON u.id=t.user_id WHERE t.company_id=? ORDER BY t.created_at DESC, t.id DESC LIMIT 300`, id);
  const monthly = all(`SELECT strftime('%Y-%m', created_at) month, ROUND(SUM(CASE WHEN amount>0 THEN amount ELSE 0 END)) inflow, ROUND(SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END)) outflow
     FROM transactions WHERE company_id=? AND created_at >= date('now','start of month','-5 months') GROUP BY month ORDER BY month`, id);
  const byType = all(`SELECT type, ROUND(SUM(amount)) total, COUNT(*) n FROM transactions WHERE company_id=? AND created_at >= datetime('now','start of month') GROUP BY type`, id);
  res.json({ balance: req.company.balance, rows, monthly, byType });
}));

api.post('/company/transactions', auth, role('admin'), wrap((req, res) => {
  const type = ['expense', 'deposit', 'bonus'].includes(req.body.type) ? req.body.type : null;
  const amount = Math.abs(num(req.body.amount));
  if (!type || !amount) return bad(res, 'Typ und Betrag angeben');
  const signed = type === 'deposit' ? amount : -amount;
  let uid = null;
  if (type === 'bonus') {
    uid = num(req.body.user_id) || null;
    if (!uid || !get('SELECT 1 FROM memberships WHERE user_id=? AND company_id=?', uid, req.company.id)) return bad(res, 'Mitglied für Bonus wählen');
  }
  tx(() => {
    run(`INSERT INTO transactions (company_id,user_id,type,amount,description) VALUES (?,?,?,?,?)`, req.company.id, uid, type, signed, str(req.body.description, 200));
    run('UPDATE companies SET balance=balance+? WHERE id=?', signed, req.company.id);
  });
  res.json({ ok: true });
}));

// ---------- Abrechnung / Lohnlauf ----------
function payrollPreview(companyId, period) {
  const rows = all(`SELECT u.id user_id, u.username, u.display_name, u.avatar_hue, u.avatar_url, COUNT(j.id) jobs, ROUND(SUM(j.driven_km),1) km,
      ROUND(SUM(j.income),2) income, ROUND(SUM(j.pay_base),2) gross, ROUND(SUM(j.pay_bonus),2) bonus,
      ROUND(SUM(j.pay_deductions),2) deductions, ROUND(SUM(j.payout),2) net, ROUND(AVG(j.damage),2) avg_damage
    FROM jobs j JOIN users u ON u.id=j.user_id
    WHERE j.company_id=? AND j.status='delivered' AND j.review='approved' AND j.payroll_id IS NULL AND strftime('%Y-%m', j.finished_at)=?
    GROUP BY u.id ORDER BY net DESC`, companyId, period);
  const bonuses = all(`SELECT user_id, ROUND(SUM(-amount),2) amount FROM transactions WHERE company_id=? AND type='bonus' AND strftime('%Y-%m', created_at)=? GROUP BY user_id`, companyId, period);
  const total = rows.reduce((s, r) => s + r.net, 0);
  return { period, rows, bonuses, total: L.r2(total), jobs: rows.reduce((s, r) => s + r.jobs, 0) };
}

const validPeriod = (p) => (/^\d{4}-\d{2}$/.test(p || '') ? p : new Date().toISOString().slice(0, 7));

api.get('/company/payroll/preview', auth, role('dispatcher'), wrap((req, res) => {
  const period = validPeriod(req.query.period);
  res.json({ ...payrollPreview(req.company.id, period), pendingReview: get(`SELECT COUNT(*) n FROM jobs WHERE company_id=? AND review='pending' AND status='delivered' AND strftime('%Y-%m', finished_at)=?`, req.company.id, period).n });
}));

api.post('/company/payroll', auth, role('admin'), wrap((req, res) => {
  const period = validPeriod(req.body.period);
  const pv = payrollPreview(req.company.id, period);
  if (!pv.rows.length) return bad(res, 'Keine freigegebenen, offenen Touren in diesem Zeitraum');
  const id = tx(() => {
    const p = run(`INSERT INTO payrolls (company_id,period,total,jobs,created_by) VALUES (?,?,?,?,?)`, req.company.id, period, pv.total, pv.jobs, req.user.id);
    for (const r of pv.rows) {
      run(`INSERT INTO payroll_items (payroll_id,user_id,jobs,km,income,gross,deductions,bonus,net) VALUES (?,?,?,?,?,?,?,?,?)`,
        p.lastInsertRowid, r.user_id, r.jobs, r.km, r.income, r.gross, r.deductions, r.bonus, r.net);
      run(`INSERT INTO transactions (company_id,user_id,type,amount,description) VALUES (?,?, 'payout', ?, ?)`, req.company.id, r.user_id, -r.net, `Lohnabrechnung ${period}`);
    }
    run(`UPDATE jobs SET payroll_id=? WHERE company_id=? AND status='delivered' AND review='approved' AND payroll_id IS NULL AND strftime('%Y-%m', finished_at)=?`, p.lastInsertRowid, req.company.id, period);
    run('UPDATE companies SET balance=balance-? WHERE id=?', pv.total, req.company.id);
    return p.lastInsertRowid;
  });
  notify(req.company.id, 'payroll', embeds.payroll(period, pv.total, pv.rows.length));
  res.json({ id });
}));

api.get('/company/payrolls', auth, role('dispatcher'), wrap((req, res) => {
  res.json(all(`SELECT p.*, u.display_name created_by_name, (SELECT COUNT(*) FROM payroll_items WHERE payroll_id=p.id) drivers
    FROM payrolls p LEFT JOIN users u ON u.id=p.created_by WHERE p.company_id=? ORDER BY p.created_at DESC`, req.company.id));
}));

api.get('/payrolls/:id', auth, wrap((req, res) => {
  const p = get(`SELECT p.*, c.name company_name, c.tag company_tag, c.hue company_hue FROM payrolls p JOIN companies c ON c.id=p.company_id WHERE p.id=?`, num(req.params.id));
  if (!p) return bad(res, 'Nicht gefunden', 404);
  const staff = req.member && req.member.company_id === p.company_id && RANK[req.member.role] >= RANK.dispatcher;
  const items = all(`SELECT pi.*, u.username, u.display_name, u.avatar_hue, u.avatar_url FROM payroll_items pi JOIN users u ON u.id=pi.user_id WHERE pi.payroll_id=? ${staff ? '' : 'AND pi.user_id=' + Number(req.user.id)} ORDER BY net DESC`, p.id);
  if (!staff && !items.length) return bad(res, 'Keine Berechtigung', 403);
  const jobs = all(`SELECT id,user_id,origin_city,dest_city,cargo,cargo_mass,driven_km,income,damage,pay_base,pay_bonus,pay_deductions,payout,finished_at
    FROM jobs WHERE payroll_id=? ${staff ? '' : 'AND user_id=' + Number(req.user.id)} ORDER BY finished_at`, p.id);
  res.json({ ...p, items, jobs });
}));

// ---------- Fuhrpark ----------
api.get('/company/trucks', auth, role('driver'), wrap((req, res) => {
  res.json(all(`SELECT t.*, u.display_name driver FROM trucks t LEFT JOIN users u ON u.id=t.assigned_user WHERE t.company_id=? ORDER BY t.created_at DESC`, req.company.id));
}));
api.post('/company/trucks', auth, role('admin'), wrap((req, res) => {
  const b = req.body; const price = Math.max(0, num(b.value));
  if (!str(b.brand)) return bad(res, 'Marke angeben');
  if (price > req.company.balance) return bad(res, 'Nicht genug Firmenguthaben');
  tx(() => {
    run(`INSERT INTO trucks (company_id,brand,model,plate,assigned_user,odometer,value) VALUES (?,?,?,?,?,?,?)`, req.company.id, str(b.brand, 40), str(b.model, 60), str(b.plate, 16).toUpperCase(), num(b.assigned_user) || null, Math.max(0, num(b.odometer)), price);
    if (price) {
      run(`INSERT INTO transactions (company_id,type,amount,description) VALUES (?, 'expense', ?, ?)`, req.company.id, -price, `Fahrzeugkauf ${str(b.brand, 40)} ${str(b.model, 60)}`);
      run('UPDATE companies SET balance=balance-? WHERE id=?', price, req.company.id);
    }
  });
  res.json({ ok: true });
}));
api.patch('/company/trucks/:id', auth, role('dispatcher'), wrap((req, res) => {
  const t = get('SELECT * FROM trucks WHERE id=? AND company_id=?', num(req.params.id), req.company.id);
  if (!t) return bad(res, 'Fahrzeug nicht gefunden', 404);
  const au = req.body.assigned_user === undefined ? t.assigned_user : (num(req.body.assigned_user) || null);
  run('UPDATE trucks SET assigned_user=?, plate=? WHERE id=?', au, str(req.body.plate ?? t.plate, 16).toUpperCase(), t.id);
  res.json({ ok: true });
}));
api.delete('/company/trucks/:id', auth, role('admin'), wrap((req, res) => {
  run('DELETE FROM trucks WHERE id=? AND company_id=?', num(req.params.id), req.company.id); res.json({ ok: true });
}));

// ---------- Events / Konvois ----------
api.get('/company/events', auth, role('driver'), wrap((req, res) => {
  res.json(all(`SELECT e.*, u.display_name author, (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id=e.id) attendees,
    EXISTS(SELECT 1 FROM event_attendees a WHERE a.event_id=e.id AND a.user_id=?) attending
    FROM events e LEFT JOIN users u ON u.id=e.created_by WHERE e.company_id=? ORDER BY e.start_at >= datetime('now','-3 hours') DESC, e.start_at`, req.user.id, req.company.id));
}));
api.post('/company/events', auth, role('dispatcher'), wrap((req, res) => {
  const b = req.body;
  if (!str(b.title) || !str(b.start_at)) return bad(res, 'Titel und Startzeit angeben');
  run(`INSERT INTO events (company_id,title,description,start_at,origin,destination,server,created_by) VALUES (?,?,?,?,?,?,?,?)`,
    req.company.id, str(b.title, 80), str(b.description, 2000), str(b.start_at, 30).replace('T', ' '), str(b.origin, 60), str(b.destination, 60), str(b.server, 60) || 'Singleplayer', req.user.id);
  notify(req.company.id, 'event', embeds.event({ title: str(b.title, 80), description: str(b.description, 2000), origin: str(b.origin, 60), destination: str(b.destination, 60), server: str(b.server, 60) }));
  res.json({ ok: true });
}));
api.post('/company/events/:id/attend', auth, role('driver'), wrap((req, res) => {
  const e = get('SELECT id FROM events WHERE id=? AND company_id=?', num(req.params.id), req.company.id);
  if (!e) return bad(res, 'Event nicht gefunden', 404);
  if (get('SELECT 1 FROM event_attendees WHERE event_id=? AND user_id=?', e.id, req.user.id)) run('DELETE FROM event_attendees WHERE event_id=? AND user_id=?', e.id, req.user.id);
  else run('INSERT INTO event_attendees (event_id,user_id) VALUES (?,?)', e.id, req.user.id);
  res.json({ ok: true });
}));
api.delete('/company/events/:id', auth, role('dispatcher'), wrap((req, res) => {
  run('DELETE FROM events WHERE id=? AND company_id=?', num(req.params.id), req.company.id); res.json({ ok: true });
}));

// ---------- News ----------
api.get('/company/news', auth, role('driver'), wrap((req, res) => {
  res.json(all(`SELECT n.*, u.display_name author, u.avatar_hue, u.avatar_url FROM news n LEFT JOIN users u ON u.id=n.author_id WHERE n.company_id=? ORDER BY n.pinned DESC, n.created_at DESC LIMIT 30`, req.company.id));
}));
api.post('/company/news', auth, role('dispatcher'), wrap((req, res) => {
  if (!str(req.body.title)) return bad(res, 'Titel angeben');
  run('INSERT INTO news (company_id,author_id,title,body,pinned) VALUES (?,?,?,?,?)', req.company.id, req.user.id, str(req.body.title, 120), str(req.body.body, 4000), req.body.pinned ? 1 : 0);
  notify(req.company.id, 'news', embeds.news({ title: str(req.body.title, 120), body: str(req.body.body, 4000) }, req.user.display_name));
  res.json({ ok: true });
}));
api.delete('/company/news/:id', auth, role('dispatcher'), wrap((req, res) => {
  run('DELETE FROM news WHERE id=? AND company_id=?', num(req.params.id), req.company.id); res.json({ ok: true });
}));

// =====================================================================
// TOUREN / FRACHTBRIEFE
// =====================================================================
const jobSelect = `SELECT j.*, u.username, u.display_name, u.avatar_hue, u.avatar_url FROM jobs j JOIN users u ON u.id=j.user_id`;

api.get('/jobs', auth, wrap((req, res) => {
  const where = []; const p = [];
  if (req.query.scope === 'company') {
    if (!req.member) return bad(res, 'Keine Firma', 403);
    where.push('j.company_id=?'); p.push(req.member.company_id);
    if (req.query.user) { where.push('j.user_id=?'); p.push(num(req.query.user)); }
  } else { where.push('j.user_id=?'); p.push(req.user.id); }
  if (['pending', 'approved', 'rejected'].includes(req.query.review)) { where.push('j.review=?'); p.push(req.query.review); }
  if (['active', 'delivered', 'cancelled'].includes(req.query.status)) { where.push('j.status=?'); p.push(req.query.status); }
  if (req.query.q) { where.push('(j.cargo LIKE ? OR j.origin_city LIKE ? OR j.dest_city LIKE ?)'); const s = `%${str(req.query.q, 50)}%`; p.push(s, s, s); }
  const lim = Math.min(200, num(req.query.limit, 50)); const off = Math.max(0, num(req.query.offset, 0));
  const w = 'WHERE ' + where.join(' AND ');
  res.json({ rows: all(`${jobSelect} ${w} ORDER BY COALESCE(j.finished_at, j.started_at) DESC LIMIT ? OFFSET ?`, ...p, lim, off),
    total: get(`SELECT COUNT(*) n FROM jobs j ${w}`, ...p).n });
}));

api.get('/jobs/:id', auth, wrap((req, res) => {
  const j = get(`${jobSelect} WHERE j.id=?`, num(req.params.id));
  if (!j) return bad(res, 'Tour nicht gefunden', 404);
  const sameCompany = req.member && j.company_id === req.member.company_id;
  if (j.user_id !== req.user.id && !sameCompany) return bad(res, 'Keine Berechtigung', 403);
  const c = j.company_id ? get('SELECT * FROM companies WHERE id=?', j.company_id) : null;
  res.json({ ...j, breakdown: c ? L.computePayout(j, c).lines : [], company_name: c?.name,
    canReview: sameCompany && RANK[req.member.role] >= RANK.dispatcher });
}));

/** Tour abschließen & abrechnen (gemeinsam für Client und manuelle Einreichung) */
function finalizeJob(jobId) {
  const job = get('SELECT * FROM jobs WHERE id=?', jobId);
  const c = job.company_id ? get('SELECT * FROM companies WHERE id=?', job.company_id) : null;
  if (job.status !== 'delivered') { run(`UPDATE jobs SET review='rejected', payout=0 WHERE id=?`, job.id); return; }
  if (c) {
    const p = L.computePayout(job, c);
    run('UPDATE jobs SET pay_base=?, pay_bonus=?, pay_deductions=?, payout=? WHERE id=?', p.pay_base, p.pay_bonus, p.pay_deductions, p.payout, job.id);
    if (c.auto_approve && job.source === 'client' && job.driven_km >= c.min_distance) L.approveJob(get('SELECT * FROM jobs WHERE id=?', job.id), c);
  } else {
    L.approveJob(job, null); // Freifahrer: nur XP & Statistik
  }
}

const jobFields = (b) => ({
  game: ['ets2', 'ats'].includes(b.game) ? b.game : 'ets2',
  origin_city: str(b.origin_city, 60), origin_company: str(b.origin_company, 60), dest_city: str(b.dest_city, 60), dest_company: str(b.dest_company, 60),
  cargo: str(b.cargo, 80), cargo_mass: Math.max(0, num(b.cargo_mass)), truck: str(b.truck, 80), planned_km: Math.max(0, num(b.planned_km)), income: Math.max(0, num(b.income)),
});

api.post('/jobs', auth, wrap((req, res) => {
  const b = req.body; const f = jobFields(b);
  if (!f.origin_city || !f.dest_city || !f.cargo) return bad(res, 'Start, Ziel und Fracht angeben');
  const km = Math.max(0, num(b.driven_km));
  if (!km) return bad(res, 'Gefahrene Kilometer angeben');
  const r = tx(() => {
    const r = run(`INSERT INTO jobs (user_id,company_id,source,game,status,origin_city,origin_company,dest_city,dest_company,cargo,cargo_mass,truck,planned_km,driven_km,income,fuel_used,damage,fines,notes,started_at,finished_at)
      VALUES (?,?, 'manual', ?, 'delivered', ?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now','-'||?||' minutes'), datetime('now'))`,
      req.user.id, req.member?.company_id ?? null, f.game, f.origin_city, f.origin_company, f.dest_city, f.dest_company, f.cargo, f.cargo_mass, f.truck, f.planned_km || km, km, f.income,
      Math.max(0, num(b.fuel_used)), Math.min(100, Math.max(0, num(b.damage))), Math.max(0, num(b.fines)), str(b.notes, 1000), Math.round(km / 1.2));
    finalizeJob(r.lastInsertRowid); return r;
  });
  res.json({ id: r.lastInsertRowid });
}));

api.post('/jobs/:id/review', auth, role('dispatcher'), wrap((req, res) => {
  const j = get(`SELECT * FROM jobs WHERE id=? AND company_id=?`, num(req.params.id), req.company.id);
  if (!j) return bad(res, 'Tour nicht gefunden', 404);
  if (j.review !== 'pending') return bad(res, 'Tour wurde bereits geprüft');
  tx(() => {
    if (req.body.action === 'approve') {
      const fines = req.body.fines !== undefined ? Math.max(0, num(req.body.fines)) : j.fines;
      if (fines !== j.fines) {
        run('UPDATE jobs SET fines=? WHERE id=?', fines, j.id);
        const p = L.computePayout({ ...j, fines }, req.company);
        run('UPDATE jobs SET pay_base=?, pay_bonus=?, pay_deductions=?, payout=? WHERE id=?', p.pay_base, p.pay_bonus, p.pay_deductions, p.payout, j.id);
      }
      L.approveJob(get('SELECT * FROM jobs WHERE id=?', j.id), req.company);
    } else run(`UPDATE jobs SET review='rejected' WHERE id=?`, j.id);
    run('UPDATE jobs SET review_note=? WHERE id=?', str(req.body.note, 500), j.id);
  });
  res.json({ ok: true });
}));

api.delete('/jobs/:id', auth, wrap((req, res) => {
  const j = get('SELECT * FROM jobs WHERE id=?', num(req.params.id));
  if (!j) return bad(res, 'Tour nicht gefunden', 404);
  const own = j.user_id === req.user.id && j.review !== 'approved';
  if (!own) return bad(res, 'Nur eigene, nicht freigegebene Touren können gelöscht werden', 403);
  run('DELETE FROM jobs WHERE id=?', j.id); res.json({ ok: true });
}));

// Persönliches Dashboard
api.get('/dashboard', auth, wrap((req, res) => {
  const uid = req.user.id;
  const month = get(`SELECT COUNT(*) jobs, COALESCE(SUM(driven_km),0) km, COALESCE(SUM(income),0) income, COALESCE(SUM(payout),0) payout, COALESCE(AVG(damage),0) damage, COALESCE(SUM(fuel_used),0) fuel
    FROM jobs WHERE user_id=? AND status='delivered' AND review!='rejected' AND finished_at >= datetime('now','start of month')`, uid);
  const daily = all(`SELECT date(finished_at) day, ROUND(SUM(driven_km)) km, ROUND(SUM(payout)) payout, COUNT(*) jobs FROM jobs
    WHERE user_id=? AND status='delivered' AND review!='rejected' AND finished_at >= date('now','-29 days') GROUP BY day ORDER BY day`, uid);
  const recent = all(`${jobSelect} WHERE j.user_id=? ORDER BY COALESCE(j.finished_at, j.started_at) DESC LIMIT 6`, uid);
  const cid = req.member?.company_id;
  const news = cid ? all(`SELECT n.*, u.display_name author, u.avatar_hue, u.avatar_url FROM news n LEFT JOIN users u ON u.id=n.author_id WHERE n.company_id=? ORDER BY n.pinned DESC, n.created_at DESC LIMIT 3`, cid) : [];
  const events = cid ? all(`SELECT e.*, (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id=e.id) attendees FROM events e WHERE e.company_id=? AND e.start_at >= datetime('now','-3 hours') ORDER BY e.start_at LIMIT 3`, cid) : [];
  const rank = cid ? all(`SELECT user_id, SUM(driven_km) km FROM jobs WHERE company_id=? AND status='delivered' AND finished_at >= datetime('now','start of month') GROUP BY user_id ORDER BY km DESC`, cid) : [];
  const active = get(`SELECT * FROM jobs WHERE user_id=? AND status='active' ORDER BY started_at DESC LIMIT 1`, uid) || null;
  const pos = rank.findIndex((r) => r.user_id === uid);
  res.json({ month, daily, recent, news, events, active, companyRank: pos >= 0 ? pos + 1 : null, companySize: rank.length,
    openPayout: get(`SELECT COALESCE(SUM(payout),0) n FROM jobs WHERE user_id=? AND review='approved' AND payroll_id IS NULL`, uid).n });
}));

// =====================================================================
// TELEMETRIE-CLIENT (Authentifizierung per API-Token "fw_…")
// =====================================================================
// ---------- Client-Kopplung: Client zeigt Code, Fahrer bestätigt im Browser ----------
const pairs = new Map(); // secret -> { code, created, token, user }
const PAIR_TTL = 10 * 60_000;
const pairCode = () => Array.from(crypto.randomBytes(6), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
setInterval(() => { for (const [k, p] of pairs) if (Date.now() - p.created > PAIR_TTL) pairs.delete(k); }, 60_000).unref();

api.post('/client/pair/start', limit(20, 60_000), wrap((req, res) => {
  if (pairs.size > 500) return bad(res, 'Zu viele offene Kopplungen', 429);
  const secret = crypto.randomBytes(24).toString('base64url'); const code = pairCode();
  pairs.set(secret, { code, created: Date.now(), token: null });
  res.json({ code, secret, expires_in: PAIR_TTL / 1000 });
}));
api.get('/client/pair/poll', wrap((req, res) => {
  const p = pairs.get(String(req.query.secret || ''));
  if (!p) return bad(res, 'Kopplung abgelaufen', 404);
  if (!p.token) return res.json({ status: 'pending' });
  pairs.delete(String(req.query.secret));
  res.json({ status: 'done', token: p.token, user: p.user });
}));
api.post('/client/pair/confirm', auth, wrap((req, res) => {
  const code = str(req.body.code, 12).toUpperCase();
  const p = [...pairs.values()].find((x) => x.code === code && !x.token && Date.now() - x.created < PAIR_TTL);
  if (!p) return bad(res, 'Code ungültig oder abgelaufen – starte den Client neu', 404);
  p.token = req.user.api_token; p.user = req.user.display_name;
  res.json({ ok: true });
}));

api.get('/client/ping', auth, wrap((req, res) => {
  res.json({ ok: true, user: req.user.display_name, company: req.member?.company_name || null });
}));

api.post('/client/job/start', auth, wrap((req, res) => {
  const f = jobFields(req.body);
  // offene Tour ggf. als abgebrochen markieren
  run(`UPDATE jobs SET status='cancelled', review='rejected', finished_at=datetime('now') WHERE user_id=? AND status='active'`, req.user.id);
  const r = run(`INSERT INTO jobs (user_id,company_id,source,game,status,review,origin_city,origin_company,dest_city,dest_company,cargo,cargo_mass,truck,planned_km,income)
    VALUES (?,?, 'client', ?, 'active', 'pending', ?,?,?,?,?,?,?,?,?)`, req.user.id, req.member?.company_id ?? null, f.game, f.origin_city, f.origin_company, f.dest_city, f.dest_company,
    f.cargo, f.cargo_mass, f.truck, f.planned_km, f.income);
  res.json({ id: r.lastInsertRowid });
}));

api.post('/client/job/:id/finish', auth, wrap((req, res) => {
  const j = get(`SELECT * FROM jobs WHERE id=? AND user_id=? AND status='active'`, num(req.params.id), req.user.id);
  if (!j) return bad(res, 'Keine aktive Tour', 404);
  const b = req.body;
  tx(() => {
    run(`UPDATE jobs SET status=?, driven_km=?, fuel_used=?, damage=?, truck_damage=?, max_speed=?, avg_speed=?, fines=?, late=?, income=?, finished_at=datetime('now') WHERE id=?`,
      b.status === 'cancelled' ? 'cancelled' : 'delivered', Math.max(0, num(b.driven_km)), Math.max(0, num(b.fuel_used)), Math.min(100, Math.max(0, num(b.damage))),
      Math.min(100, Math.max(0, num(b.truck_damage))), Math.max(0, num(b.max_speed)), Math.max(0, num(b.avg_speed)), Math.max(0, num(b.fines)), b.late ? 1 : 0,
      b.income !== undefined ? Math.max(0, num(b.income)) : j.income, j.id);
    finalizeJob(j.id);
    // Kilometerstand des zugewiesenen Firmen-LKW fortschreiben
    if (j.company_id) run('UPDATE trucks SET odometer=odometer+? WHERE company_id=? AND assigned_user=?', Math.max(0, num(b.driven_km)), j.company_id, req.user.id);
  });
  const done = get('SELECT id,status,review,payout,origin_city,dest_city,cargo,driven_km,damage FROM jobs WHERE id=?', j.id);
  Live.broadcastEvent(req.user.id, done.status === 'delivered' ? 'delivery' : 'cancel', { job: done, display_name: req.user.display_name });
  if (done.status === 'delivered') notify(j.company_id, 'delivery', embeds.delivery({ ...done, cargo_mass: j.cargo_mass }, req.user.display_name));
  res.json({ ok: true, job: done });
}));

api.post('/client/telemetry', auth, wrap((req, res) => {
  Live.update(req.user.id, req.body || {});
  res.json({ ok: true });
}));

// ---------- Live-Karte ----------
const viewerOf = (req) => (req.user ? { userId: req.user.id, companyId: req.member?.company_id || null } : null);

api.get('/live', auth, wrap((req, res) => {
  res.json(Live.list(viewerOf(req), req.query.scope === 'company' ? 'company' : 'all'));
}));

// Server-Sent Events: EventSource kann keine Header setzen, daher Token per Query
api.get('/stream', (req, res, next) => {
  if (req.query.access_token) req.headers.authorization = `Bearer ${req.query.access_token}`;
  next();
}, auth, (req, res) => Live.subscribe(req, res, viewerOf(req), req.query.scope === 'company' ? 'company' : 'all'));

api.get('/public/live', wrap((req, res) => res.json(Live.list(null, 'all'))));
api.get('/public/stream', (req, res) => Live.subscribe(req, res, null, 'all'));

api.get('/public/activity', wrap((req, res) => {
  res.json(all(`SELECT j.id, j.origin_city, j.dest_city, j.cargo, j.cargo_mass, j.driven_km, j.finished_at, j.game,
      u.display_name, u.username, u.avatar_hue, u.avatar_url, c.tag company_tag, c.hue company_hue
    FROM jobs j JOIN users u ON u.id=j.user_id LEFT JOIN companies c ON c.id=j.company_id
    WHERE j.status='delivered' AND u.live_public=1 ORDER BY j.finished_at DESC LIMIT 12`));
}));

module.exports = { api, finalizeJob };
