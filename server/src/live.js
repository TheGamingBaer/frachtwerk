// Echtzeit-Hub: Live-Positionen, Spuren und Server-Sent-Events
const { get, all, run } = require('./db');

const STALE_MS = 90_000;
const TRAIL_MIN = 60;     // Spieleinheiten (~1 km) zwischen zwei Spurpunkten
const TRAIL_MAX = 600;

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const s = (v, max = 80) => (typeof v === 'string' ? v.slice(0, max) : '');

const baseSql = `SELECT l.user_id, l.data, l.trail, l.updated_at, u.username, u.display_name, u.avatar_hue, u.avatar_url, u.live_public,
  m.company_id, m.rank_title, c.name company_name, c.tag company_tag, c.hue company_hue, c.slug company_slug
  FROM live l JOIN users u ON u.id=l.user_id LEFT JOIN memberships m ON m.user_id=l.user_id LEFT JOIN companies c ON c.id=m.company_id`;

/** Datensatz für die Karte. `full`=false entfernt Details für die öffentliche Karte. */
function shape(r, full = true) {
  const d = JSON.parse(r.data);
  const out = {
    user_id: r.user_id, username: r.username, display_name: r.display_name, avatar_hue: r.avatar_hue, avatar_url: r.avatar_url,
    company_id: r.company_id, company_name: r.company_name, company_tag: r.company_tag, company_hue: r.company_hue ?? r.avatar_hue, company_slug: r.company_slug,
    game: d.game, x: d.x, z: d.z, heading: d.heading, speed: d.speed, paused: d.paused, updated_at: r.updated_at,
    origin: d.origin, destination: d.destination, cargo: d.cargo, truck: d.truck,
  };
  if (full) Object.assign(out, { remaining_km: d.remaining_km, eta_min: d.eta_min, fuel: d.fuel, fuel_capacity: d.fuel_capacity, damage: d.damage, cargo_mass: d.cargo_mass, income: d.income, rank_title: r.rank_title, trail: JSON.parse(r.trail || '[]') });
  else out.trail = JSON.parse(r.trail || '[]').slice(-120);
  return out;
}

/** Wer darf wen sehen? */
function visible(row, viewer, scope) {
  if (scope === 'company') return !!viewer?.companyId && row.company_id === viewer.companyId;
  if (viewer && (row.user_id === viewer.userId || (viewer.companyId && row.company_id === viewer.companyId))) return true;
  return !!row.live_public;
}

function list(viewer, scope) {
  return all(`${baseSql} WHERE l.updated_at > ?`, Date.now() - STALE_MS)
    .filter((r) => visible(r, viewer, scope))
    .map((r) => shape(r, !!viewer && (scope === 'company' || r.company_id === viewer.companyId || r.user_id === viewer.userId)));
}

// ---------- SSE ----------
const clients = new Set();

function subscribe(req, res, viewer, scope) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(`retry: 3000\n`);
  const client = { res, viewer, scope };
  clients.add(client);
  send(client, 'snapshot', list(viewer, scope));
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => { clearInterval(ping); clients.delete(client); });
}
function send(c, event, data) { c.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }

function broadcastDriver(userId) {
  const r = get(`${baseSql} WHERE l.user_id=?`, userId);
  if (!r) return;
  for (const c of clients) {
    if (!visible(r, c.viewer, c.scope)) continue;
    const full = !!c.viewer && (c.scope === 'company' || r.company_id === c.viewer.companyId || r.user_id === c.viewer.userId);
    const d = shape(r, full);
    d.trail = d.trail.slice(-3); // Updates tragen nur die letzten Punkte, der Client hängt sie an
    send(c, 'driver', d);
  }
}

function broadcastEvent(userId, event, payload) {
  const r = get(`SELECT u.id user_id, u.live_public, m.company_id FROM users u LEFT JOIN memberships m ON m.user_id=u.id WHERE u.id=?`, userId);
  if (!r) return;
  for (const c of clients) if (visible(r, c.viewer, c.scope)) send(c, event, { user_id: userId, ...payload });
}

/** Telemetrie speichern + Spur fortschreiben */
function update(userId, b) {
  const data = {
    game: b.game === 'ats' ? 'ats' : 'ets2', paused: !!b.paused, speed: n(b.speed), truck: s(b.truck), cargo: s(b.cargo), cargo_mass: n(b.cargo_mass), income: n(b.income),
    origin: s(b.origin, 60), destination: s(b.destination, 60), remaining_km: n(b.remaining_km), eta_min: n(b.eta_min),
    fuel: n(b.fuel), fuel_capacity: n(b.fuel_capacity), damage: n(b.damage), x: n(b.x), z: n(b.z), heading: n(b.heading),
  };
  const prev = get('SELECT data, trail FROM live WHERE user_id=?', userId);
  let trail = prev ? JSON.parse(prev.trail || '[]') : [];
  const prevGame = prev ? JSON.parse(prev.data).game : data.game;
  const last = trail[trail.length - 1];
  if (prevGame !== data.game || (last && Math.hypot(last[0] - data.x, last[1] - data.z) > 25_000)) trail = []; // Spielwechsel / Fähre / Teleport
  if ((data.x || data.z) && (!last || Math.hypot(last[0] - data.x, last[1] - data.z) >= TRAIL_MIN)) trail.push([Math.round(data.x), Math.round(data.z)]);
  if (trail.length > TRAIL_MAX) trail = trail.slice(-TRAIL_MAX);
  run(`INSERT INTO live (user_id,data,trail,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, trail=excluded.trail, updated_at=excluded.updated_at`,
    userId, JSON.stringify(data), JSON.stringify(trail), Date.now());
  broadcastDriver(userId);
}

function remove(userId) {
  run('DELETE FROM live WHERE user_id=?', userId);
  broadcastEvent(userId, 'leave', {});
}

module.exports = { list, subscribe, update, remove, broadcastEvent, STALE_MS };
