// Datenbank-Schicht: eingebautes node:sqlite (keine nativen Abhängigkeiten, läuft überall kostenlos)
process.removeAllListeners('warning');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'frachtwerk.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  bio TEXT DEFAULT '',
  country TEXT DEFAULT 'DE',
  avatar_hue INTEGER DEFAULT 28,
  api_token TEXT UNIQUE,
  xp INTEGER DEFAULT 0,
  is_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  tag TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  hue INTEGER DEFAULT 28,
  games TEXT DEFAULT 'ets2',
  language TEXT DEFAULT 'de',
  join_mode TEXT DEFAULT 'apply',          -- open | apply | invite
  invite_code TEXT,
  discord TEXT DEFAULT '',
  owner_id INTEGER REFERENCES users(id),
  balance REAL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  -- Abrechnungs-Einstellungen
  rate_per_km REAL DEFAULT 0.45,
  revenue_share REAL DEFAULT 15,           -- % vom Frachterlös für den Fahrer
  fuel_price REAL DEFAULT 1.65,            -- € / Liter
  company_pays_fuel INTEGER DEFAULT 1,
  damage_penalty REAL DEFAULT 25,          -- € pro % Schaden
  clean_bonus REAL DEFAULT 10,             -- % Bonus bei 0% Schaden
  max_speed_limit INTEGER DEFAULT 0,       -- 0 = aus; km/h, darüber Strafe
  speeding_penalty REAL DEFAULT 100,
  auto_approve INTEGER DEFAULT 1,
  min_distance INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'driver',     -- owner | admin | dispatcher | driver
  rank_title TEXT DEFAULT 'Fahrer',
  joined_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',           -- pending | accepted | rejected
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payrolls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period TEXT NOT NULL,                    -- YYYY-MM
  total REAL DEFAULT 0,
  jobs INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payroll_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payroll_id INTEGER NOT NULL REFERENCES payrolls(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  jobs INTEGER, km REAL, income REAL, gross REAL, deductions REAL, bonus REAL, net REAL
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'client',            -- client | manual
  game TEXT DEFAULT 'ets2',
  status TEXT DEFAULT 'delivered',         -- active | delivered | cancelled
  review TEXT DEFAULT 'pending',           -- pending | approved | rejected
  review_note TEXT DEFAULT '',
  origin_city TEXT, origin_company TEXT,
  dest_city TEXT, dest_company TEXT,
  cargo TEXT, cargo_mass REAL DEFAULT 0,   -- Tonnen
  truck TEXT,
  planned_km REAL DEFAULT 0,
  driven_km REAL DEFAULT 0,
  income REAL DEFAULT 0,
  fuel_used REAL DEFAULT 0,
  damage REAL DEFAULT 0,                   -- % Frachtschaden
  truck_damage REAL DEFAULT 0,
  max_speed REAL DEFAULT 0,
  avg_speed REAL DEFAULT 0,
  fines REAL DEFAULT 0,
  late INTEGER DEFAULT 0,
  -- berechnete Abrechnung
  pay_base REAL DEFAULT 0, pay_bonus REAL DEFAULT 0, pay_deductions REAL DEFAULT 0, payout REAL DEFAULT 0,
  payroll_id INTEGER REFERENCES payrolls(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id, finished_at);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id, finished_at);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  type TEXT NOT NULL,                      -- income | payout | expense | deposit | bonus | fuel
  amount REAL NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_company ON transactions(company_id, created_at);

CREATE TABLE IF NOT EXISTS trucks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand TEXT, model TEXT, plate TEXT,
  assigned_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
  odometer REAL DEFAULT 0,
  value REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT DEFAULT '',
  start_at TEXT NOT NULL,
  origin TEXT, destination TEXT, server TEXT DEFAULT 'TruckersMP Simulation 1',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS event_attendees (
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL, body TEXT DEFAULT '', pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS live (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

// kleine Helfer
const q = {
  get: (sql, ...p) => db.prepare(sql).get(...p),
  all: (sql, ...p) => db.prepare(sql).all(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
  tx: (fn) => {
    db.exec('BEGIN');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  },
};

module.exports = { db, ...q };

// ---------- Migrationen (idempotent) ----------
function addColumn(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addColumn('users', 'discord_id', 'TEXT');
addColumn('users', 'discord_name', 'TEXT');
addColumn('users', 'avatar_url', 'TEXT');
addColumn('users', 'has_password', 'INTEGER DEFAULT 1');
addColumn('users', 'live_public', 'INTEGER DEFAULT 1');
addColumn('live', 'trail', "TEXT DEFAULT '[]'");
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord ON users(discord_id)');
addColumn('users', 'banned', 'INTEGER DEFAULT 0');
addColumn('users', 'reset_hash', 'TEXT');
addColumn('users', 'reset_expires', 'INTEGER');
addColumn('users', 'last_seen', 'TEXT');
addColumn('companies', 'repair_rate', 'REAL DEFAULT 350');   // € je % LKW-Schaden (Werkstatt)
addColumn('companies', 'discord_webhook', "TEXT DEFAULT ''");
addColumn('companies', 'webhook_events', "TEXT DEFAULT 'delivery,payroll,application,member,event,news'");
module.exports.DB_PATH = DB_PATH;
