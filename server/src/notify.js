// Discord-Webhooks pro Firma: Lieferungen, Lohnläufe, Bewerbungen, neue Mitglieder, Events, News
const { get } = require('./db');

const EVENTS = ['delivery', 'payroll', 'application', 'member', 'event', 'news'];
const COLOR = { delivery: 0x34d399, payroll: 0x22d3ee, application: 0xffb347, member: 0xa78bfa, event: 0xff8a1f, news: 0xf472b6, test: 0xff8a1f };

const validWebhook = (url) => /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url || '');
const baseUrl = () => (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const eur = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

async function post(url, embed) {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Frachtwerk', embeds: [{ ...embed, timestamp: new Date().toISOString(), footer: { text: 'Frachtwerk' } }] }) });
    return r.ok;
  } catch { return false; }
}

/** Ereignis an den Webhook der Firma senden (asynchron, Fehler werden ignoriert) */
function notify(companyId, type, embed) {
  if (!companyId) return;
  const c = get('SELECT discord_webhook, webhook_events FROM companies WHERE id=?', companyId);
  if (!c || !validWebhook(c.discord_webhook)) return;
  if (!String(c.webhook_events || '').split(',').includes(type)) return;
  const link = embed.path && baseUrl() ? baseUrl() + embed.path : undefined;
  const { path, ...rest } = embed;
  post(c.discord_webhook, { color: COLOR[type], url: link, ...rest });
}

const embeds = {
  delivery: (job, driver) => ({
    title: ` ${driver} hat geliefert`, description: `**${job.origin_city} → ${job.dest_city}**\n${job.cargo}${job.cargo_mass ? ` · ${Number(job.cargo_mass).toFixed(1).replace('.', ',')} t` : ''}`,
    fields: [{ name: 'Strecke', value: `${Math.round(job.driven_km)} km`, inline: true }, { name: 'Schaden', value: `${Number(job.damage || 0).toFixed(1).replace('.', ',')} %`, inline: true }, { name: 'Lohn', value: eur(job.payout), inline: true }],
    path: '/app/jobs',
  }),
  payroll: (period, total, drivers) => ({ title: ` Lohnlauf ${period} abgeschlossen`, description: `${drivers} Fahrer · insgesamt **${eur(total)}** ausgezahlt.`, path: '/app/profile' }),
  application: (name, msg) => ({ title: ` Neue Bewerbung von ${name}`, description: msg ? `„${String(msg).slice(0, 300)}“` : 'Ohne Nachricht', path: '/app/company/members' }),
  member: (name) => ({ title: ` Willkommen, ${name}!`, description: 'Neues Mitglied im Team.', path: '/app/company/members' }),
  event: (e) => ({ title: ` Neues Event: ${e.title}`, description: `${e.origin ? `${e.origin} → ${e.destination}\n` : ''}${e.server || ''}\n${(e.description || '').slice(0, 300)}`, path: '/app/company/events' }),
  news: (n, author) => ({ title: ` ${n.title}`, description: String(n.body || '').slice(0, 1000), author: { name: author }, path: '/app/company/news' }),
};

module.exports = { notify, embeds, validWebhook, post, EVENTS };
