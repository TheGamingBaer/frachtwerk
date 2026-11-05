import { Link } from 'react-router-dom';
import { Route, Coins, Package, Wallet, Users2, ShieldCheck, ClipboardCheck, UserPlus, ArrowRight, MapPin, ExternalLink } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { Avatar, Button, Card, CardHeader, CompanyBadge, PageLoader, Stat, Badge } from '../../components/ui';
import { AreaTrend, Bars, Donut, fillDays } from '../../components/charts';
import { can, eur, km, num, compact } from '../../lib/format';

const delta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);

export default function CompanyHome() {
  const { me } = useAuth();
  const { data: c } = useApi('/company');
  const { data: o } = useApi('/company/overview');
  if (!c || !o) return <PageLoader />;
  const staff = can(c.myRole, 'dispatcher');
  // Vergleich mit dem Vormonat auf gleichen Zeitraum hochrechnen
  const now = new Date(); const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); const frac = now.getDate() / dim;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8" style={{ background: `linear-gradient(120deg, hsl(${c.hue} 80% 40% / .22), rgba(10,12,18,.6) 55%)` }}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-[90px]" style={{ background: `hsl(${c.hue} 90% 50% / .35)` }} />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <CompanyBadge tag={c.tag} hue={c.hue} size={76} />
          <div className="flex-1">
            <div className="label text-white/50">Deine Spedition</div>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{c.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs"><Badge>{c.members.length} Mitglieder</Badge><Badge>{me?.member?.rank_title}</Badge></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button to={`/c/${c.slug}`} variant="outline" size="sm"><ExternalLink className="h-4 w-4" /> Öffentliche Seite</Button>
            {staff && <Button to="/app/company/payroll" size="sm">Abrechnung <ArrowRight className="h-4 w-4" /></Button>}
          </div>
        </div>
      </div>

      {staff && (c.pendingJobs > 0 || c.pendingApplications > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {c.pendingJobs > 0 && <Link to="/app/jobs" className="card flex items-center gap-4 border-amber-500/20 p-4 hover:bg-white/[0.04]"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15"><ClipboardCheck className="h-5 w-5 text-amber-400" /></div><div className="flex-1"><div className="font-medium text-white">{c.pendingJobs} Touren warten auf Prüfung</div><div className="text-xs text-zinc-500">Touren → Ganze Firma → In Prüfung</div></div><ArrowRight className="h-4 w-4 text-zinc-500" /></Link>}
          {c.pendingApplications > 0 && <Link to="/app/company/members" className="card flex items-center gap-4 border-cyan-500/20 p-4 hover:bg-white/[0.04]"><div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/15"><UserPlus className="h-5 w-5 text-cyan-400" /></div><div className="flex-1"><div className="font-medium text-white">{c.pendingApplications} neue Bewerbungen</div><div className="text-xs text-zinc-500">Jetzt ansehen</div></div><ArrowRight className="h-4 w-4 text-zinc-500" /></Link>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Kilometer · Monat" value={o.month.km} icon={Route} format={km} delta={delta(o.month.km, o.lastMonth.km * frac)} hint="vs. Vormonat" />
        <Stat label="Umsatz · Monat" value={o.month.income} icon={Coins} format={(n) => eur(n)} accent="cyan" delta={delta(o.month.income, o.lastMonth.income * frac)} hint="vs. Vormonat" />
        <Stat label="Lieferungen · Monat" value={o.month.jobs} icon={Package} accent="violet" hint={`${num(o.month.tonnage)} t bewegt`} />
        <Stat label="Firmenkonto" value={o.balance} icon={Wallet} format={(n) => eur(n)} accent="emerald" hint={`Ø Schaden ${num(o.month.damage, 1)} %`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title="Firmenleistung" subtitle="Letzte 30 Tage" icon={Route} />
          <div className="px-3 pb-4"><AreaTrend height={280} data={fillDays(o.daily, 30, ['km', 'income'])} series={[{ key: 'income', name: 'Umsatz', color: '#22d3ee', unit: ' €' }, { key: 'km', name: 'Kilometer', color: '#ff8a1f', unit: ' km' }]} /></div>
        </Card>
        <Card>
          <CardHeader title="Top-Fahrer des Monats" icon={Users2} />
          <div className="px-3 pb-4">
            {o.top.map((t: any, i: number) => (
              <Link key={t.id} to={`/driver/${t.username}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.03]">
                <span className={`grid h-6 w-6 place-items-center rounded-full font-mono text-xs ${i === 0 ? 'bg-amber-400 text-ink-950' : 'bg-white/5 text-zinc-500'}`}>{i + 1}</span>
                <Avatar name={t.display_name} hue={t.avatar_hue} size={34} />
                <div className="flex-1"><div className="text-sm font-medium text-white">{t.display_name}</div><div className="text-xs text-zinc-500">{t.jobs} Lieferungen</div></div>
                <span className="font-mono text-sm text-zinc-200">{compact(t.km)} km</span>
              </Link>
            ))}
            {!o.top.length && <p className="px-3 text-sm text-zinc-500">Diesen Monat noch keine Lieferungen.</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Beliebteste Frachten" icon={Package} /><div className="px-5 pb-6"><Donut data={o.cargo} dataKey="n" nameKey="name" /></div></Card>
        <Card><CardHeader title="Häufigste Ziele" icon={MapPin} /><div className="px-3 pb-4"><Bars data={o.routes} dataKey="n" nameKey="city" color="#22d3ee" /></div></Card>
      </div>

      <Card>
        <CardHeader title="Abrechnungsregeln" subtitle="So wird jede Tour vergütet" icon={ShieldCheck} action={can(c.myRole, 'admin') && <Link to="/app/company/settings" className="text-xs text-amber-400">Bearbeiten</Link>} />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          {[['Kilometergeld', `${num(c.rate_per_km, 2)} € / km`], ['Frachtanteil', `${num(c.revenue_share, 1)} %`], ['Schadenfrei-Bonus', `${num(c.clean_bonus, 1)} %`], ['Abzug je % Schaden', eur(c.damage_penalty)],
            ['Kraftstoff', c.company_pays_fuel ? 'zahlt die Firma' : `Fahrer · ${num(c.fuel_price, 2)} €/l`], ['Tempolimit', c.max_speed_limit ? `${c.max_speed_limit} km/h · ${eur(c.speeding_penalty)}` : 'aus'], ['Freigabe', c.auto_approve ? 'automatisch' : 'manuell'], ['Mindeststrecke', c.min_distance ? `${c.min_distance} km` : 'keine']].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="label">{l}</div><div className="mt-1 text-sm font-medium text-white">{v}</div></div>
          ))}
        </div>
      </Card>
    </div>
  );
}
