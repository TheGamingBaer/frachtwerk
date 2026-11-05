import { ReactNode, useEffect, useRef, useState, createContext, useContext, useCallback, useId } from 'react';
import { motion, AnimatePresence, useInView, animate } from 'framer-motion';
import clsx from 'clsx';
import { X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';

export const cx = clsx;

// ---------- Logo ----------
export function Logo({ className = '', small = false }: { className?: string; small?: boolean }) {
  const gid = 'lg' + useId().replace(/:/g, '');
  return (
    <span className={cx('inline-flex items-center gap-2.5 font-display font-bold tracking-tight text-white', className)}>
      <span className={cx('relative grid place-items-center rounded-xl bg-ink-800 ring-1 ring-white/10', small ? 'h-8 w-8' : 'h-9 w-9')}>
        <svg viewBox="0 0 64 64" className="h-[70%] w-[70%]"><defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd08a" /><stop offset="1" stopColor="#f06d00" /></linearGradient></defs>
          <path d="M8 54 L26 10 H58 L53 22 H35 L31 31 H48 L43 43 H26 L21 54 Z" fill={`url(#${gid})`} /></svg>
        <span className="absolute inset-0 rounded-xl bg-amber-500/20 blur-md -z-10" />
      </span>
      {!small && <span className="text-lg">Fracht<span className="text-amber-400">werk</span></span>}
    </span>
  );
}

// ---------- Button ----------
type BtnProps = { children: ReactNode; variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle'; size?: 'sm' | 'md' | 'lg'; className?: string; loading?: boolean; to?: string; href?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>;
export function Button({ children, variant = 'primary', size = 'md', className, loading, to, href, ...rest }: BtnProps) {
  const cls = cx(
    'relative inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 select-none whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none active:scale-[.98]',
    size === 'sm' && 'h-8 px-3 text-xs', size === 'md' && 'h-10 px-4 text-sm', size === 'lg' && 'h-12 px-6 text-[15px]',
    variant === 'primary' && 'text-ink-950 bg-gradient-to-b from-amber-300 to-amber-500 hover:brightness-110 shadow-glow font-semibold',
    variant === 'ghost' && 'text-zinc-300 hover:text-white hover:bg-white/5',
    variant === 'outline' && 'text-zinc-200 border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20',
    variant === 'subtle' && 'text-zinc-200 bg-white/[0.06] hover:bg-white/10',
    variant === 'danger' && 'text-rose-200 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20',
    className,
  );
  const inner = <>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}</>;
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (href) return <a href={href} className={cls} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{inner}</a>;
  return <button className={cls} disabled={loading || rest.disabled} {...rest}>{inner}</button>;
}

// ---------- Card ----------
export function Card({ children, className, glow, ...rest }: { children: ReactNode; className?: string; glow?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('card relative overflow-hidden', className)} {...rest}>
      {glow && <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />}
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: any }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] ring-1 ring-white/10"><Icon className="h-4 w-4 text-amber-400" /></div>}
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-white truncate">{title}</h3>
          {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ---------- Animated counter ----------
export function Counter({ value, format = (n: number) => Math.round(n).toLocaleString('de-DE'), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const prev = useRef(0);
  useEffect(() => {
    if (!inView || !ref.current) return;
    const c = animate(prev.current, value || 0, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { if (ref.current) ref.current.textContent = format(v); } });
    prev.current = value || 0;
    return () => c.stop();
  }, [value, inView]);
  return <span ref={ref} className={cx('tnum', className)}>{format(0)}</span>;
}

// ---------- Stat ----------
export function Stat({ label, value, format, icon: Icon, delta, hint, accent = 'amber' }: { label: string; value: number; format?: (n: number) => string; icon?: any; delta?: number | null; hint?: string; accent?: 'amber' | 'cyan' | 'emerald' | 'violet' }) {
  const ring = { amber: 'from-amber-400/20 text-amber-300', cyan: 'from-cyan-400/20 text-cyan-300', emerald: 'from-emerald-400/20 text-emerald-300', violet: 'from-violet-400/20 text-violet-300' }[accent];
  return (
    <Card className="p-5 group hover:border-white/15 transition-colors">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        {Icon && <div className={cx('grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br to-transparent', ring)}><Icon className="h-4 w-4" /></div>}
      </div>
      <div className="mt-3 font-display text-[28px] leading-none font-semibold text-white"><Counter value={value} format={format} /></div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta !== undefined && delta !== null && Number.isFinite(delta) && (
          <span className={cx('rounded-md px-1.5 py-0.5 font-medium', delta >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300')}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {hint && <span className="text-zinc-500">{hint}</span>}
      </div>
    </Card>
  );
}

// ---------- Avatar ----------
export function Avatar({ name = '?', hue = 28, size = 36, ring = false, src }: { name?: string; hue?: number; size?: number; ring?: boolean; src?: string | null }) {
  const [broken, setBroken] = useState(false);
  const initials = name.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={cx('relative grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-semibold text-white', ring && 'ring-2 ring-ink-950')}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 85% 58%), hsl(${(hue + 40) % 360} 80% 38%))` }}>
      {src && !broken ? <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" /> : initials}
    </div>
  );
}

export function CompanyBadge({ tag, hue = 28, size = 44 }: { tag: string; hue?: number; size?: number }) {
  return (
    <div className="relative grid shrink-0 place-items-center rounded-2xl font-display font-bold text-white overflow-hidden"
      style={{ width: size, height: size, fontSize: size * (tag.length > 3 ? 0.24 : 0.3), background: `linear-gradient(140deg, hsl(${hue} 90% 55%), hsl(${(hue + 30) % 360} 85% 30%))`, boxShadow: `0 8px 30px -8px hsl(${hue} 90% 50% / .6)` }}>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.35),transparent_55%)]" />
      <span className="relative tracking-wide">{tag}</span>
    </div>
  );
}

// ---------- Badge ----------
export function Badge({ children, tone = 'zinc', className }: { children: ReactNode; tone?: 'zinc' | 'amber' | 'emerald' | 'rose' | 'cyan' | 'violet'; className?: string }) {
  const t = {
    zinc: 'bg-white/5 text-zinc-300 ring-white/10', amber: 'bg-amber-500/10 text-amber-300 ring-amber-500/20', emerald: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-300 ring-rose-500/20', cyan: 'bg-cyan-500/10 text-cyan-300 ring-cyan-500/20', violet: 'bg-violet-500/10 text-violet-300 ring-violet-500/20',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', t, className)}>{children}</span>;
}

export function ReviewBadge({ review, status }: { review: string; status: string }) {
  if (status === 'active') return <Badge tone="cyan"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />Unterwegs</Badge>;
  if (status === 'cancelled') return <Badge tone="rose">Abgebrochen</Badge>;
  if (review === 'approved') return <Badge tone="emerald">Freigegeben</Badge>;
  if (review === 'rejected') return <Badge tone="rose">Abgelehnt</Badge>;
  return <Badge tone="amber">In Prüfung</Badge>;
}

// ---------- Form ----------
export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx('input', p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx('input min-h-[96px] resize-y', p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx('input appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%2371717a%27 stroke-width=%272%27%3E%3Cpath d=%27M2 4l4 4 4-4%27/%3E%3C/svg%3E")] bg-no-repeat bg-[right_12px_center] pr-9', p.className)} />;

export function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left hover:bg-white/[0.04] transition">
      <span><span className="block text-sm text-zinc-200">{label}</span>{desc && <span className="block text-xs text-zinc-500 mt-0.5">{desc}</span>}</span>
      <span className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-amber-500' : 'bg-white/10')}>
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 35 }} className={cx('absolute top-1 h-4 w-4 rounded-full bg-white shadow', checked ? 'right-1' : 'left-1')} />
      </span>
    </button>
  );
}

// ---------- Tabs ----------
export function Tabs({ tabs, value, onChange, id = 'tabs' }: { tabs: { id: string; label: ReactNode; count?: number }[]; value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl bg-white/[0.03] p-1 ring-1 ring-white/[0.07]">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={cx('relative whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm transition-colors', value === t.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300')}>
          {value === t.id && <motion.span layoutId={id} className="absolute inset-0 rounded-lg bg-white/[0.08] ring-1 ring-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          <span className="relative flex items-center gap-1.5">{t.label}{!!t.count && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-ink-950">{t.count}</span>}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: 30, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className={cx('relative w-full max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-ink-900 shadow-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-ink-900/90 backdrop-blur px-6 py-4">
              <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---------- Leere Zustände / Laden ----------
export function Empty({ icon: Icon, title, text, action }: { icon: any; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="relative mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10"><Icon className="h-6 w-6 text-zinc-400" /></div>
      <h4 className="font-display font-semibold text-white">{title}</h4>
      {text && <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cx('rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,.03),rgba(255,255,255,.07),rgba(255,255,255,.03))] bg-[length:200%_100%] animate-shimmer', className)} />
);
export function PageLoader() {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={i < 4 ? 'h-32' : 'h-64 sm:col-span-2'} />)}</div>;
}

// ---------- Seitenkopf ----------
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="label mb-2 text-amber-400/80">{eyebrow}</div>}
        <h1 className="font-display text-3xl sm:text-[34px] font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Toasts ----------
type Toast = { id: number; msg: string; tone: 'ok' | 'err' };
const ToastCtx = createContext<(msg: string, tone?: 'ok' | 'err') => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((msg: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, msg, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        <AnimatePresence>
          {list.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}
              className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-800/95 px-4 py-3 text-sm text-zinc-100 shadow-2xl backdrop-blur">
              {t.tone === 'ok' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertTriangle className="h-5 w-5 text-rose-400" />}
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- Fortschrittsbalken ----------
export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]', className)}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300" />
    </div>
  );
}

export const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } };
