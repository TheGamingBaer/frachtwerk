import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LiveMap, LiveMapHandle } from '../components/LiveMap';
import { useLiveDrivers } from '../lib/live';
import { Avatar, Button, Logo, cx } from '../components/ui';
import { StatusPill, EventFeed } from './app/Live';
import { Game } from '../lib/gamegeo';
import { useAuth } from '../lib/auth';

export default function PublicMap() {
  const { me } = useAuth();
  const { drivers, store, version, status, events } = useLiveDrivers({ publicMode: true });
  const [game, setGame] = useState<Game>('ets2');
  const [sel, setSel] = useState<number | null>(null);
  const [follow, setFollow] = useState(false);
  const map = useRef<LiveMapHandle>(null);
  useEffect(() => { if (drivers.length && !drivers.some((d) => d.game === game)) setGame(drivers[0].game); }, [version]);
  const list = useMemo(() => drivers.filter((d) => d.game === game), [version, game]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-ink-950">
      <LiveMap ref={map} game={game} store={store} version={version} selectedId={sel} onSelect={(id) => { setSel(id); setFollow(!!id); if (id) map.current?.flyTo(id); }} follow={follow} onFollowChange={setFollow} compact={false} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0a0e18]/80 px-4 py-2.5 backdrop-blur-xl">
          <Link to="/"><Logo /></Link>
          <span className="hidden h-6 w-px bg-white/10 sm:block" />
          <span className="hidden font-display text-sm font-semibold text-white sm:block">Live-Map</span>
          <StatusPill status={status} count={list.length} />
          <div className="flex rounded-lg bg-white/[0.05] p-0.5">
            {(['ets2', 'ats'] as Game[]).map((g) => <button key={g} onClick={() => { setGame(g); setSel(null); }} className={cx('rounded-md px-2 py-0.5 text-[11px] font-bold', game === g ? 'bg-amber-400 text-ink-950' : 'text-zinc-500')}>{g.toUpperCase()}</button>)}
          </div>
        </div>
        <div className="pointer-events-auto">
          <Button to={me ? '/app/map' : '/register'} size="sm">{me ? 'Zur Speditionsansicht' : 'Mitfahren'} <ArrowRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {list.length > 0 && (
        <div className="absolute bottom-4 left-4 z-20 hidden max-h-[45vh] w-64 overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0e18]/80 p-2 backdrop-blur-xl md:block">
          {list.map((d) => (
            <button key={d.user_id} onClick={() => { setSel(d.user_id); setFollow(true); map.current?.flyTo(d.user_id); }} className={cx('flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left', sel === d.user_id ? 'bg-white/10' : 'hover:bg-white/5')}>
              <Avatar name={d.display_name} hue={d.avatar_hue} src={d.avatar_url} size={28} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm text-white">{d.display_name}</div><div className="truncate text-[11px] text-zinc-500">{d.destination ? `→ ${d.destination}` : 'Freie Fahrt'}</div></div>
              {d.company_tag && <span className="font-mono text-[10px]" style={{ color: `hsl(${d.company_hue} 90% 70%)` }}>{d.company_tag}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 max-w-md -translate-x-1/2"><EventFeed events={events} /></div>
    </div>
  );
}
