import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, LayoutDashboard, Route, Radio, Trophy, Building2, Users2, CalendarDays, Megaphone, Truck, Receipt, Wallet, Settings, UserRound, Download, CornerDownLeft, Globe2, Plus } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { can } from '../lib/format';
import { Avatar, CompanyBadge, cx } from './ui';

type Item = { id: string; group: string; label: string; hint?: string; icon?: any; node?: React.ReactNode; to: string };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [people, setPeople] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ(''); setIdx(0);
    setTimeout(() => input.current?.focus(), 30);
    api<any[]>('/companies?search=').then(setCompanies).catch(() => {});
    if (me?.member) api('/company').then((c) => setPeople(c.members)).catch(() => {});
  }, [open]);

  const role = me?.member?.role;
  const pages: Item[] = [
    { id: 'p-dash', group: 'Seiten', label: 'Cockpit', icon: LayoutDashboard, to: '/app' },
    { id: 'p-jobs', group: 'Seiten', label: 'Touren', hint: 'Fahrtenbuch', icon: Route, to: '/app/jobs' },
    { id: 'p-map', group: 'Seiten', label: 'Live-Map', hint: 'Wer fährt gerade?', icon: Radio, to: '/app/map' },
    { id: 'p-lb', group: 'Seiten', label: 'Rangliste', icon: Trophy, to: '/app/leaderboard' },
    ...(me?.member ? [
      { id: 'p-co', group: 'Seiten', label: 'Firma', icon: Building2, to: '/app/company' },
      { id: 'p-team', group: 'Seiten', label: 'Team', hint: 'Mitglieder & Bewerbungen', icon: Users2, to: '/app/company/members' },
      { id: 'p-ev', group: 'Seiten', label: 'Konvois & Events', icon: CalendarDays, to: '/app/company/events' },
      { id: 'p-news', group: 'Seiten', label: 'News', icon: Megaphone, to: '/app/company/news' },
      { id: 'p-fleet', group: 'Seiten', label: 'Fuhrpark', icon: Truck, to: '/app/company/fleet' },
      ...(can(role, 'dispatcher') ? [{ id: 'p-pay', group: 'Seiten', label: 'Abrechnung', hint: 'Lohnlauf', icon: Receipt, to: '/app/company/payroll' }, { id: 'p-fin', group: 'Seiten', label: 'Finanzen', icon: Wallet, to: '/app/company/finance' }] : []),
      ...(can(role, 'admin') ? [{ id: 'p-set', group: 'Seiten', label: 'Firmeneinstellungen', hint: 'Lohnformel', icon: Settings, to: '/app/company/settings' }] : []),
    ] : [{ id: 'p-ob', group: 'Seiten', label: 'Firma gründen oder beitreten', icon: Plus, to: '/app/onboarding' }]),
    { id: 'p-prof', group: 'Seiten', label: 'Profil & Lohnzettel', icon: UserRound, to: '/app/profile' },
    { id: 'p-cli', group: 'Seiten', label: 'Client & Token', icon: Download, to: '/app/client' },
    { id: 'p-dir', group: 'Seiten', label: 'Firmenverzeichnis', icon: Globe2, to: '/companies' },
  ];

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const match = (t: string) => !s || t.toLowerCase().includes(s);
    const out: Item[] = pages.filter((p) => match(`${p.label} ${p.hint || ''}`));
    if (s) {
      people.filter((p) => match(`${p.display_name} ${p.username}`)).slice(0, 5).forEach((p) =>
        out.push({ id: `u-${p.id}`, group: 'Team', label: p.display_name, hint: p.rank_title, node: <Avatar name={p.display_name} hue={p.avatar_hue} src={p.avatar_url} size={24} />, to: `/driver/${p.username}` }));
      companies.filter((c) => match(`${c.name} ${c.tag}`)).slice(0, 5).forEach((c) =>
        out.push({ id: `c-${c.id}`, group: 'Speditionen', label: c.name, hint: `${c.members} Fahrer`, node: <CompanyBadge tag={c.tag} hue={c.hue} size={24} />, to: `/c/${c.slug}` }));
    }
    return out;
  }, [q, people, companies, me]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => { listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest' }); }, [idx]);

  const go = (it?: Item) => { if (!it) return; onClose(); nav(it.to); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(items[idx]); }
    else if (e.key === 'Escape') onClose();
  };

  let lastGroup = '';
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: -12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -8, scale: 0.98 }} transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 shadow-[0_40px_120px_-20px_rgba(0,0,0,.9)] backdrop-blur-2xl">
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
              <Search className="h-5 w-5 text-zinc-500" />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Seite, Fahrer oder Spedition suchen…" className="h-14 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-zinc-600" />
              <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">ESC</kbd>
            </div>
            <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
              {items.map((it, i) => {
                const header = it.group !== lastGroup ? (lastGroup = it.group) : null;
                return (
                  <div key={it.id}>
                    {header && <div className="label px-3 pb-1.5 pt-3">{header}</div>}
                    <button data-i={i} onMouseEnter={() => setIdx(i)} onClick={() => go(it)}
                      className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition', idx === i ? 'bg-amber-500/10 text-white' : 'text-zinc-300')}>
                      {it.node || (it.icon && <it.icon className={cx('h-4 w-4', idx === i ? 'text-amber-400' : 'text-zinc-500')} />)}
                      <span className="flex-1">{it.label}</span>
                      {it.hint && <span className="text-xs text-zinc-500">{it.hint}</span>}
                      {idx === i && <CornerDownLeft className="h-3.5 w-3.5 text-zinc-500" />}
                    </button>
                  </div>
                );
              })}
              {!items.length && <div className="px-4 py-10 text-center text-sm text-zinc-500">Nichts gefunden für „{q}“</div>}
            </div>
            <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-zinc-500">
              <span><kbd className="font-mono">↑↓</kbd> navigieren</span><span><kbd className="font-mono">↵</kbd> öffnen</span><span className="ml-auto">Frachtwerk</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
