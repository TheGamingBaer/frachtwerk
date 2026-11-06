// Demo-Daten: node src/seed.js  (löscht NICHTS, legt nur an, wenn "demo" noch nicht existiert)
const bcrypt = require('bcryptjs');
const { get, run, tx } = require('./db');
const { newApiToken } = require('./auth');
const { finalizeJob } = require('./api');
const L = require('./logic');

function seedDemo() {
if (get("SELECT id FROM users WHERE username='demo'")) { console.log('Demo-Daten existieren bereits.'); return false; }

const pw = bcrypt.hashSync('demo1234', 10);
const drivers = [
  ['demo', 'Max Brenner', 28], ['kira', 'Kira Vogt', 200], ['jonas', 'Jonas Falk', 140], ['leni', 'Leni Arndt', 320],
  ['tobi', 'Tobi Keller', 90], ['sven', 'Sven Holm', 175], ['mira', 'Mira Szabo', 260], ['ole', 'Ole Jansen', 50],
];
const cities = ['Berlin', 'Hamburg', 'München', 'Frankfurt', 'Köln', 'Stuttgart', 'Dresden', 'Leipzig', 'Hannover', 'Nürnberg', 'Wien', 'Prag', 'Warschau',
  'Amsterdam', 'Rotterdam', 'Brüssel', 'Paris', 'Lyon', 'Mailand', 'Turin', 'Zürich', 'Kopenhagen', 'Stockholm', 'Oslo', 'Posen', 'Linz', 'Graz', 'Calais'];
const firms = ['Tradeaux', 'Kaarfor', 'Posped', 'Lisette Logistics', 'Eurogoodies', 'Transinet', 'Wilnet Trans', 'Fle', 'Stokes', 'NBFC', 'ITCC', 'Quarry Corp'];
const cargo = [['Maschinenteile', 18], ['Kühlware', 22], ['Holzstämme', 32], ['Bagger', 41], ['Elektronik', 12], ['Medikamente', 8], ['Stahlträger', 28],
  ['Lebensmittel', 20], ['Chemikalien', 24], ['Möbel', 14], ['Autos', 16], ['Beton', 36], ['Transformator', 44]];
const trucks = ['Scania S 730', 'Volvo FH16', 'MAN TGX', 'DAF XG+', 'Mercedes Actros', 'Renault T High', 'Iveco S-Way'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

tx(() => {
  const ids = drivers.map(([u, n, h], i) => run(`INSERT INTO users (username,email,password_hash,display_name,avatar_hue,api_token,bio,is_admin) VALUES (?,?,?,?,?,?,?,?)`,
    u, `${u}@demo.local`, pw, n, h, newApiToken(), i === 0 ? 'Fährt seit 2014 durch Europa. Lieblingsstrecke: Brenner-Pass bei Nacht.' : '', i === 0 ? 1 : 0).lastInsertRowid);

  const mk = (name, tag, slug, hue, desc, owner, mode) => {
    const id = run(`INSERT INTO companies (name,tag,slug,description,hue,join_mode,invite_code,owner_id,balance,discord) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      name, tag, slug, desc, hue, mode, Math.random().toString(16).slice(2, 10).toUpperCase(), owner, 250000, 'https://discord.gg/').lastInsertRowid;
    run(`INSERT INTO transactions (company_id,type,amount,description,created_at) VALUES (?, 'deposit', 250000, 'Startkapital', datetime('now','-62 days'))`, id);
    return id;
  };
  const c1 = mk('Nordlicht Logistik', 'NLX', 'nordlicht-logistik', 28, 'Seriöse Spedition mit Herz. Wöchentliche Konvois, faire Abrechnung, aktive Community. Wir fahren schwer, weit und sauber.', ids[0], 'apply');
  const c2 = mk('Alpen Express', 'ALPX', 'alpen-express', 200, 'Spezialisiert auf Alpenrouten und Schwertransporte. Entspannte Truppe, jeden Freitag Konvoi.', ids[5], 'open');

  const roles = [['owner', 'Geschäftsführer'], ['admin', 'Disponentin'], ['dispatcher', 'Disponent'], ['driver', 'Fernfahrerin'], ['driver', 'Fahrer']];
  ids.forEach((uid, i) => {
    const cid = i < 5 ? c1 : c2;
    const [r, t] = i < 5 ? roles[i] : i === 5 ? ['owner', 'Chef'] : ['driver', 'Fahrer'];
    run('INSERT INTO memberships (user_id,company_id,role,rank_title,joined_at) VALUES (?,?,?,?,datetime(\'now\',\'-60 days\'))', uid, cid, r, t);
  });

  // Touren der letzten 60 Tage
  for (let d = 60; d >= 0; d--) {
    if (d === 0) run('UPDATE companies SET auto_approve=0 WHERE id=?', c1); // heutige Touren warten auf Prüfung
    ids.forEach((uid, i) => {
      if (Math.random() < 0.45) return;
      const n = 1 + Math.floor(Math.random() * 2);
      for (let k = 0; k < n; k++) {
        const [cg, mass] = pick(cargo);
        const from = pick(cities); let to = pick(cities); while (to === from) to = pick(cities);
        const km = Math.round(180 + Math.random() * 1300);
        const dmg = Math.random() < 0.55 ? 0 : Math.round(Math.random() * 60) / 10;
        const income = Math.round(km * (38 + Math.random() * 30) + mass * 120);
        const cid = i < 5 ? c1 : c2;
        const h = Math.floor(Math.random() * 20);
        const r = run(`INSERT INTO jobs (user_id,company_id,source,status,review,origin_city,origin_company,dest_city,dest_company,cargo,cargo_mass,truck,planned_km,driven_km,income,fuel_used,damage,max_speed,avg_speed,started_at,finished_at)
          VALUES (?,?, 'client', 'delivered', 'pending', ?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now', ?), datetime('now', ?))`,
          uid, cid, from, pick(firms), to, pick(firms), cg, mass + Math.round(Math.random() * 40) / 10, pick(trucks), km, km + Math.round(Math.random() * 30), income,
          Math.round(km * (0.29 + Math.random() * 0.1)), dmg, 82 + Math.round(Math.random() * 18), 62 + Math.round(Math.random() * 12),
          `-${d} days`, `-${d} days`).lastInsertRowid;
        run(`UPDATE jobs SET started_at=datetime(started_at, ?), finished_at=datetime(finished_at, ?) WHERE id=?`, `-${h + 10} hours`, `-${h} hours`, r);
        finalizeJob(r);
        // ältere Touren mit der Transaktion zeitlich passend datieren
        run(`UPDATE transactions SET created_at=(SELECT finished_at FROM jobs WHERE id=?) WHERE job_id=?`, r, r);
      }
    });
  }

  // Lohnabrechnung des Vormonats für Nordlicht abschließen
  const period = get(`SELECT strftime('%Y-%m','now','start of month','-1 month') p`).p;
  for (const cid of [c1, c2]) {
    const rows = require('./db').all(`SELECT user_id, COUNT(*) jobs, SUM(driven_km) km, SUM(income) income, SUM(pay_base) gross, SUM(pay_bonus) bonus, SUM(pay_deductions) deductions, SUM(payout) net
      FROM jobs WHERE company_id=? AND review='approved' AND payroll_id IS NULL AND strftime('%Y-%m', finished_at)=? GROUP BY user_id`, cid, period);
    if (!rows.length) continue;
    const total = rows.reduce((s, r) => s + r.net, 0);
    const pid = run(`INSERT INTO payrolls (company_id,period,total,jobs,created_by,created_at) VALUES (?,?,?,?,?, datetime('now','start of month','+1 hours'))`, cid, period, L.r2(total), rows.reduce((s, r) => s + r.jobs, 0), cid === c1 ? ids[0] : ids[5]).lastInsertRowid;
    for (const r of rows) {
      run(`INSERT INTO payroll_items (payroll_id,user_id,jobs,km,income,gross,deductions,bonus,net) VALUES (?,?,?,?,?,?,?,?,?)`, pid, r.user_id, r.jobs, L.r2(r.km), L.r2(r.income), L.r2(r.gross), L.r2(r.deductions), L.r2(r.bonus), L.r2(r.net));
      run(`INSERT INTO transactions (company_id,user_id,type,amount,description,created_at) VALUES (?,?, 'payout', ?, ?, datetime('now','start of month','+1 hours'))`, cid, r.user_id, -L.r2(r.net), `Lohnabrechnung ${period}`);
    }
    run(`UPDATE jobs SET payroll_id=? WHERE company_id=? AND review='approved' AND payroll_id IS NULL AND strftime('%Y-%m', finished_at)=?`, pid, cid, period);
    run('UPDATE companies SET balance=balance-? WHERE id=?', L.r2(total), cid);
  }

  run('UPDATE companies SET auto_approve=1 WHERE id=?', c1);

  // Fuhrpark, Events, News
  const fleet = [['Scania', 'S 730 V8', 'NLX-001', ids[0], 182340], ['Volvo', 'FH16 750', 'NLX-002', ids[1], 98211], ['MAN', 'TGX 18.640', 'NLX-003', ids[2], 143902], ['DAF', 'XG+ 530', 'NLX-004', ids[3], 61204]];
  fleet.forEach(([b, m, p, u, o]) => run('INSERT INTO trucks (company_id,brand,model,plate,assigned_user,odometer,value) VALUES (?,?,?,?,?,?,?)', c1, b, m, p, u, o, 165000));
  run(`INSERT INTO events (company_id,title,description,start_at,origin,destination,server,created_by) VALUES (?,?,?,datetime('now','+2 days','start of day','+19 hours'),?,?,?,?)`,
    c1, 'Freitagskonvoi: Nordkap-Tour', 'Treffpunkt 18:45 am Rastplatz. Bitte mit eigenem Trailer und vollem Tank. Funk über Discord.', 'Hamburg', 'Kopenhagen', 'TruckersMP Simulation 1', ids[1]);
  run(`INSERT INTO events (company_id,title,description,start_at,origin,destination,server,created_by) VALUES (?,?,?,datetime('now','+9 days','start of day','+20 hours'),?,?,?,?)`,
    c1, 'Schwerlast-Abend', 'Nur Ladungen über 35 t. Begleitfahrzeuge willkommen.', 'München', 'Wien', 'Singleplayer', ids[0]);
  run(`INSERT INTO news (company_id,author_id,title,body,pinned) VALUES (?,?,?,?,1)`, c1, ids[0], 'Willkommen bei Frachtwerk! 🎉',
    'Wir sind umgezogen: Alle Touren laufen ab sofort automatisch über den Frachtwerk-Client. Token im Profil kopieren, Client starten, losfahren.');
  run(`INSERT INTO news (company_id,author_id,title,body,created_at) VALUES (?,?,?,?,datetime('now','-3 days'))`, c1, ids[1], 'Neue Kilometerpauschale',
    'Ab diesem Monat gibt es 0,45 € pro Kilometer plus 15 % Frachtanteil. Schadenfreie Touren bekommen 10 % Bonus obendrauf.');
  run(`INSERT INTO applications (company_id,user_id,message) VALUES (?,?,?)`, c1, ids[7], 'Hi! Fahre seit 3 Jahren, hauptsächlich Skandinavien. Würde mich freuen!');
});
console.log('✅ Demo-Daten angelegt. Login: demo / demo1234');
return true;
}

module.exports = { seedDemo };
if (require.main === module) seedDemo();
