import { useParams, Link } from 'react-router-dom';
import { PublicPage } from '../components/PublicLayout';
import { useApi } from '../lib/auth';
import { Avatar, Card, CardHeader, CompanyBadge, Progress, Skeleton } from '../components/ui';
import { ago, compact, eur, km, num, date } from '../lib/format';
import { Achievements } from './app/Profile';
import { Route } from 'lucide-react';

export default function DriverPublic() {
  const { username } = useParams();
  const { data: d, error } = useApi(`/users/${username}`, [username]);
  if (error) return <PublicPage><p className="text-center text-zinc-400">{error}</p></PublicPage>;
  if (!d) return <PublicPage><Skeleton className="h-64" /></PublicPage>;
  const u = d.user;
  return (
    <PublicPage>
      <div className="card relative overflow-hidden p-8 sm:p-10">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full blur-[90px]" style={{ background: `hsl(${u.avatar_hue} 90% 50% / .3)` }} />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative">
            <Avatar name={u.display_name} hue={u.avatar_hue} src={u.avatar_url} size={104} />
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-2.5 py-0.5 font-mono text-xs font-bold whitespace-nowrap text-ink-950 shadow-glow">LV {d.level.level}</span>
          </div>
          <div className="flex-1">
            <h1 className="font-display text-4xl font-bold text-white">{u.display_name}</h1>
            <div className="mt-1 text-sm text-zinc-500">@{u.username} · dabei seit {date(u.created_at)}</div>
            {u.bio && <p className="mt-3 max-w-xl text-zinc-300">{u.bio}</p>}
            <div className="mt-4 max-w-sm"><Progress value={d.level.progress} /><div className="mt-1 text-xs text-zinc-500">{num(d.level.current)} / {num(d.level.next)} XP bis Level {d.level.level + 1}</div></div>
          </div>
          {d.member && (
            <Link to={`/c/${d.member.company_slug}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06]">
              <CompanyBadge tag={d.member.company_tag} hue={d.member.company_hue} size={44} />
              <div><div className="text-sm font-semibold text-white">{d.member.company_name}</div><div className="text-xs text-zinc-500">{d.member.rank_title}</div></div>
            </Link>
          )}
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-6 sm:grid-cols-4">
          {[['Kilometer', compact(d.stats.km)], ['Lieferungen', num(d.stats.jobs)], ['Frachterlös', eur(d.stats.income)], ['Ø Schaden', `${num(d.stats.avg_damage, 1)} %`]].map(([l, v]) => (
            <div key={l}><div className="font-display text-2xl font-semibold text-white">{v}</div><div className="label mt-1">{l}</div></div>
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Erfolge" subtitle={`${d.achievements.filter((a: any) => a.unlocked).length} / ${d.achievements.length} freigeschaltet`} /><div className="px-5 pb-5"><Achievements list={d.achievements} /></div></Card>
        <Card>
          <CardHeader title="Letzte Touren" icon={Route} />
          <div className="px-3 pb-4">{d.recent.map((j: any) => (
            <div key={j.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm">
              <div className="min-w-0"><div className="truncate text-zinc-200">{j.origin_city} → {j.dest_city}</div><div className="text-xs text-zinc-500">{j.cargo} · {num(j.cargo_mass, 1)} t</div></div>
              <div className="text-right"><div className="font-mono text-xs text-zinc-300">{km(j.driven_km)}</div><div className="text-[11px] text-zinc-600">{ago(j.finished_at)}</div></div>
            </div>
          ))}</div>
        </Card>
      </div>
    </PublicPage>
  );
}
