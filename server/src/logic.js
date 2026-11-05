// Abrechnungs-Engine & Gamification
const { get, all, run } = require('./db');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Berechnet die Fahrervergütung einer Tour anhand der Firmen-Einstellungen. */
function computePayout(job, c) {
  const km = Number(job.driven_km) || 0;
  const income = Number(job.income) || 0;
  const lines = [];

  const kmPay = km * c.rate_per_km;
  const sharePay = income * (c.revenue_share / 100);
  const base = kmPay + sharePay;
  if (kmPay) lines.push({ label: `Kilometergeld (${km.toFixed(0)} km × ${c.rate_per_km.toFixed(2)} €)`, amount: r2(kmPay) });
  if (sharePay) lines.push({ label: `Frachtanteil (${c.revenue_share}% von ${income.toFixed(0)} €)`, amount: r2(sharePay) });

  let deductions = 0;
  let bonus = 0;

  const dmg = Number(job.damage) || 0;
  if (dmg > 0 && c.damage_penalty > 0) {
    const d = dmg * c.damage_penalty;
    deductions += d;
    lines.push({ label: `Frachtschaden (${dmg.toFixed(1)}% × ${c.damage_penalty} €)`, amount: -r2(d) });
  } else if (dmg === 0 && c.clean_bonus > 0 && km > 0) {
    bonus = base * (c.clean_bonus / 100);
    lines.push({ label: `Schadenfrei-Bonus (${c.clean_bonus}%)`, amount: r2(bonus) });
  }
  if (!c.company_pays_fuel && job.fuel_used > 0) {
    const f = job.fuel_used * c.fuel_price;
    deductions += f;
    lines.push({ label: `Kraftstoff (${job.fuel_used.toFixed(0)} l × ${c.fuel_price.toFixed(2)} €)`, amount: -r2(f) });
  }
  if (c.max_speed_limit > 0 && job.max_speed > c.max_speed_limit) {
    deductions += c.speeding_penalty;
    lines.push({ label: `Tempoverstoß (max. ${Math.round(job.max_speed)} km/h)`, amount: -r2(c.speeding_penalty) });
  }
  if (job.fines > 0) {
    deductions += job.fines;
    lines.push({ label: 'Bußgelder', amount: -r2(job.fines) });
  }
  const payout = Math.max(0, base + bonus - deductions);
  return { pay_base: r2(base), pay_bonus: r2(bonus), pay_deductions: r2(deductions), payout: r2(payout), lines };
}

/** XP = gefahrene km + Bonus für sauberes Fahren & schwere Ladung */
function xpForJob(job) {
  let xp = Math.round(job.driven_km || 0);
  if ((job.damage || 0) === 0) xp += 50;
  if ((job.cargo_mass || 0) >= 30) xp += 40;
  if (!job.late) xp += 20;
  return xp;
}

function levelFromXp(xp) {
  // Level-Kurve: jedes Level braucht etwas mehr
  let level = 1, need = 1000, acc = 0;
  while (xp >= acc + need) { acc += need; level++; need = Math.round(need * 1.12); }
  return { level, current: xp - acc, next: need, progress: (xp - acc) / need };
}

const ACHIEVEMENTS = [
  { id: 'first', icon: 'Flag', name: 'Erste Ladung', desc: 'Liefere deine erste Fracht ab', check: (s) => s.jobs >= 1 },
  { id: 'j25', icon: 'Package', name: 'Stammfahrer', desc: '25 Lieferungen', check: (s) => s.jobs >= 25 },
  { id: 'j100', icon: 'Boxes', name: 'Logistik-Profi', desc: '100 Lieferungen', check: (s) => s.jobs >= 100 },
  { id: 'k1', icon: 'Route', name: 'Tausender', desc: '1.000 km gefahren', check: (s) => s.km >= 1000 },
  { id: 'k10', icon: 'Milestone', name: 'Langstrecke', desc: '10.000 km gefahren', check: (s) => s.km >= 10000 },
  { id: 'k100', icon: 'Globe2', name: 'Kontinental', desc: '100.000 km gefahren', check: (s) => s.km >= 100000 },
  { id: 'clean10', icon: 'ShieldCheck', name: 'Samthandschuh', desc: '10 schadenfreie Touren', check: (s) => s.clean >= 10 },
  { id: 'heavy', icon: 'Weight', name: 'Schwergewicht', desc: 'Eine Ladung über 40 t', check: (s) => s.heaviest >= 40 },
  { id: 'long', icon: 'Moon', name: 'Nachtschicht', desc: 'Eine Tour über 1.500 km', check: (s) => s.longest >= 1500 },
  { id: 'rich', icon: 'Coins', name: 'Goldesel', desc: '1 Mio. € Frachterlös', check: (s) => s.income >= 1000000 },
];

function userStats(userId) {
  const s = get(`SELECT COUNT(*) jobs, COALESCE(SUM(driven_km),0) km, COALESCE(SUM(income),0) income,
      COALESCE(SUM(payout),0) earned, COALESCE(SUM(fuel_used),0) fuel,
      COALESCE(SUM(CASE WHEN damage=0 THEN 1 ELSE 0 END),0) clean,
      COALESCE(MAX(cargo_mass),0) heaviest, COALESCE(MAX(driven_km),0) longest,
      COALESCE(AVG(damage),0) avg_damage, COALESCE(SUM(cargo_mass),0) tonnage
    FROM jobs WHERE user_id=? AND status='delivered' AND review!='rejected'`, userId);
  return { ...s };
}

function achievementsFor(stats) {
  return ACHIEVEMENTS.map(({ check, ...a }) => ({ ...a, unlocked: !!check(stats) }));
}

function membership(userId) {
  return get(`SELECT m.*, c.name company_name, c.slug company_slug, c.tag company_tag, c.hue company_hue
              FROM memberships m JOIN companies c ON c.id=m.company_id WHERE m.user_id=?`, userId) || null;
}

/** Tour freigeben: Erlös auf das Firmenkonto buchen, XP vergeben */
function approveJob(job, company) {
  run(`UPDATE jobs SET review='approved' WHERE id=?`, job.id);
  if (company) {
    run(`INSERT INTO transactions (company_id,user_id,job_id,type,amount,description) VALUES (?,?,?,?,?,?)`,
      company.id, job.user_id, job.id, 'income', job.income, `Fracht: ${job.cargo || '?'} · ${job.origin_city} → ${job.dest_city}`);
    let delta = job.income;
    if (company.company_pays_fuel && job.fuel_used > 0) {
      const fuel = r2(job.fuel_used * company.fuel_price);
      run(`INSERT INTO transactions (company_id,user_id,job_id,type,amount,description) VALUES (?,?,?,?,?,?)`,
        company.id, job.user_id, job.id, 'fuel', -fuel, `Kraftstoff ${job.fuel_used.toFixed(0)} l`);
      delta -= fuel;
    }
    run(`UPDATE companies SET balance = balance + ? WHERE id=?`, delta, company.id);
  }
  run(`UPDATE users SET xp = xp + ? WHERE id=?`, xpForJob(job), job.user_id);
}

module.exports = { computePayout, xpForJob, levelFromXp, userStats, achievementsFor, membership, approveJob, r2, ACHIEVEMENTS };
