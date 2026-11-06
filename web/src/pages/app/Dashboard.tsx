import { Link } from 'react-router-dom';
import { Route, Coins, Package, ShieldCheck, Radio, CalendarDays, Megaphone, Plus, Trophy, Wallet, ArrowRight, Download, Pin } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { Card, CardHeader, Stat, PageLoader, Avatar, Badge, Button, Empty, ReviewBadge, Progress } from '../../components/ui';
import { AreaTrend, fillDays } from '../../components/charts';
import { ago, dateTime, eur, km, num } from '../../lib/format';
import { useState } from 'react';
import { JobModal, NewJobModal } from './Jobs';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
}

export default function Dashboard() {
  const { me } = useAuth();
  const { data: d, reload } = useApi('/dashboard');
  const [jobId, setJobId] = useState<number | null>(null);
  const [newJob, setNewJob] = useState(false);
  if (!d || !me) return <PageLoader />;
  const unlocked = me.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="label text-amber-400/80">Cockpit</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-[34px]">{greeting()}, {me.user.display_name.split(' ')[0]}</h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            {d.companyRank ? <>Du bist diesen Monat <span className="font-semibold text-amber-300">Platz {d.companyRank}</span> von {d.companySize} in deiner Firma.</> : 'Starte den Client und fahr deine erste Tour.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNewJob(true)}><Plus className="h-4 w-4" /> Tour einreichen</Button>
          <Button to="/app/client"><Download className="h-4 w-4" /> Client</Button>
        </div>
      </div>

      {d.active && (
        <Card className="border-cyan-500/20 bg-cyan-500/[0.04] p-5">
          <div className="flex flex-wrap items-center gap-4">
            <span className="relative flex h-3 w-3"><span className="absolute inset-0 animate-ping rounded-full bg-cyan-400" /><span className="relative h-3 w-3 rounded-full bg-cyan-400" /></span>
            <div className="flex-1"><div className="text-xs uppercase tracking-widest text-cyan-300">Aktuelle Tour</div><div className="font-display text-lg font-semibold text-white">{d.active.origin_city} → {d.active.dest_city}</div><div className="text-sm text-zinc-400">{d.active.cargo} · {num(d.active.cargo_mass, 1)} t · {eur(d.active.income)}</div></div>
            <Button to="/app/live" variant="outline" size="sm"><Radio className="h-4 w-4" /> Live ansehen</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Kilometer · Monat" value={d.month.km} icon={Route} format={(n) => km(n)} hint={`${d.month.jobs} Lieferungen`} />
        <Stat label="Verdienst · Monat" value={d.month.payout} icon={Coins} format={(n) => eur(n)} accent="cyan" hint="nach Abzügen" />
        <Stat label="Offene Auszahlung" value={d.openPayout} icon={Wallet} format={(n) => eur(n)} accent="emerald" hint="nächster Lohnlauf" />
        <Stat label="Ø Frachtschaden" value={d.month.damage} icon={ShieldCheck} format={(n) => `${num(n, 1)} %`} accent="violet" hint={d.month.damage < 2 ? 'Saubere Arbeit!' : 'Da geht noch was'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="Deine letzten 30 Tage" subtitle="Kilometer und Verdienst pro Tag" icon={Route} />
          <div className="px-3 pb-4"><AreaTrend data={fillDays(d.daily, 30, ['km', 'payout'])} series={[{ key: 'km', name: 'Kilometer', color: '#ff8a1f', unit: ' km' }, { key: 'payout', name: 'Verdienst', color: '#22d3ee', unit: ' €' }]} height={270} /></div>
        </Card>

        <Card glow>
          <CardHeader title={`Level ${me.level.level}`} subtitle={`${num(me.user.xp)} XP gesamt`} icon={Trophy} action={<Link to="/app/profile" className="text-xs text-amber-400 hover:text-amber-300">Alle Erfolge</Link>} />
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between text-xs text-zinc-500"><span>{num(me.level.current)} XP</span><span>{num(me.level.next)} XP</span></div>
            <Progress value={me.level.progress} className="mt-2 h-2" />
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[['Lieferungen', num(me.stats.jobs)], ['Kilometer', num(me.stats.km)], ['Tonnage', `${num(me.stats.tonnage)} t`], ['Erfolge', `${unlocked}/${me.achievements.length}`]].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="label">{l}</div><div className="mt-1 font-display text-lg font-semibold text-white">{v}</div></div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="Letzte Touren" icon={Package} action={<Link to="/app/jobs" className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300">Alle <ArrowRight className="h-3 w-3" /></Link>} />
          {d.recent.length ? (
            <div className="divide-y divide-white/[0.04] px-2 pb-2">
              {d.recent.map((j: any) => (
                <button key={j.id} onClick={() => setJobId(j.id)} className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.03]">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]"><Package className="h-4 w-4 text-zinc-400" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{j.origin_city} <span className="text-zinc-600">→</span> {j.dest_city}</div>
                    <div className="truncate text-xs text-zinc-500">{j.cargo} · {num(j.cargo_mass, 1)} t · {ago(j.finished_at || j.started_at)}</div>
                  </div>
                  <div className="hidden sm:block"><ReviewBadge review={j.review} status={j.status} /></div>
                  <div className="w-24 text-right"><div className="font-mono text-sm text-white">{eur(j.payout)}</div><div className="font-mono text-[11px] text-zinc-500">{km(j.driven_km)}</div></div>
                </button>
              ))}
            </div>
          ) : <Empty icon={Route} title="Noch keine Touren" text="Starte den Client oder reiche eine Tour manuell ein." action={<Button to="/app/client">Client einrichten</Button>} />}
        </Card>

        <div className="space-y-6">
          {me.member ? (<>
            <Card>
              <CardHeader title="Nächste Events" icon={CalendarDays} action={<Link to="/app/company/events" className="text-xs text-amber-400">Alle</Link>} />
              <div className="space-y-2 px-5 pb-5">
                {d.events.length ? d.events.map((e: any) => (
                  <Link to="/app/company/events" key={e.id} className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.04]">
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-white">{e.title}</span><Badge tone="amber">{ago(e.start_at)}</Badge></div>
                    <div className="mt-1 text-xs text-zinc-500">{dateTime(e.start_at)} · {e.attendees} Zusagen</div>
                  </Link>
                )) : <p className="text-sm text-zinc-500">Keine Events geplant.</p>}
              </div>
            </Card>
            <Card>
              <CardHeader title="Firmen-News" icon={Megaphone} action={<Link to="/app/company/news" className="text-xs text-amber-400">Alle</Link>} />
              <div className="space-y-4 px-5 pb-5">
                {d.news.length ? d.news.map((n: any) => (
                  <div key={n.id} className="flex gap-3">
                    <Avatar name={n.author || '?'} hue={n.avatar_hue} src={n.avatar_url} size={30} />
                    <div className="min-w-0"><div className="flex items-center gap-1.5 text-sm font-medium text-white">{n.pinned ? <Pin className="h-3 w-3 text-amber-400" /> : null}{n.title}</div><p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{n.body}</p><div className="mt-1 text-[11px] text-zinc-600">{n.author} · {ago(n.created_at)}</div></div>
                  </div>
                )) : <p className="text-sm text-zinc-500">Noch keine Neuigkeiten.</p>}
              </div>
            </Card>
          </>) : (
            <Card glow className="p-6">
              <h3 className="font-display text-lg font-semibold text-white">Noch ohne Firma?</h3>
              <p className="mt-1 text-sm text-zinc-400">Gründe deine eigene Spedition oder tritt einer bestehenden bei.</p>
              <Button to="/app/onboarding" className="mt-4 w-full">Firma finden oder gründen</Button>
            </Card>
          )}
        </div>
      </div>

      <JobModal id={jobId} onClose={() => setJobId(null)} onChange={reload} />
      <NewJobModal open={newJob} onClose={() => setNewJob(false)} onDone={reload} />
    </div>
  );
}
