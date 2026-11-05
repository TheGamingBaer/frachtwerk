import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Navigation, Package, Fuel, Gauge, X, Crosshair, Globe2, Building2, CheckCircle2, Radio, Clock, ChevronDown, Download } from 'lucide-react';
import { LiveMap, LiveMapHandle } from '../../components/LiveMap';
import { useLiveDrivers, Driver } from '../../lib/live';
import { useApi, useAuth } from '../../lib/auth';
import { Avatar, Button, cx } from '../../components/ui';
import { ago, eur, num } from '../../lib/format';
import { Game } from '../../lib/gamegeo';

const hsl = (h: number, l = 60, a = 1) => `hsla(${h},90%,${l}%,${a})`;

export function StatusPill({ status, count }: { status: string; count: number }) {
  return (
    <span className={cx('inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1',
      status === 'live' ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25' : 'bg-amber-500/10 text-amber-300 ring-amber-500/25')}>
      <span className="relative flex h-2 w-2"><span className={cx('absolute inset-0 animate-ping rounded-full', status === 'live' ? 'bg-emerald-400' : 'bg-amber-400')} /><span className={cx('relative h-2 w-2 rounded-full', status === 'live' ? 'bg-emerald-400' : 'bg-amber-400')} /></span>
      {status === 'live' ? 'Live' : status === 'polling' ? 'Sync' : '…'} · {count}
    </span>
  );
}

export function EventFeed({ events }: { events: any[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const recent = events.filter((e) => now - e.at < 9000).slice(0, 3);
  return (
    <div className="pointer-events-none flex flex-col gap-2">
      <AnimatePresence>
        {recent.map((e) => (
          <motion.div key={e.id} layout initial={{ opacity: 0, x: -20, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }}
            className={cx('flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl', e.type === 'delivery' ? 'border-emerald-500/25 bg-[#07130f]/85' : 'border-rose-500/25 bg-[#140a0c]/85')}>
            {e.type === 'delivery' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <X className="h-5 w-5 shrink-0 text-rose-400" />}
            <div className="text-sm">
              <span className="font-semibold text-white">{e.display_name}</span>
              <span className="text-zinc-400"> {e.type === 'delivery' ? `hat ${e.job.cargo} in ${e.job.dest_city} abgeliefert` : 'hat eine Tour abgebrochen'}</span>
              {e.type === 'delivery' && e.job.payout > 0 && <span className="ml-1 font-mono text-emerald-300">+{eur(e.job.payout)}</span>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function DriverCard({ d, onClose, follow, setFollow }: { d: Driver; onClose: () => void; follow: boolean; setFollow: (f: boolean) => void }) {
  const fuel = d.fuel_capacity ? (d.fuel || 0) / d.fuel_capacity : null;
  const speed = Math.round(d.speed);
  return (
    <motion.div initial={{ opacity: 0, y: -10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.97 }}
      className="w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0a0e18]/85 shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] backdrop-blur-2xl sm:w-[340px]">
      <div className="relative p-5" style={{ background: `linear-gradient(135deg, ${hsl(d.company_hue, 50, 0.22)}, transparent 70%)` }}>
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        <div className="flex items-center gap-3">
          <Avatar name={d.display_name} hue={d.avatar_hue} src={d.avatar_url} size={46} />
          <div className="min-w-0">
            <Link to={`/driver/${d.username}`} className="block truncate font-display text-lg font-semibold text-white hover:text-amber-300">{d.display_name}</Link>
            <div className="truncate text-xs text-zinc-400">{d.company_name ? <><span style={{ color: hsl(d.company_hue, 70) }} className="font-mono">{d.company_tag}</span> · {d.company_name}</> : 'Freifahrer'}</div>
          </div>
        </div>
        <div className="mt-5 flex items-end justify-between">
          <div>
            <div className="font-display text-5xl font-bold leading-none tabular-nums text-white">{speed}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">km/h {d.paused && '· pausiert'}</div>
          </div>
          {/* Tacho-Bogen */}
          <svg viewBox="0 0 100 56" className="h-14 w-24">
            <path d="M8 50 A42 42 0 0 1 92 50" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" strokeLinecap="round" />
            <path d="M8 50 A42 42 0 0 1 92 50" fill="none" stroke={hsl(d.company_hue, 62)} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${Math.min(1, speed / 120) * 132} 200`} style={{ transition: 'stroke-dasharray .8s' }} />
          </svg>
        </div>
      </div>
      <div className="space-y-3 p-5 pt-3">
        {d.destination ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><Navigation className="h-4 w-4" style={{ color: hsl(d.company_hue, 65) }} />{d.origin} <span className="text-zinc-600">→</span> {d.destination}</div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-400"><Package className="h-3.5 w-3.5" />{d.cargo}{d.cargo_mass ? ` · ${num(d.cargo_mass, 1)} t` : ''}{d.income ? ` · ${eur(d.income)}` : ''}</div>
            {d.remaining_km !== undefined && (
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-zinc-400">noch <span className="font-mono text-white">{num(d.remaining_km)} km</span></span>
                {!!d.eta_min && <span className="flex items-center gap-1 text-zinc-500"><Clock className="h-3 w-3" />{Math.floor(d.eta_min / 60)} h {Math.round(d.eta_min % 60)} min</span>}
              </div>
            )}
          </div>
        ) : <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 text-sm text-zinc-400">Freie Fahrt – kein Auftrag</div>}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-white/[0.03] p-3"><div className="flex items-center gap-1.5 text-zinc-500"><Gauge className="h-3.5 w-3.5" />LKW</div><div className="mt-1 truncate text-sm text-white">{d.truck || '–'}</div></div>
          <div className="rounded-xl bg-white/[0.03] p-3">
            <div className="flex items-center gap-1.5 text-zinc-500"><Fuel className="h-3.5 w-3.5" />Tank</div>
            {fuel !== null ? <><div className="mt-1 font-mono text-sm text-white">{num(d.fuel)} l</div><div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10"><div className={cx('h-full rounded-full', fuel < 0.15 ? 'bg-rose-400' : 'bg-emerald-400')} style={{ width: `${fuel * 100}%` }} /></div></> : <div className="mt-1 text-sm text-zinc-500">–</div>}
          </div>
        </div>
        <Button variant={follow ? 'primary' : 'outline'} className="w-full" onClick={() => setFollow(!follow)}><Crosshair className="h-4 w-4" />{follow ? 'Wird verfolgt' : 'Verfolgen'}</Button>
      </div>
    </motion.div>
  );
}

export default function Live() {
  const { me } = useAuth();
  const [scope, setScope] = useState<'all' | 'company'>(me?.member ? 'company' : 'all');
  const [game, setGame] = useState<Game>('ets2');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [follow, setFollow] = useState(false);
  const [panel, setPanel] = useState(true);
  const map = useRef<LiveMapHandle>(null);
  const { drivers, store, version, events, status } = useLiveDrivers({ scope });
  const { data: company } = useApi(me?.member && scope === 'company' ? '/company' : null, [scope]);

  // Spiel automatisch wechseln, wenn nur dort jemand fährt
  useEffect(() => {
    if (!drivers.length) return;
    if (!drivers.some((d) => d.game === game)) setGame(drivers[0].game);
  }, [version]);
  useEffect(() => { setSel(null); setFollow(false); }, [scope]);

  const list = useMemo(() => drivers.filter((d) => d.game === game && (!q || `${d.display_name} ${d.company_tag || ''} ${d.destination || ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.speed > 3 ? 1 : 0) - (a.speed > 3 ? 1 : 0) || a.display_name.localeCompare(b.display_name)), [version, game, q]);
  const selected = sel ? store.current.get(sel) : null;
  const onlineIds = new Set(drivers.map((d) => d.user_id));
  const offline = scope === 'company' && company ? company.members.filter((m: any) => !onlineIds.has(m.id)) : [];
  const moving = list.filter((d) => d.speed > 3);
  const avgSpeed = moving.length ? moving.reduce((s, d) => s + d.speed, 0) / moving.length : 0;
  const tonnage = list.reduce((s, d) => s + (d.destination ? d.cargo_mass || 0 : 0), 0);

  const choose = (id: number) => { setSel(id); setFollow(true); map.current?.flyTo(id); };

  return (
    <div className="relative h-[calc(100dvh-4rem)] w-full lg:h-[100dvh]">
      <LiveMap ref={map} game={game} store={store} version={version} selectedId={sel} onSelect={(id) => { setSel(id); if (!id) setFollow(false); else map.current?.flyTo(id); }} follow={follow} onFollowChange={setFollow} compact={false} />

      {/* Seitenpanel */}
      <div className="absolute inset-x-3 bottom-3 z-20 sm:inset-x-auto sm:bottom-auto sm:left-4 sm:top-4 sm:w-[340px]">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0a0e18]/80 shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] backdrop-blur-2xl">
          <button onClick={() => setPanel(!panel)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
            <div><div className="font-display text-lg font-semibold text-white">Live-Map</div><div className="text-xs text-zinc-500">{scope === 'company' ? me?.member?.company_name : 'Alle Speditionen'}</div></div>
            <div className="flex items-center gap-2"><StatusPill status={status} count={list.length} /><ChevronDown className={cx('h-4 w-4 text-zinc-500 transition-transform', !panel && '-rotate-90')} /></div>
          </button>
          {panel && (
            <div className="border-t border-white/[0.06]">
              <div className="grid grid-cols-3 border-b border-white/[0.06] text-center">
                {[['Unterwegs', num(moving.length)], ['Ø Tempo', `${num(avgSpeed)}`], ['Tonnen', num(tonnage)]].map(([l, v], i) => (
                  <div key={l} className={cx('py-2.5', i && 'border-l border-white/[0.06]')}><div className="font-display text-base font-semibold tabular-nums text-white">{v}</div><div className="text-[9px] uppercase tracking-[0.16em] text-zinc-500">{l}</div></div>
                ))}
              </div>
              <div className="space-y-2 p-3">
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
                  {me?.member && <button onClick={() => setScope('company')} className={cx('flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition', scope === 'company' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300')}><Building2 className="h-3.5 w-3.5" />Meine Spedition</button>}
                  <button onClick={() => setScope('all')} className={cx('flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition', !me?.member && 'col-span-2', scope === 'all' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300')}><Globe2 className="h-3.5 w-3.5" />Alle Fahrer</button>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Fahrer, Firma, Ziel…" className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-8 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-500/50" />
                  </div>
                  <div className="flex rounded-xl bg-white/[0.04] p-1">
                    {(['ets2', 'ats'] as Game[]).map((g) => <button key={g} onClick={() => { setGame(g); setSel(null); }} className={cx('rounded-lg px-2.5 text-[11px] font-bold transition', game === g ? 'bg-amber-400 text-ink-950' : 'text-zinc-500 hover:text-white')}>{g.toUpperCase()}</button>)}
                  </div>
                </div>
              </div>
              <div className="max-h-[28vh] overflow-y-auto px-2 pb-2 sm:max-h-[calc(100dvh-340px)]">
                {list.map((d) => (
                  <button key={d.user_id} onClick={() => choose(d.user_id)} className={cx('flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition', sel === d.user_id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]')}>
                    <div className="relative">
                      <Avatar name={d.display_name} hue={d.avatar_hue} src={d.avatar_url} size={36} />
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0a0e18]" style={{ background: d.speed > 3 ? '#34d399' : '#fbbf24' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-white"><span className="truncate">{d.display_name}</span>{scope === 'all' && d.company_tag && <span className="font-mono text-[10px]" style={{ color: hsl(d.company_hue, 70) }}>{d.company_tag}</span>}</div>
                      <div className="truncate text-xs text-zinc-500">{d.destination ? `→ ${d.destination} · ${d.cargo}` : 'Freie Fahrt'}</div>
                    </div>
                    <div className="text-right"><div className="font-mono text-sm text-white">{Math.round(d.speed)}</div><div className="text-[9px] uppercase tracking-widest text-zinc-600">km/h</div></div>
                  </button>
                ))}
                {!list.length && (
                  <div className="px-4 py-8 text-center">
                    <Radio className="mx-auto h-6 w-6 text-zinc-600" />
                    <p className="mt-2 text-sm text-zinc-400">Gerade niemand {game.toUpperCase()} unterwegs</p>
                    <Link to="/app/client" className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300"><Download className="h-3.5 w-3.5" />Client einrichten</Link>
                  </div>
                )}
                {offline.length > 0 && (
                  <>
                    <div className="label px-3 pb-1 pt-3">Offline · {offline.length}</div>
                    {offline.map((m: any) => (
                      <Link key={m.id} to={`/driver/${m.username}`} className="flex items-center gap-3 rounded-2xl px-2.5 py-2 opacity-50 transition hover:bg-white/[0.03] hover:opacity-80">
                        <Avatar name={m.display_name} hue={m.avatar_hue} src={m.avatar_url} size={30} />
                        <div className="min-w-0 flex-1"><div className="truncate text-sm text-zinc-300">{m.display_name}</div><div className="text-[11px] text-zinc-600">{m.last_job ? `zuletzt ${ago(m.last_job)}` : 'noch keine Tour'}</div></div>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fahrerdetails */}
      <div className="absolute right-4 top-4 z-30 max-w-[calc(100%-2rem)]">
        <AnimatePresence>{selected && <DriverCard key={selected.user_id} d={selected} onClose={() => { setSel(null); setFollow(false); }} follow={!!follow} setFollow={setFollow} />}</AnimatePresence>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 hidden max-w-md -translate-x-1/2 sm:block"><EventFeed events={events} /></div>
    </div>
  );
}
