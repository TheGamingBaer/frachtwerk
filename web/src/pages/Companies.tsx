import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Users2, Route, Package, Building2 } from 'lucide-react';
import { PublicPage } from '../components/PublicLayout';
import { useApi } from '../lib/auth';
import { CompanyBadge, Input, Badge, Empty, Skeleton, Button } from '../components/ui';
import { compact } from '../lib/format';

export const JOIN_LABEL: Record<string, [string, any]> = { open: ['Offen', 'emerald'], apply: ['Bewerbung', 'amber'], invite: ['Nur Einladung', 'zinc'] };
export const GAME_LABEL: Record<string, string> = { ets2: 'ETS2', ats: 'ATS', both: 'ETS2 + ATS' };

export default function Companies() {
  const [q, setQ] = useState('');
  const { data, loading } = useApi<any[]>(`/companies?search=${encodeURIComponent(q)}`, [q]);
  return (
    <PublicPage>
      <div className="text-center">
        <div className="label text-amber-400/90">Firmenverzeichnis</div>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">Finde deine Spedition</h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-400">Schließ dich einer bestehenden Firma an – oder gründe deine eigene.</p>
        <div className="relative mx-auto mt-8 max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name oder Kürzel suchen…" className="h-12 rounded-2xl pl-11" />
        </div>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && !data && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        {data?.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Link to={`/c/${c.slug}`} className="group card relative block h-full overflow-hidden p-6 transition hover:-translate-y-1 hover:border-white/15">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-60 transition group-hover:opacity-100" style={{ background: `radial-gradient(ellipse at top, hsl(${c.hue} 90% 50% / .25), transparent 70%)` }} />
              <div className="relative flex items-start gap-4">
                <CompanyBadge tag={c.tag} hue={c.hue} size={52} />
                <div className="min-w-0">
                  <h3 className="truncate font-display text-lg font-semibold text-white">{c.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5"><Badge tone={JOIN_LABEL[c.join_mode][1]}>{JOIN_LABEL[c.join_mode][0]}</Badge><Badge>{GAME_LABEL[c.games]}</Badge></div>
                </div>
              </div>
              <p className="relative mt-4 line-clamp-2 min-h-[40px] text-sm text-zinc-400">{c.description || 'Keine Beschreibung.'}</p>
              <div className="relative mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4 text-center">
                {[[Users2, c.members, 'Fahrer'], [Route, compact(c.km), 'km'], [Package, compact(c.jobs), 'Touren']].map(([I, v, l]: any) => (
                  <div key={l}><div className="flex items-center justify-center gap-1.5 font-display font-semibold text-white"><I className="h-3.5 w-3.5 text-zinc-500" />{v}</div><div className="text-[10px] uppercase tracking-widest text-zinc-500">{l}</div></div>
                ))}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
      {data && !data.length && <Empty icon={Building2} title="Keine Firma gefunden" text="Vielleicht ist es Zeit, deine eigene zu gründen?" action={<Button to="/register">Firma gründen</Button>} />}
    </PublicPage>
  );
}
