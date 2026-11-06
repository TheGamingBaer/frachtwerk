import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, MailCheck, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Field, Input, Logo } from '../components/ui';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-ink-950 px-4">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[120px]" />
      <div className="absolute inset-0 bg-grid opacity-40 mask-radial" />
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center"><Logo /></Link>
        <div className="card p-8">{children}</div>
      </motion.div>
    </div>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<null | { mail: boolean }>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { setState(await api('/auth/forgot', { body: { email } })); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Frame>
      {state ? (
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15"><MailCheck className="h-6 w-6 text-emerald-400" /></div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-white">{state.mail ? 'Schau in dein Postfach' : 'Anfrage notiert'}</h1>
          <p className="mt-2 text-sm text-zinc-400">{state.mail
            ? 'Falls ein Konto mit dieser E-Mail existiert, ist ein Link zum Zurücksetzen unterwegs. Er ist 1 Stunde gültig.'
            : 'Auf diesem Server ist kein E-Mail-Versand eingerichtet. Bitte wende dich an deine Firmenleitung oder den Plattform-Admin – er kann dir im Admin-Bereich einen Reset-Link erstellen.'}</p>
          <Button to="/login" variant="outline" className="mt-6"><ArrowLeft className="h-4 w-4" /> Zurück zum Login</Button>
        </div>
      ) : (
        <>
          <h1 className="font-display text-2xl font-semibold text-white">Passwort vergessen?</h1>
          <p className="mt-1.5 text-sm text-zinc-400">Gib deine E-Mail ein – wir schicken dir einen Link für ein neues Passwort.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="E-Mail"><Input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            {err && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{err}</p>}
            <Button className="w-full" size="lg" loading={busy} disabled={!email}>Link anfordern</Button>
          </form>
          <p className="mt-6 text-center text-sm text-zinc-500"><Link to="/login" className="text-amber-400 hover:text-amber-300">Zurück zum Login</Link></p>
        </>
      )}
    </Frame>
  );
}

export function Reset() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return setErr('Die Passwörter stimmen nicht überein');
    setBusy(true); setErr('');
    try { const r = await api('/auth/reset', { body: { token: sp.get('token'), password: pw } }); nav(`/login?reset=1&user=${encodeURIComponent(r.username)}`); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Frame>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15"><KeyRound className="h-5 w-5 text-amber-400" /></div>
      <h1 className="mt-4 font-display text-2xl font-semibold text-white">Neues Passwort festlegen</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Neues Passwort" hint="Mindestens 8 Zeichen"><Input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Wiederholen"><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
        {err && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{err}</p>}
        <Button className="w-full" size="lg" loading={busy} disabled={pw.length < 8}>Passwort speichern</Button>
      </form>
    </Frame>
  );
}
