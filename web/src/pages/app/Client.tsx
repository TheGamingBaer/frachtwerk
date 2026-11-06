import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Eye, EyeOff, RefreshCw, Download, MousePointerClick, Link2, Gamepad2, ShieldCheck, ChevronDown, Terminal, Monitor, Bell, Zap } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Badge, Button, Card, CardHeader, PageHeader, useToast, cx } from '../../components/ui';

export default function ClientPage() {
  const { me, refresh } = useAuth();
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const { data: dl } = useApi<{ app: { available: boolean; version?: string; size?: number } }>('/downloads');
  if (!me) return null;
  const token = me.user.api_token;
  const server = window.location.origin;
  const copy = (t: string) => { navigator.clipboard?.writeText(t); toast('Kopiert'); };
  const regen = async () => { if (!confirm('Neuen Token erzeugen? Verbundene Geräte müssen sich danach neu verbinden.')) return; await api('/me/token', { body: {} }); await refresh(); toast('Neuer Token erstellt'); };
  const app = dl?.app;

  const steps = [
    { icon: Download, title: 'Herunterladen', text: 'Frachtwerk.exe – die Adresse deiner Spedition ist schon eingebaut.' },
    { icon: MousePointerClick, title: 'Doppelklicken', text: 'Installiert sich selbst: Startmenü, Desktop, Symbol neben der Uhr.' },
    { icon: Link2, title: '„Verbinden“ klicken', text: 'Im Fenster, das sich öffnet. Kein Token, kein Abtippen.' },
    { icon: Gamepad2, title: 'Losfahren', text: 'Die App richtet die Spieldaten ein – einmal „Install“ klicken, fertig.' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Für dein Spiel" title="Frachtwerk-App" subtitle="Einmal installieren – danach landet jede Tour automatisch im Fahrtenbuch." />

      <Card glow className="overflow-hidden">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="amber"><Monitor className="h-3 w-3" />Windows 10 & 11</Badge>
              {app?.version && <Badge>Version {app.version}</Badge>}
              <Badge tone="emerald"><Zap className="h-3 w-3" />Aktualisiert sich selbst</Badge>
            </div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-white sm:text-3xl">Ein Klick. Dann fährst du.</h2>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">Die App läuft unauffällig neben der Uhr, startet auf Wunsch mit Windows und meldet sich, wenn eine Tour startet oder abgeliefert ist. Du kannst sie an die Taskleiste anheften – ein Klick öffnet Frachtwerk wie ein eigenes Programm.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {app?.available
                ? <Button size="lg" href="/download/Frachtwerk.exe"><Download className="h-5 w-5" /> Frachtwerk für Windows herunterladen</Button>
                : <Button size="lg" disabled><Download className="h-5 w-5" /> Noch nicht verfügbar</Button>}
              {app?.size ? <span className="text-xs text-zinc-500">{Math.round(app.size / 1048576)} MB · kostenlos</span> : null}
            </div>
            {!app?.available && <p className="mt-3 text-xs text-zinc-500">Admins: Lege <code className="rounded bg-white/5 px-1">Frachtwerk.exe</code> in den Ordner <code className="rounded bg-white/5 px-1">downloads</code> des Servers (bzw. neben Frachtwerk-Server.exe). Bis dahin: siehe „Erweitert“ unten.</p>}
          </div>
          <div className="relative mx-auto hidden h-44 w-44 lg:block">
            <div className="absolute inset-0 rounded-[40px] bg-amber-500/20 blur-2xl" />
            <img src="/icon-512.png" alt="" className="relative h-full w-full rounded-[40px] shadow-2xl" />
          </div>
        </div>
        <div className="grid border-t border-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}
              className={cx('flex gap-3 p-5', i && 'border-t border-white/[0.06] sm:border-t-0 sm:[&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0', i % 2 === 1 && 'sm:border-l lg:border-l', i === 2 && 'lg:border-l', i === 3 && 'lg:border-l')}>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15"><s.icon className="h-4 w-4 text-amber-400" /></div>
              <div><div className="font-mono text-[10px] text-amber-400/80">SCHRITT {i + 1}</div><div className="text-sm font-semibold text-white">{s.title}</div><div className="mt-0.5 text-xs text-zinc-500">{s.text}</div></div>
            </motion.div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[[ShieldCheck, 'Windows-Warnung?', 'Beim ersten Start kann „Der Computer wurde durch Windows geschützt“ erscheinen: „Weitere Informationen“ → „Trotzdem ausführen“. Die App ist nur nicht kostenpflichtig signiert.'],
          [Bell, 'Läuft im Hintergrund', 'Das Frachtwerk-Symbol unten rechts neben der Uhr: Linksklick öffnet Frachtwerk, Rechtsklick zeigt Status, Live-Map, Autostart und Beenden.'],
          [Gamepad2, 'Spieldaten (Funbit)', 'Die App lädt den kostenlosen Funbit Telemetry Server automatisch. Klicke dort nur beim ersten Mal auf „Install“ – Windows fragt nach Erlaubnis.']].map(([I, t, d]: any) => (
          <Card key={t} className="p-5"><I className="h-5 w-5 text-amber-400" /><div className="mt-3 font-medium text-white">{t}</div><p className="mt-1 text-sm text-zinc-400">{d}</p></Card>
        ))}
      </div>

      <Card>
        <button onClick={() => setAdvanced(!advanced)} className="flex w-full items-center justify-between px-5 py-4 text-left">
          <span className="flex items-center gap-3"><Terminal className="h-4 w-4 text-zinc-500" /><span className="font-medium text-white">Erweitert</span><span className="text-sm text-zinc-500">Token, Mac/Linux, Kommandozeile</span></span>
          <ChevronDown className={cx('h-4 w-4 text-zinc-500 transition-transform', advanced && 'rotate-180')} />
        </button>
        {advanced && (
          <div className="space-y-5 border-t border-white/[0.06] p-5">
            <div>
              <div className="label">Dein API-Token</div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <code className="flex-1 truncate rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 font-mono text-sm text-amber-200">{show ? token : '•'.repeat(36)}</code>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShow(!show)}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                  <Button variant="outline" onClick={() => copy(token)}><Copy className="h-4 w-4" /> Kopieren</Button>
                  <Button variant="ghost" onClick={regen} title="Neu erzeugen"><RefreshCw className="h-4 w-4" /></Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500">Wie ein Passwort behandeln. Die App braucht ihn nicht – sie verbindet sich per Code.</p>
            </div>
            <CardHeader title="Skript-Client (Mac, Linux, ohne Installation)" subtitle="Benötigt Node.js 18+" />
            <div className="-mt-3 space-y-3 px-0 text-sm text-zinc-400">
              <Button href="/download/frachtwerk-client.js" variant="outline" size="sm"><Download className="h-4 w-4" /> frachtwerk-client.js</Button>
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-ink-950/70 p-3 font-mono text-xs text-emerald-300">$ node frachtwerk-client.js --server {server}</div>
              <p>Ohne Spiel testen: <code className="rounded bg-white/5 px-1 text-zinc-200">--demo</code> fährt eine simulierte Tour.</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
