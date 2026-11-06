import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Route, Radio, Trophy, Building2, Wallet, Receipt, Truck, CalendarDays, Settings, LogOut, Menu, X, UserRound, Download, Users2, Megaphone, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Logo, Avatar, Progress, cx, CompanyBadge, PageLoader } from './ui';
import { api } from '../lib/api';
import { CommandPalette } from './CommandPalette';
import { can, ROLE_LABEL, num } from '../lib/format';

export function AppShell() {
  const { me, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
  const m = me?.member;
  const role = m?.role;
  const fullBleed = loc.pathname === '/app/map';
  const [liveCount, setLiveCount] = useState(0);
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    let stop = false;
    const tick = () => api<any[]>(`/live?scope=${m ? 'company' : 'all'}`).then((r) => !stop && setLiveCount(r.length)).catch(() => {});
    tick(); const t = setInterval(tick, 20000);
    return () => { stop = true; clearInterval(t); };
  }, [m?.company_id]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  const groups = [
    { title: 'Fahrer', items: [
      { to: '/app', icon: LayoutDashboard, label: 'Cockpit', end: true },
      { to: '/app/jobs', icon: Route, label: 'Touren' },
      { to: '/app/map', icon: Radio, label: 'Live-Map', badge: liveCount },
      { to: '/app/leaderboard', icon: Trophy, label: 'Rangliste' },
    ] },
    m ? { title: m.company_name, items: [
      { to: '/app/company', icon: Building2, label: 'Firma', end: true },
      { to: '/app/company/members', icon: Users2, label: 'Team' },
      { to: '/app/company/events', icon: CalendarDays, label: 'Konvois & Events' },
      { to: '/app/company/news', icon: Megaphone, label: 'News' },
      { to: '/app/company/fleet', icon: Truck, label: 'Fuhrpark' },
      ...(can(role, 'dispatcher') ? [
        { to: '/app/company/payroll', icon: Receipt, label: 'Abrechnung' },
        { to: '/app/company/finance', icon: Wallet, label: 'Finanzen' },
      ] : []),
      ...(can(role, 'admin') ? [{ to: '/app/company/settings', icon: Settings, label: 'Einstellungen' }] : []),
    ] } : { title: 'Firma', items: [{ to: '/app/onboarding', icon: Building2, label: 'Firma finden / gründen' }] },
    { title: 'Konto', items: [
      { to: '/app/profile', icon: UserRound, label: 'Profil & Lohnzettel' },
      { to: '/app/client', icon: Download, label: 'App herunterladen' },
      ...(me?.user.is_admin ? [{ to: '/app/admin', icon: ShieldCheck, label: 'Plattform-Admin' }] : []),
    ] },
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5"><Link to="/"><Logo /></Link></div>
      {m && (
        <Link to="/app/company" className="mx-3 mb-3 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 hover:bg-white/[0.05] transition">
          <CompanyBadge tag={m.company_tag} hue={m.company_hue} size={38} />
          <div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{m.company_name}</div><div className="text-xs text-zinc-500">{m.rank_title} · {ROLE_LABEL[m.role]}</div></div>
        </Link>
      )}
      <div className="px-3 pb-1">
        <button onClick={() => setPalette(true)} className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-sm text-zinc-500 transition hover:border-white/15 hover:text-zinc-300">
          <Search className="h-4 w-4" /><span className="flex-1 text-left">Suchen…</span><kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] text-zinc-400">⌘K</kbd>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <div key={g.title} className="mt-4 first:mt-1">
            <div className="label px-3 pb-2 truncate">{g.title}</div>
            {g.items.map((it: any) => (
              <NavLink key={it.to} to={it.to} end={it.end}
                className={({ isActive }) => cx('group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors', isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03]')}>
                {({ isActive }) => (<>
                  {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/15 to-transparent ring-1 ring-amber-500/20" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                  {isActive && <motion.span layoutId="nav-bar" className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-amber-400" />}
                  <it.icon className={cx('relative h-[18px] w-[18px]', isActive ? 'text-amber-400' : 'text-zinc-500 group-hover:text-zinc-300')} />
                  <span className="relative flex-1">{it.label}</span>
                  {!!it.badge && <span className="relative flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{it.badge}</span>}
                </>)}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      {me && (
        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-2xl p-2">
            <Link to={`/driver/${me.user.username}`}><Avatar name={me.user.display_name} hue={me.user.avatar_hue} src={me.user.avatar_url} size={38} /></Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-sm"><span className="truncate font-medium text-white">{me.user.display_name}</span><span className="font-mono text-[11px] text-amber-400">LV {me.level.level}</span></div>
              <Progress value={me.level.progress} className="mt-1.5" />
              <div className="mt-1 text-[10px] text-zinc-500 tnum">{num(me.level.current)} / {num(me.level.next)} XP</div>
            </div>
            <button title="Abmelden" onClick={() => { logout(); nav('/'); }} className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Hintergrund-Atmosphäre */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 h-[480px] w-[680px] rounded-full bg-amber-500/[0.07] blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-cyan-500/[0.04] blur-[120px]" />
        <div className="absolute inset-0 bg-grid mask-radial opacity-40" />
      </div>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-white/[0.06] bg-ink-950/70 backdrop-blur-xl lg:block">{sidebar}</aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-white/10 bg-ink-900 lg:hidden" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', stiffness: 400, damping: 40 }}>
              <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 text-zinc-400"><X className="h-5 w-5" /></button>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="relative lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.04] bg-ink-950/60 px-4 backdrop-blur-xl lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-zinc-300 hover:bg-white/5"><Menu className="h-5 w-5" /></button>
          <Logo />
          <button onClick={() => setPalette(true)} className="ml-auto rounded-lg p-2 text-zinc-300 hover:bg-white/5"><Search className="h-5 w-5" /></button>
        </header>
        <main className={fullBleed ? '' : 'mx-auto max-w-[1320px] px-4 py-8 sm:px-8 lg:py-10'}>
          <motion.div key={loc.pathname} initial={{ opacity: 0, y: fullBleed ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            <Suspense fallback={<PageLoader />}><Outlet /></Suspense>
          </motion.div>
        </main>
        <CommandPalette open={palette} onClose={() => setPalette(false)} />
      </div>
    </div>
  );
}
