// Live-Simulation für Demo & Tests: lässt die Demo-Fahrer im Zeitraffer zwischen echten Städten fahren.
//   node scripts/simulate.js [--server http://localhost:8080] [--drivers 6] [--speed 12]
// --speed = simulierte km pro Sekunde (Zeitraffer)
process.removeAllListeners('warning');
const path = require('path');
const { all } = require('../src/db');
const geo = require(path.join(__dirname, '..', '..', 'web', 'public', 'geo', 'ets2.json'));

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const SERVER = arg('server', 'http://localhost:8080');
const N = Number(arg('drivers', 6));
const KMPS = Number(arg('speed', 12));

// Kartenkilometer -> Spielkoordinaten (Umkehrung von web/src/lib/gamegeo.ts)
const R = 6370.997, DEG = Math.PI / 180;
const FX = 0.0001729241463 * DEG * R, FZ = 0.000171570875 * DEG * R;
const toGame = ([x, y]) => [x / FX + 16660, y / FZ + 4150];

const CARGO = [['Maschinenteile', 18], ['Kühlware', 22], ['Holzstämme', 32], ['Bagger', 41], ['Elektronik', 12], ['Stahlträger', 28], ['Lebensmittel', 20], ['Transformator', 44]];
const TRUCKS = ['Scania S 730', 'Volvo FH16', 'MAN TGX', 'DAF XG+', 'Mercedes Actros', 'Renault T High'];
const UK = new Set(['London', 'Dover', 'Birmingham', 'Manchester', 'Liverpool', 'Leeds', 'Newcastle', 'Glasgow', 'Edinburgh', 'Aberdeen', 'Cardiff', 'Plymouth', 'Southampton', 'Cambridge', 'Felixstowe', 'Sheffield', 'Carlisle']);
const cities = geo.cities.filter((c) => !UK.has(c[0]) && Math.abs(c[1]) < 1700 && Math.abs(c[2]) < 1200);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function post(token, p, body) {
  const r = await fetch(`${SERVER}/api${p}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${p}: ${r.status}`);
  return r.json();
}

function newRoute(from) {
  const a = from || pick(cities);
  // Ziel 250–900 km entfernt
  const cands = cities.filter((c) => { const d = Math.hypot(c[1] - a[1], c[2] - a[2]); return d > 250 && d < 900; });
  const b = pick(cands.length ? cands : cities);
  // leicht geschwungene Strecke über einen Zwischenpunkt
  const mx = (a[1] + b[1]) / 2 + (Math.random() - 0.5) * 120, my = (a[2] + b[2]) / 2 + (Math.random() - 0.5) * 120;
  const [cg, mass] = pick(CARGO);
  return { a, b, pts: [[a[1], a[2]], [mx, my], [b[1], b[2]]], seg: 0, t: 0, cargo: cg, mass: mass + Math.round(Math.random() * 30) / 10 };
}

(async () => {
  const users = all(`SELECT id, display_name, api_token FROM users WHERE api_token IS NOT NULL ORDER BY id LIMIT ?`, N);
  if (!users.length) { console.log('Keine Benutzer – zuerst "npm run seed" ausführen.'); process.exit(1); }
  const drivers = users.map((u) => ({ u, r: newRoute(), fuel: 900 + Math.random() * 400, job: null, truck: pick(TRUCKS), odo: 100000 + Math.random() * 1e5 }));
  // zufälliger Fortschritt beim Start
  drivers.forEach((d) => { d.r.seg = Math.random() < 0.5 ? 0 : 1; d.r.t = Math.random(); });
  console.log(`🚚 Simuliere ${drivers.length} Fahrer gegen ${SERVER} (${KMPS} km/s Zeitraffer). Strg+C zum Beenden.`);

  const STEP = 1.5; // Sekunden
  setInterval(async () => {
    for (const d of drivers) {
      try {
        const r = d.r;
        if (!d.job) {
          const income = Math.round(Math.hypot(r.b[1] - r.a[1], r.b[2] - r.a[2]) * 60 + r.mass * 120);
          d.job = await post(d.u.api_token, '/client/job/start', { origin_city: r.a[0], dest_city: r.b[0], cargo: r.cargo, cargo_mass: r.mass, truck: d.truck, income,
            planned_km: Math.round(Math.hypot(r.pts[1][0] - r.pts[0][0], r.pts[1][1] - r.pts[0][1]) + Math.hypot(r.pts[2][0] - r.pts[1][0], r.pts[2][1] - r.pts[1][1])) });
          d.income = income; d.startOdo = d.odo;
          console.log(`▶ ${d.u.display_name}: ${r.a[0]} → ${r.b[0]} (${r.cargo})`);
        }
        // vorwärts bewegen
        let move = KMPS * STEP * (0.8 + Math.random() * 0.4);
        while (move > 0 && r.seg < r.pts.length - 1) {
          const [p, q] = [r.pts[r.seg], r.pts[r.seg + 1]];
          const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          const left = len * (1 - r.t);
          if (move < left) { r.t += move / len; d.odo += move; move = 0; } else { move -= left; d.odo += left; r.seg++; r.t = 0; }
        }
        const done = r.seg >= r.pts.length - 1;
        const [p, q] = done ? [r.pts[r.pts.length - 2], r.pts[r.pts.length - 1]] : [r.pts[r.seg], r.pts[r.seg + 1]];
        const pos = done ? q : [p[0] + (q[0] - p[0]) * r.t, p[1] + (q[1] - p[1]) * r.t];
        let remaining = done ? 0 : Math.hypot(q[0] - pos[0], q[1] - pos[1]);
        for (let i = r.seg + 1; i < r.pts.length - 1; i++) remaining += Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]);
        d.fuel = Math.max(80, d.fuel - 0.32 * KMPS * STEP);
        const [gx, gz] = toGame(pos);
        await post(d.u.api_token, '/client/telemetry', { game: 'ets2', speed: done ? 0 : 74 + Math.random() * 14, truck: d.truck, cargo: r.cargo, cargo_mass: r.mass, income: d.income,
          origin: r.a[0], destination: r.b[0], remaining_km: remaining, eta_min: remaining / 75 * 60, fuel: d.fuel, fuel_capacity: 1400, damage: 0, x: gx, z: gz });
        if (done) {
          const res = await post(d.u.api_token, `/client/job/${d.job.id}/finish`, { status: 'delivered', driven_km: Math.round(d.odo - d.startOdo), fuel_used: Math.round((d.odo - d.startOdo) * 0.31),
            damage: Math.random() < 0.7 ? 0 : Math.round(Math.random() * 30) / 10, max_speed: 89, avg_speed: 72 });
          console.log(`✔ ${d.u.display_name} hat in ${r.b[0]} abgeliefert → ${res.job.payout.toFixed(2)} €`);
          d.job = null; d.r = newRoute(r.b); if (d.fuel < 300) d.fuel = 1300;
        }
      } catch (e) { console.log(`Fehler bei ${d.u.display_name}: ${e.message}`); }
    }
  }, STEP * 1000);
})();
