import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Route, Receipt, Trophy, PlayCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Field, Input, Logo } from '../components/ui';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen bg-ink-950 lg:grid-cols-[1fr_1.05fr]">
      <div className="relative flex flex-col px-6 py-8 sm:px-12">
        <Link to="/"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white">{title}</h1>
            <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </motion.div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden border-l border-white/[0.06] lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-ink-900 to-ink-950" />
        <div className="absolute inset-0 bg-grid opacity-60 mask-radial" />
        <div className="absolute -right-32 top-1/4 h-[420px] w-[420px] rounded-full bg-amber-500/25 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-center p-16">
          <div className="label text-amber-300/80">Frachtwerk</div>
          <h2 className="mt-4 max-w-md font-display text-5xl font-bold leading-[1.05] tracking-tight text-white">Jeder Kilometer zählt. <span className="text-gradient">Jetzt auch auf dem Lohnzettel.</span></h2>
          <div className="mt-12 space-y-4">
            {[[Route, 'Touren automatisch erfassen', 'Client starten, fahren, fertig.'], [Receipt, 'Faire Abrechnung', 'Deine Firma, deine Formel.'], [Trophy, 'Level & Erfolge', 'Jede Fahrt bringt dich weiter.']].map(([I, t, d]: any, i) => (
              <motion.div key={t} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className="flex max-w-sm items-center gap-4 rounded-2xl border border-white/10 bg-ink-950/40 p-4 backdrop-blur">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15"><I className="h-5 w-5 text-amber-400" /></div>
                <div><div className="text-sm font-medium text-white">{t}</div><div className="text-xs text-zinc-400">{d}</div></div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const { login, me } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ login: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const next = sp.get('next') || '/app';
  useEffect(() => { if (me) nav(next, { replace: true }); }, [me]);

  const go = async (body: any) => {
    setBusy(true); setErr('');
    try { const r = await api('/auth/login', { body }); await login(r.token); nav(next); }
    catch (e: any) { setErr(body.login === 'demo' && sp.get('demo') ? 'Die Demo ist auf diesem Server nicht eingerichtet.' : e.message); }
    finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); go(f); };

  return (
    <Shell title="Willkommen zurück" subtitle="Melde dich an und mach da weiter, wo du aufgehört hast.">
      {sp.get('demo') && (
        <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
          <div className="text-sm text-amber-100">Demo-Spedition „Nordlicht Logistik" mit echten Beispieldaten ansehen:</div>
          <Button className="mt-3 w-full" loading={busy} onClick={() => go({ login: 'demo', password: 'demo1234' })}><PlayCircle className="h-4 w-4" /> Als Demo-Inhaber einloggen</Button>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Benutzername oder E-Mail"><Input autoFocus value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} autoComplete="username" /></Field>
        <Field label="Passwort"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" /></Field>
        {err && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{err}</p>}
        <Button className="w-full" size="lg" loading={busy}>Anmelden <ArrowRight className="h-4 w-4" /></Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">Noch kein Konto? <Link to="/register" className="text-amber-400 hover:text-amber-300">Kostenlos registrieren</Link></p>
    </Shell>
  );
}

export function Register() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ username: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await api('/auth/register', { body: f }); await login(r.token); nav('/app/onboarding'); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const strength = Math.min(4, [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(f.password)).length);
  return (
    <Shell title="Konto erstellen" subtitle="Kostenlos, in 30 Sekunden. Danach Firma gründen oder beitreten.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Benutzername" hint="Wird in Ranglisten und deinem Profil angezeigt."><Input autoFocus value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="username" placeholder="z. B. MaxDrive" /></Field>
        <Field label="E-Mail"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></Field>
        <Field label="Passwort">
          <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
          <div className="mt-2 flex gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded-full transition ${i < strength ? ['bg-rose-500', 'bg-amber-500', 'bg-amber-400', 'bg-emerald-400'][strength - 1] : 'bg-white/10'}`} />)}</div>
        </Field>
        {err && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{err}</p>}
        <Button className="w-full" size="lg" loading={busy}>Konto erstellen <ArrowRight className="h-4 w-4" /></Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">Schon dabei? <Link to="/login" className="text-amber-400 hover:text-amber-300">Anmelden</Link></p>
    </Shell>
  );
}
