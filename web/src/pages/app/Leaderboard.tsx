import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Crown } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { Avatar, Card, CompanyBadge, Empty, PageHeader, Tabs, Skeleton, cx, Badge } from '../../components/ui';
import { eur, num } from '../../lib/format';

const METRIC: Record<string, [string, (n: number) => string]> = {
  km: ['Kilometer', (n) => `${num(n)} km`], income: ['Frachterlös', (n) => eur(n)], jobs: ['Lieferungen', (n) => num(n)], tonnage: ['Tonnage', (n) => `${num(n)} t`],
};

export default function Leaderboard() {
  const { me } = useAuth();
  const [type, setType] = useState('drivers');
  const [period, setPeriod] = useState('month');
  const [metric, setMetric] = useState('km');
  const [scope, setScope] = useState('global');
  const company = scope === 'company' && me?.member ? `&company=${me.member.company_id}` : '';
  const { data, loading } = useApi<any[]>(`/leaderboard?type=${type}&period=${period}&metric=${metric}${company}`, [type, period, metric, scope]);
  const fmt = METRIC[metric][1];
  const top = data?.slice(0, 3) || [];
  const order = [1, 0, 2];

  return (
    <div>
      <PageHeader eyebrow="Wettbewerb" title="Rangliste" subtitle="Wer fährt am meisten, am weitesten, am saubersten?" />
      <div className="mb-8 flex flex-wrap gap-2">
        <Tabs id="lt" value={type} onChange={setType} tabs={[{ id: 'drivers', label: 'Fahrer' }, { id: 'companies', label: 'Firmen' }]} />
        {type === 'drivers' && me?.member && <Tabs id="ls" value={scope} onChange={setScope} tabs={[{ id: 'global', label: 'Global' }, { id: 'company', label: 'Meine Firma' }]} />}
        <Tabs id="lp" value={period} onChange={setPeriod} tabs={[{ id: 'week', label: '7 Tage' }, { id: 'month', label: 'Monat' }, { id: 'all', label: 'Ewig' }]} />
        <Tabs id="lm" value={metric} onChange={setMetric} tabs={Object.entries(METRIC).map(([id, [label]]) => ({ id, label }))} />
      </div>

      {loading && !data && <Skeleton className="h-80" />}
      {data && !data.length && <Card><Empty icon={Trophy} title="Noch keine Einträge" text="In diesem Zeitraum wurde noch nichts geliefert." /></Card>}

      {top.length > 0 && (
        <div className="mb-8 grid grid-cols-3 items-end gap-3 sm:gap-6">
          {order.map((idx) => {
            const r = top[idx]; if (!r) return <div key={idx} />;
            const h = ['h-40 sm:h-48', 'h-32 sm:h-36', 'h-24 sm:h-28'][idx];
            const medal = ['from-amber-300 to-amber-600', 'from-zinc-200 to-zinc-500', 'from-orange-400 to-orange-800'][idx];
            const name = type === 'companies' ? r.name : r.display_name;
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + (2 - idx) * 0.1, type: 'spring', stiffness: 120 }} className="flex flex-col items-center">
                <div className="relative mb-3">
                  {idx === 0 && <Crown className="absolute -top-6 left-1/2 h-6 w-6 -translate-x-1/2 text-amber-400 drop-shadow-[0_0_10px_rgba(255,179,71,.8)]" />}
                  {type === 'companies' ? <CompanyBadge tag={r.tag} hue={r.hue} size={idx === 0 ? 72 : 56} /> : <Avatar name={name} hue={r.avatar_hue} src={r.avatar_url} size={idx === 0 ? 72 : 56} />}
                </div>
                <Link to={type === 'companies' ? `/c/${r.slug}` : `/driver/${r.username}`} className="max-w-full truncate text-center text-sm font-semibold text-white hover:text-amber-300">{name}</Link>
                <div className="mb-3 font-mono text-xs text-zinc-400">{fmt(r.value)}</div>
                <div className={cx('relative w-full overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-gradient-to-b', h, idx === 0 ? 'from-amber-500/25 to-amber-500/0' : 'from-white/[0.07] to-transparent')}>
                  <div className={cx('absolute left-1/2 top-4 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full bg-gradient-to-b font-display font-bold text-ink-950', medal)}>{idx + 1}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {data && data.length > 3 && (
        <Card>
          {data.slice(3).map((r, i) => {
            const mine = type === 'drivers' && r.id === me?.user.id;
            return (
              <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className={cx('flex items-center gap-4 border-b border-white/[0.04] px-5 py-3 last:border-0', mine && 'bg-amber-500/[0.06]')}>
                <span className="w-6 text-right font-mono text-sm text-zinc-500">{i + 4}</span>
                {type === 'companies' ? <CompanyBadge tag={r.tag} hue={r.hue} size={34} /> : <Avatar name={r.display_name} hue={r.avatar_hue} src={r.avatar_url} size={34} />}
                <div className="min-w-0 flex-1">
                  <Link to={type === 'companies' ? `/c/${r.slug}` : `/driver/${r.username}`} className="truncate text-sm font-medium text-white hover:text-amber-300">{type === 'companies' ? r.name : r.display_name}</Link>
                  <div className="text-xs text-zinc-500">{r.jobs} Lieferungen{r.company_tag ? ` · ${r.company_tag}` : ''}</div>
                </div>
                {mine && <Badge tone="amber">Du</Badge>}
                <span className="font-mono text-sm font-semibold text-white">{fmt(r.value)}</span>
              </motion.div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
