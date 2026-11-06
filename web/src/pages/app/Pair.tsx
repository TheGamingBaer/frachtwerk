import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MonitorSmartphone, CheckCircle2, Link2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Avatar, Button, Card, Input } from '../../components/ui';

/** Seite, die der Frachtwerk-Client öffnet: ein Klick verbindet den PC mit dem Konto */
export default function Pair() {
  const { me } = useAuth();
  const [sp] = useSearchParams();
  const [code, setCode] = useState((sp.get('code') || '').toUpperCase());
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState('');
  const confirm = async () => {
    setState('busy'); setErr('');
    try { await api('/client/pair/confirm', { body: { code } }); setState('done'); } catch (e: any) { setErr(e.message); setState('idle'); }
  };
  if (!me) return null;
  return (
    <div className="mx-auto max-w-lg py-6">
      <Card glow className="p-8 text-center">
        {state === 'done' ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/15"><CheckCircle2 className="h-8 w-8 text-emerald-400" /></div>
            <h1 className="mt-5 font-display text-2xl font-semibold text-white">Verbunden!</h1>
            <p className="mt-2 text-sm text-zinc-400">Die Frachtwerk-App auf deinem PC ist jetzt mit deinem Konto verknüpft. Starte ETS2 und fahr los – deine Touren werden automatisch erfasst.</p>
            <Button to="/app/map" className="mt-6">Zur Live-Map</Button>
          </motion.div>
        ) : (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/15"><MonitorSmartphone className="h-8 w-8 text-amber-400" /></div>
            <h1 className="mt-5 font-display text-2xl font-semibold text-white">Client verbinden</h1>
            <p className="mt-2 text-sm text-zinc-400">Prüfe, ob der Code mit dem im Client-Fenster übereinstimmt, und klicke auf „Verbinden“.</p>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} className="mt-6 h-16 text-center font-mono text-3xl tracking-[0.4em]" />
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-zinc-400"><Avatar name={me.user.display_name} hue={me.user.avatar_hue} src={me.user.avatar_url} size={24} />als <b className="text-white">{me.user.display_name}</b></div>
            {err && <p className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{err}</p>}
            <Button size="lg" className="mt-6 w-full" loading={state === 'busy'} disabled={code.length < 6} onClick={confirm}><Link2 className="h-4 w-4" /> Verbinden</Button>
          </>
        )}
      </Card>
    </div>
  );
}
