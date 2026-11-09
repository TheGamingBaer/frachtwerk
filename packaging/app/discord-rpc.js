// Discord Rich Presence ohne Zusatzpakete: spricht das lokale Discord-IPC-Protokoll
// (Windows: Named Pipe \\?\pipe\discord-ipc-N, Linux/macOS: Unix-Socket discord-ipc-N).
// Rahmen: [opcode uint32 LE][länge uint32 LE][JSON]  · Opcodes: 0 Handshake, 1 Frame, 2 Close, 3 Ping, 4 Pong
const net = require('net');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function pipePath(i) {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${i}`;
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  return path.join(base, `discord-ipc-${i}`);
}

function encode(op, data) {
  const json = Buffer.from(JSON.stringify(data), 'utf8');
  const head = Buffer.alloc(8); head.writeUInt32LE(op, 0); head.writeUInt32LE(json.length, 4);
  return Buffer.concat([head, json]);
}

/**
 * createPresence({ clientId, log }) → { set(activity|null), stop(), connected }
 * Verbindet sich selbstständig (auch wenn Discord erst später gestartet wird) und
 * hält Discords Limit ein (höchstens alle 15 s eine Aktualisierung).
 */
function createPresence({ clientId, log = () => {} }) {
  let sock = null, ready = false, stopped = false, retry = null, pending = undefined, lastSent = 0, timer = null, lastJson = '';
  const api = { connected: false };

  function tryConnect(i = 0) {
    if (stopped || sock) return;
    if (i > 9) { retry = setTimeout(() => tryConnect(0), 20_000); return; } // Discord läuft (noch) nicht
    const s = net.connect(pipePath(i));
    let buf = Buffer.alloc(0);
    s.once('error', () => { s.destroy(); if (!ready) tryConnect(i + 1); });
    s.once('connect', () => {
      sock = s;
      s.write(encode(0, { v: 1, client_id: String(clientId) }));
      s.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 8) {
          const op = buf.readUInt32LE(0), len = buf.readUInt32LE(4);
          if (buf.length < 8 + len) break;
          let msg = {}; try { msg = JSON.parse(buf.slice(8, 8 + len).toString('utf8')); } catch {}
          buf = buf.slice(8 + len);
          if (op === 3) s.write(encode(4, msg));                                   // Ping → Pong
          else if (op === 2) { log('Discord: Verbindung beendet', msg.message || ''); s.destroy(); }
          else if (msg.evt === 'READY') { ready = true; api.connected = true; log('Discord verbunden als', msg.data?.user?.username || '?'); lastJson = ''; flush(true); }
          else if (msg.evt === 'ERROR') log('Discord-Fehler:', msg.data?.message || JSON.stringify(msg.data));
        }
      });
      s.on('close', () => {
        sock = null; ready = false; api.connected = false;
        if (!stopped) retry = setTimeout(() => tryConnect(0), 15_000);
      });
    });
  }

  function flush(force) {
    if (!ready || pending === undefined) return;
    const json = JSON.stringify(pending);
    if (!force && json === lastJson) return;
    const wait = 15_000 - (Date.now() - lastSent);
    if (!force && wait > 0) { clearTimeout(timer); timer = setTimeout(() => flush(true), wait); return; }
    lastSent = Date.now(); lastJson = json;
    sock.write(encode(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: pending }, nonce: crypto.randomUUID() }));
  }

  api.set = (activity) => { pending = activity || null; flush(false); };
  api.stop = () => {
    stopped = true; clearTimeout(retry); clearTimeout(timer);
    if (sock) { try { sock.write(encode(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: null }, nonce: crypto.randomUUID() })); } catch {} sock.end(); }
  };
  if (clientId) tryConnect(0);
  return api;
}

module.exports = { createPresence, encode, pipePath };
