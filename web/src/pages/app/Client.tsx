import { useState } from 'react';
import { Copy, Eye, EyeOff, RefreshCw, Download, Terminal, Plug, Gamepad2, CheckCircle2, ExternalLink } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Button, Card, CardHeader, PageHeader, useToast } from '../../components/ui';

export default function ClientPage() {
  const { me, refresh } = useAuth();
  const toast = useToast();
  const [show, setShow] = useState(false);
  const { data: dl } = useApi<{ client_exe: boolean }>('/downloads');
  if (!me) return null;
  const token = me.user.api_token;
  const server = window.location.origin;
  const cmd = `node frachtwerk-client.js --server ${server} --token ${show ? token : 'DEIN_TOKEN'}`;
  const copy = (t: string) => { navigator.clipboard?.writeText(t); toast('Kopiert'); };
  const regen = async () => { if (!confirm('Neuen Token erzeugen? Der alte funktioniert dann nicht mehr.')) return; await api('/me/token', { body: {} }); await refresh(); toast('Neuer Token erstellt'); };

  const steps = [
    { icon: Plug, title: 'Telemetrie-Plugin installieren', body: <>Lade den kostenlosen <a className="text-amber-400 hover:underline" href="https://github.com/Funbit/ets2-telemetry-server" target="_blank" rel="noreferrer">Funbit ETS2 Telemetry Server <ExternalLink className="inline h-3 w-3" /></a> herunter, starte <code className="rounded bg-white/5 px-1">Ets2Telemetry.exe</code> und klicke auf „Install". Er stellt die Spieldaten unter <code className="rounded bg-white/5 px-1">localhost:25555</code> bereit – funktioniert für ETS2 und ATS.</> },
    dl?.client_exe
      ? { icon: Download, title: 'Frachtwerk-Client herunterladen', body: <>Ein Programm, nichts zu installieren. Leg es z. B. auf den Desktop. Beim ersten Start fragt es nach <b className="text-zinc-200">Server-Adresse</b> (<code className="rounded bg-white/5 px-1">{server}</code>) und deinem <b className="text-zinc-200">Token</b> von oben. Windows zeigt evtl. „Der Computer wurde durch Windows geschützt“ → „Weitere Informationen“ → „Trotzdem ausführen“.</>,
          action: <div className="flex flex-wrap gap-2"><Button href="/download/Frachtwerk-Client.exe"><Download className="h-4 w-4" /> Frachtwerk-Client.exe (Windows)</Button><Button href="/download/frachtwerk-client.js" variant="ghost" size="sm">Mac / Linux: Skript-Version</Button></div> }
      : { icon: Download, title: 'Node.js & Frachtwerk-Client', body: <>Installiere <a className="text-amber-400 hover:underline" href="https://nodejs.org" target="_blank" rel="noreferrer">Node.js (LTS)</a> und lade den Client herunter. Er ist eine einzige Datei ohne weitere Abhängigkeiten.</>, action: <Button href="/download/frachtwerk-client.js" variant="outline" size="sm"><Download className="h-4 w-4" /> frachtwerk-client.js</Button> },
    ...(dl?.client_exe ? [] : [{ icon: Terminal, title: 'Client starten', body: <>Öffne im Download-Ordner ein Terminal und starte den Client mit deinem persönlichen Token:</>, code: true }]),
    { icon: Gamepad2, title: 'Spiel starten & Auftrag annehmen', body: <>Der Client erkennt Start und Ablieferung automatisch, misst Kilometer, Verbrauch und Schaden und sendet alles an Frachtwerk. Dein Live-Status erscheint auf der Live-Karte.</> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Telemetrie" title="Client & Token" subtitle="Einmal einrichten – danach landet jede Tour automatisch im Fahrtenbuch." />
      <Card glow className="p-6">
        <div className="label">Dein API-Token</div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <code className="flex-1 truncate rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 font-mono text-sm text-amber-200">{show ? token : '•'.repeat(36)}</code>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShow(!show)}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
            <Button variant="outline" onClick={() => copy(token)}><Copy className="h-4 w-4" /> Kopieren</Button>
            <Button variant="ghost" onClick={regen} title="Neu erzeugen"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Behandle den Token wie ein Passwort. Er erlaubt nur das Melden von Touren und Live-Daten für dein Konto.</p>
      </Card>

      <div className="grid gap-4">
        {steps.map((s, i) => (
          <Card key={s.title} className="p-5">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15"><s.icon className="h-5 w-5 text-amber-400" /></div>
                {i < steps.length - 1 && <div className="mt-2 w-px flex-1 bg-gradient-to-b from-amber-500/30 to-transparent" />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="font-mono text-xs text-amber-400/80">Schritt {i + 1}</div>
                <h3 className="font-display text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                {s.action && <div className="mt-3">{s.action}</div>}
                {s.code && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-ink-950/70 p-3">
                    <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-emerald-300">$ {cmd}</code>
                    <Button size="sm" variant="ghost" onClick={() => copy(`node frachtwerk-client.js --server ${server} --token ${token}`)}><Copy className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Ohne Spiel testen" icon={CheckCircle2} />
        <div className="px-5 pb-5 text-sm text-zinc-400">
          Mit <code className="rounded bg-white/5 px-1 text-zinc-200">--demo</code> simuliert der Client eine komplette Tour (Start, Fahrt mit Live-Daten, Ablieferung). Perfekt, um die Einrichtung zu prüfen:
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-ink-950/70 p-3 font-mono text-xs text-emerald-300">$ node frachtwerk-client.js --server {server} --token DEIN_TOKEN --demo</div>
        </div>
      </Card>
    </div>
  );
}
