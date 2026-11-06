// Automatische Datenbank-Backups: täglich + beim Start, die letzten BACKUP_KEEP (Standard 14) bleiben erhalten
const fs = require('fs');
const path = require('path');
const { db, DB_PATH } = require('./db');

const DIR = process.env.BACKUP_DIR || path.join(path.dirname(DB_PATH), 'backups');
const KEEP = Number(process.env.BACKUP_KEEP || 14);

function list() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => /^frachtwerk-[\d-]+\.db$/.test(f))
    .map((f) => { const st = fs.statSync(path.join(DIR, f)); return { name: f, size: st.size, created_at: st.mtime.toISOString() }; })
    .sort((a, b) => b.name.localeCompare(a.name));
}

function backup() {
  fs.mkdirSync(DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const file = path.join(DIR, `frachtwerk-${stamp}.db`);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  for (const old of list().slice(KEEP)) fs.unlinkSync(path.join(DIR, old.name));
  return path.basename(file);
}

function schedule() {
  if (process.env.BACKUP_DISABLED) return;
  const last = list()[0];
  const ageH = last ? (Date.now() - Date.parse(last.created_at)) / 3600_000 : Infinity;
  try { if (ageH > 20) console.log('💾 Backup erstellt:', backup()); } catch (e) { console.error('Backup fehlgeschlagen:', e.message); }
  setInterval(() => { try { backup(); } catch (e) { console.error('Backup fehlgeschlagen:', e.message); } }, 24 * 3600_000).unref();
}

const filePath = (name) => (/^frachtwerk-[\d-]+\.db$/.test(name) ? path.join(DIR, name) : null);

module.exports = { backup, list, schedule, filePath, BACKUP_DIR: DIR };
