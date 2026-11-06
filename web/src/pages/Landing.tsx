import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import { ArrowRight, Radio, Receipt, Trophy, Users2, Truck, CalendarDays, Wallet, Zap, ShieldCheck, Check, X as XIcon, ChevronDown, Gauge, Sparkles, Route, Download, KeyRound, PlayCircle, Fuel, Package } from 'lucide-react';
import { PublicNav, Footer } from '../components/PublicLayout';
import { Button, Counter, Avatar, CompanyBadge, cx } from '../components/ui';
import { useApi } from '../lib/auth';
import { compact } from '../lib/format';
import { AreaTrend } from '../components/charts';
import { LiveMap } from '../components/LiveMap';
import { useLiveDrivers } from '../lib/live';
import { ago } from '../lib/format';
import { DiscordIcon } from '../components/icons';

const demoTrend = Array.from({ length: 30 }, (_, i) => ({ label: `${i + 1}.`, km: Math.round(2600 + Math.sin(i / 3) * 900 + i * 70 + (i % 4) * 300), payout: Math.round(1800 + Math.cos(i / 4) * 600 + i * 50) }));

function Road() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] overflow-hidden [perspective:420px]">
      <div className="absolute inset-x-[-50%] bottom-[-10%] h-[160%] origin-bottom [transform:rotateX(68deg)]">
        <div className="absolute inset-0 bg-grid opacity-70" style={{ backgroundSize: '64px 64px' }} />
        {/* Fahrbahn */}
        <div className="absolute inset-y-0 left-1/2 w-[340px] -translate-x-1/2 bg-gradient-to-t from-ink-800/90 to-transparent">
          <div className="absolute inset-y-0 left-0 w-[3px] bg-amber-400/60 shadow-[0_0_20px_rgba(255,179,71,.8)]" />
          <div className="absolute inset-y-0 right-0 w-[3px] bg-amber-400/60 shadow-[0_0_20px_rgba(255,179,71,.8)]" />
          <div className="absolute inset-y-0 left-1/2 w-[6px] -translate-x-1/2 animate-[dash_0.6s_linear_infinite]"
            style={{ backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,.85) 0 50%, transparent 50% 100%)', backgroundSize: '6px 80px' }} />
        </div>
      </div>
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-950 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink-950 to-transparent" />
      <style>{`@keyframes dash { from { background-position: 0 0 } to { background-position: 0 80px } }`}</style>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative mx-auto mt-20 max-w-5xl">
      <div className="absolute -inset-x-10 -top-10 bottom-0 rounded-[40px] bg-amber-500/10 blur-3xl" />
      <motion.div initial={{ opacity: 0, y: 40, rotateX: 12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 1.1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-900/80 shadow-[0_40px_120px_-20px_rgba(0,0,0,.8)] backdrop-blur-xl [transform-style:preserve-3d]">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-rose-500/70" /><span className="h-3 w-3 rounded-full bg-amber-400/70" /><span className="h-3 w-3 rounded-full bg-emerald-500/70" />
          <div className="ml-3 rounded-md bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-zinc-500">frachtwerk.app/app</div>
        </div>
        <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[['Kilometer', '14.094', 'text-amber-300'], ['Umsatz', '802 T€', 'text-cyan-300'], ['Ø Schaden', '1,2 %', 'text-emerald-300']].map(([l, v, c]) => (
                <div key={l} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 sm:p-4">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">{l}</div>
                  <div className={cx('mt-1 font-display text-lg font-semibold sm:text-2xl', c)}>{v}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="mb-1 flex items-center justify-between px-2 text-xs"><span className="font-medium text-zinc-300">Firmenleistung · 30 Tage</span><span className="text-emerald-400">▲ 18%</span></div>
              <AreaTrend height={180} data={demoTrend} series={[{ key: 'km', name: 'km', color: '#ff8a1f' }, { key: 'payout', name: 'Lohn', color: '#22d3ee' }]} />
            </div>
          </div>
          <div className="hidden space-y-3 md:block">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500">Top-Fahrer Oktober</div>
              {[['Kira Vogt', 200, '9.812'], ['Max Brenner', 28, '8.430'], ['Leni Arndt', 320, '7.201'], ['Jonas Falk', 140, '6.044']].map(([n, h, k], i) => (
                <div key={n as string} className="flex items-center gap-3 py-1.5">
                  <span className="w-4 font-mono text-xs text-zinc-600">{i + 1}</span>
                  <Avatar name={n as string} hue={h as number} size={26} /><span className="flex-1 text-sm text-zinc-200">{n}</span><span className="font-mono text-xs text-zinc-400">{k} km</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
              <div className="flex items-center gap-2 text-xs text-cyan-300"><span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-cyan-400" /><span className="relative h-2 w-2 rounded-full bg-cyan-400" /></span>3 Fahrer live</div>
              <div className="mt-2 text-sm text-white">Kiel → Prag</div><div className="text-xs text-zinc-400">Holzstämme · 32 t · 87 km/h</div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[64%] rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300" /></div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Schwebende Karten */}
      <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1, duration: 0.8 }}
        className="absolute -left-4 top-1/3 hidden animate-float rounded-2xl border border-emerald-500/20 bg-ink-850/95 p-4 shadow-2xl backdrop-blur-xl lg:-left-16 lg:block">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15"><Check className="h-5 w-5 text-emerald-400" /></div>
          <div><div className="text-xs text-zinc-400">Tour abgeschlossen</div><div className="font-display text-lg font-semibold text-white">+ 4.218,40 €</div></div>
        </div>
        <div className="mt-2 text-[11px] text-zinc-500">Hamburg → Wien · 0 % Schaden · Bonus +10 %</div>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute -right-4 bottom-10 hidden rounded-2xl border border-amber-500/30 bg-ink-850/95 p-4 shadow-2xl backdrop-blur-xl [animation-delay:1.5s] animate-float lg:-right-14 lg:block">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600"><Trophy className="h-5 w-5 text-ink-950" /></div>
          <div><div className="text-xs text-amber-300">Erfolg freigeschaltet</div><div className="font-display font-semibold text-white">Langstrecke · 10.000 km</div></div>
        </div>
      </motion.div>
    </div>
  );
}

const features = [
  { icon: Zap, title: 'Automatische Erfassung', text: 'Client starten, losfahren. Jede Tour landet mit Kilometern, Verbrauch, Schaden und Erlös automatisch im Fahrtenbuch.', span: 'md:col-span-2', accent: 'amber' },
  { icon: Receipt, title: 'Lohnlauf mit einem Klick', text: 'Monat wählen, prüfen, abrechnen. Jeder Fahrer bekommt seinen eigenen Lohnzettel mit allen Positionen.', accent: 'cyan' },
  { icon: Radio, title: 'Live-Map', text: 'Europa- und USA-Karte in Spielprojektion: Spuren, Ziele, Tempo, Tank – global oder nur deine Spedition.', accent: 'emerald' },
  { icon: Trophy, title: 'Level, Erfolge & Ranglisten', text: 'XP für jeden Kilometer, Boni für sauberes Fahren. Wöchentliche, monatliche und ewige Bestenlisten – für Fahrer und Firmen.', span: 'md:col-span-2', accent: 'violet' },
  { icon: Users2, title: 'Rollen & Bewerbungen', text: 'Inhaber, Admin, Disponent, Fahrer. Offen, per Bewerbung oder per Einladungscode.', span: 'md:col-span-2', accent: 'amber' },
  { icon: Wallet, title: 'Firmenfinanzen', text: 'Kontostand, Einnahmen, Ausgaben, Kraftstoff, Prämien – alles als Buchungsjournal mit Diagrammen.', accent: 'cyan' },
  { icon: Truck, title: 'Fuhrpark', text: 'LKW kaufen, Fahrern zuweisen, Kilometerstand läuft automatisch mit.', accent: 'emerald' },
  { icon: CalendarDays, title: 'Konvois & News', text: 'Events planen, Zusagen sammeln, Ankündigungen an die ganze Firma.', span: 'md:col-span-2', accent: 'violet' },
];
const accentCls: Record<string, string> = { amber: 'from-amber-500/20 text-amber-300', cyan: 'from-cyan-500/20 text-cyan-300', emerald: 'from-emerald-500/20 text-emerald-300', violet: 'from-violet-500/20 text-violet-300' };

const compare = [
  ['Komplett kostenlos – ohne Premium-Stufen', true, false],
  ['Frei einstellbare Lohnformel (km, Anteil, Boni, Abzüge)', true, false],
  ['Lohnzettel pro Fahrer zum Drucken / PDF', true, false],
  ['Live-Map mit Speditionsansicht & Echtzeit-Push', true, true],
  ['Login mit Discord', true, true],
  ['Firmenkonto mit Buchungsjournal', true, false],
  ['Level, XP & Erfolge', true, false],
  ['Selbst hostbar, deine Daten gehören dir', true, false],
  ['Modernes Design, auf dem Handy nutzbar', true, false],
];

const faqs = [
  ['Was kostet Frachtwerk?', 'Nichts. Keine Abos, keine Premium-Features, keine Werbung. Frachtwerk ist Open Source und läuft auf kostenlosem Hosting – oder auf deinem eigenen Rechner.'],
  ['Wie werden meine Touren erfasst?', 'Über den Frachtwerk-Client. Er liest die offizielle Telemetrie-Schnittstelle von ETS2/ATS (über den bewährten Funbit Telemetry Server) und meldet Start, Ziel, Kilometer, Verbrauch und Schaden automatisch. Alternativ kannst du Touren auch manuell einreichen.'],
  ['Funktioniert das mit TruckersMP?', 'Ja. Die Telemetrie funktioniert im Singleplayer und auf TruckersMP. Beachte, dass Aufträge im Multiplayer anders funktionieren – erfasst wird, was das Spiel als Auftrag meldet.'],
  ['Wie wechseln wir mit unserer Firma?', 'Firma gründen, Lohnformel einstellen, Einladungscode im Discord posten. Fahrer registrieren sich, geben den Code ein und sind sofort drin. Ganz ohne Bewerbungschaos.'],
  ['Wie wird der Lohn berechnet?', 'Jede Firma stellt ihre eigene Formel ein: Kilometergeld, prozentualer Frachtanteil, Schadenfrei-Bonus, Abzüge pro Prozent Schaden, Kraftstoff (Firma oder Fahrer), Tempolimit-Strafen und Bußgelder. Jede Position ist auf dem Lohnzettel nachvollziehbar.'],
  ['Kann ich auch ohne Firma fahren?', 'Klar. Als Freifahrer sammelst du XP, Erfolge und Statistiken – und kannst später jederzeit einer Firma beitreten.'],
];


function Ticker() {
  const { data } = useApi<any[]>('/public/activity');
  if (!data?.length) return null;
  const row = [...data, ...data];
  return (
    <div className="relative overflow-hidden border-b border-white/[0.05] py-4 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
      <div className="flex w-max animate-[marquee_60s_linear_infinite] gap-3 hover:[animation-play-state:paused]">
        {row.map((j, i) => (
          <div key={i} className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-white/[0.06] bg-white/[0.02] py-1.5 pl-1.5 pr-4 text-sm">
            <Avatar name={j.display_name} hue={j.avatar_hue} src={j.avatar_url} size={24} />
            <span className="text-zinc-300">{j.display_name}</span>
            {j.company_tag && <span className="font-mono text-[10px]" style={{ color: `hsl(${j.company_hue} 90% 70%)` }}>{j.company_tag}</span>}
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">{j.cargo} nach <span className="text-white">{j.dest_city}</span></span>
            <span className="font-mono text-xs text-zinc-500">{Math.round(j.driven_km)} km · {ago(j.finished_at)}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}

function LiveSection() {
  const { store, version, drivers, status } = useLiveDrivers({ publicMode: true });
  const n = drivers.filter((d) => d.game === 'ets2').length;
  return (
    <section id="live" className="relative scroll-mt-24 py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[.85fr_1.15fr]">
        <div>
          <SectionTitle left eyebrow="Live-Map" title={<>Wo ist wer<br />gerade unterwegs?</>} text="Jeder Truck mit gestartetem Client erscheint sofort auf der Karte – mit Spur, Fracht, Ziel und Tempo. Gezeichnet in der Projektion des Spiels, damit Europa genau so aussieht wie in ETS2." />
          <ul className="mt-8 space-y-3">
            {['Speditionsansicht: nur deine Fahrer – inklusive Offline-Liste', 'Globale Karte mit allen öffentlichen Fahrern', 'Verfolgen-Modus, Routen zum Ziel & Lieferungs-Ticker', 'Echtzeit per Server-Push – kein Neuladen'].map((t) => (
              <li key={t} className="flex items-center gap-3 text-sm text-zinc-300"><span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-500/15"><Check className="h-3 w-3 text-cyan-300" /></span>{t}</li>
            ))}
          </ul>
          <Button to="/map" variant="outline" className="mt-8">Live-Map im Vollbild <ArrowRight className="h-4 w-4" /></Button>
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="relative">
          <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-cyan-500/15 via-transparent to-amber-500/15 blur-3xl" />
          <div className="relative h-[460px] overflow-hidden rounded-3xl border border-white/10 shadow-[0_40px_120px_-20px_rgba(0,0,0,.8)]">
            <LiveMap game="ets2" store={store} version={version} compact interactive />
            <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0a0e18]/80 px-3 py-2 text-xs text-zinc-300 backdrop-blur-xl">
              <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-emerald-400" /><span className="relative h-2 w-2 rounded-full bg-emerald-400" /></span>
              {status === 'connecting' ? 'Verbinde…' : `${n} ${n === 1 ? 'Fahrer' : 'Fahrer'} gerade unterwegs`}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { data: stats } = useApi('/public/stats');
  const { data: providers } = useApi<{ discord: boolean }>('/auth/providers');
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const [faq, setFaq] = useState<number | null>(0);

  return (
    <div className="relative overflow-x-hidden bg-ink-950 noise">
      <PublicNav />

      {/* HERO */}
      <section ref={heroRef} className="relative overflow-hidden pt-32 pb-24 sm:pt-40">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-200px] h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,138,31,.22),transparent)]" />
          <div className="absolute left-[10%] top-[30%] h-[300px] w-[300px] rounded-full bg-cyan-500/10 blur-[100px]" />
          <Road />
        </div>
        <motion.div style={{ y }} className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
          <motion.a href="#features" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/[0.08] py-1 pl-1 pr-3 text-xs text-amber-200 backdrop-blur hover:bg-amber-500/15 transition">
            <span className="hazard h-3 w-6 rounded-full" />
            Für ETS2 &amp; ATS · kostenlos <ArrowRight className="h-3 w-3" />
          </motion.a>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-7 max-w-4xl font-display text-[44px] font-bold leading-[1.02] tracking-[-0.03em] text-white sm:text-6xl md:text-7xl">
            <span className="uppercase">Fahren. Abliefern.</span><br /><span className="uppercase text-amber-400">Lohnzettel.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}
            className="mx-auto mt-6 max-w-2xl text-base text-zinc-400 sm:text-lg">
            Frachtwerk erfasst jede Tour aus ETS2 und ATS, rechnet den Lohn nach euren Regeln ab und zeigt eure Fahrer live auf der Karte. Kostenlos, für jede Spedition.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button to="/register" size="lg" className="w-full sm:w-auto">Spedition gründen <ArrowRight className="h-4 w-4" /></Button>
            <Button to="/login?demo=1" size="lg" variant="outline" className="w-full sm:w-auto"><PlayCircle className="h-4 w-4" /> Live-Demo ansehen</Button>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-500">
            {providers?.discord && <a href="/api/auth/discord" className="flex items-center gap-1.5 text-[#8b95ff] transition hover:text-white"><DiscordIcon className="h-3.5 w-3.5" />Direkt mit Discord starten</a>}
            {['Keine Kreditkarte', 'Einrichtung in 5 Minuten', 'Open Source'].map((t) => <span key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-amber-400" />{t}</span>)}
          </motion.div>
          <HeroMockup />
        </motion.div>
      </section>

      <div className="hazard h-1.5 opacity-90" />
      {/* LIVE-ZAHLEN */}
      <section className="relative border-y border-white/[0.05] bg-white/[0.015]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:px-6 md:grid-cols-4">
          {[
            ['Gefahrene Kilometer', stats?.km, (n: number) => compact(n)],
            ['Gelieferte Frachten', stats?.jobs, undefined],
            ['Tonnen bewegt', stats?.tonnage, (n: number) => compact(n)],
            ['Speditionen', stats?.companies, undefined],
          ].map(([l, v, f]: any) => (
            <div key={l} className="px-4 py-10 text-center">
              <div className="font-display text-3xl font-semibold text-white sm:text-4xl"><Counter value={v || 0} format={f} /></div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <Ticker />
      <LiveSection />

      {/* FEATURES */}
      <section id="features" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-28 sm:px-6">
        <SectionTitle eyebrow="Alles drin" title="Was Frachtwerk kann" text="Fahrtenbuch, Lohnlauf, Firmenkonto, Live-Map und Team-Verwaltung an einer Stelle." />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: (i % 3) * 0.08, duration: 0.6 }}
              className={cx('group card relative overflow-hidden p-7 transition hover:border-white/15', f.span)}>
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/[0.03] blur-2xl transition group-hover:bg-amber-500/10" />
              <div className={cx('grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br to-transparent ring-1 ring-white/10', accentCls[f.accent])}><f.icon className="h-5 w-5" /></div>
              <h3 className="mt-5 font-display text-xl font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.text}</p>
              {i === 0 && (
                <div className="mt-6 grid grid-cols-4 gap-2 font-mono text-[11px]">
                  {[[Route, '1.284 km'], [Fuel, '412 l'], [Package, '32,4 t'], [Gauge, '0,0 %']].map(([I, t]: any) => (
                    <div key={t} className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-2 text-zinc-300"><I className="h-3.5 w-3.5 text-amber-400" />{t}</div>
                  ))}
                </div>
              )}
              {i === 3 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {['Erste Ladung', 'Langstrecke', 'Samthandschuh', 'Schwergewicht', 'Kontinental'].map((a, k) => (
                    <span key={a} className={cx('rounded-full px-3 py-1 text-xs ring-1', k < 3 ? 'bg-amber-500/10 text-amber-200 ring-amber-500/30' : 'bg-white/[0.03] text-zinc-500 ring-white/10')}> {a}</span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ABRECHNUNG */}
      <section id="abrechnung" className="relative scroll-mt-24 overflow-hidden py-28">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/[0.05] blur-[120px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionTitle left eyebrow="Die Abrechnung" title={<>Jeder Euro<br />nachvollziehbar.</>} text="Jede Firma bestimmt ihre eigene Lohnformel. Frachtwerk rechnet jede Tour sofort ab und zeigt jedem Fahrer genau, wie sein Lohn zustande kommt. Schluss mit Diskussionen im Discord." />
            <ul className="mt-8 space-y-3">
              {['Kilometergeld + prozentualer Frachtanteil', 'Schadenfrei-Bonus & Abzug pro Schadensprozent', 'Kraftstoff zahlt Firma oder Fahrer', 'Tempolimit-Strafen & Bußgelder', 'Prüfung durch Disponenten oder Auto-Freigabe', 'Monatlicher Lohnlauf mit druckbaren Lohnzetteln'].map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-zinc-300"><span className="grid h-5 w-5 place-items-center rounded-full bg-amber-500/15"><Check className="h-3 w-3 text-amber-400" /></span>{t}</li>
              ))}
            </ul>
          </div>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="relative">
            <div className="absolute -inset-4 rounded-[32px] bg-gradient-to-br from-amber-500/20 via-transparent to-cyan-500/20 blur-2xl" />
            <div className="relative rounded-3xl border border-white/10 bg-ink-900/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3"><CompanyBadge tag="NLX" hue={28} size={44} /><div><div className="font-display font-semibold text-white">Lohnzettel · Tour #2841</div><div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500"><span className="sign text-[11px]">Hamburg</span><span>→</span><span className="sign text-[11px]">Wien</span><span className="ml-1">Maschinenteile · 18,2 t</span></div></div></div>
                <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300 ring-1 ring-emerald-500/20">Freigegeben</span>
              </div>
              <div className="mt-6 space-y-2.5 font-mono text-sm">
                {[['Kilometergeld (1.042 km × 0,45 €)', '468,90 €', ''], ['Frachtanteil (15 % von 52.340 €)', '7.851,00 €', ''], ['Schadenfrei-Bonus (10 %)', '831,99 €', 'text-emerald-400'], ['Bußgeld Blitzer A1', '− 120,00 €', 'text-rose-400']].map(([l, v, c]) => (
                  <div key={l} className="flex items-center justify-between gap-4 border-b border-dashed border-white/[0.06] pb-2.5"><span className="font-sans text-zinc-400">{l}</span><span className={cx('text-zinc-200', c)}>{v}</span></div>
                ))}
              </div>
              <div className="mt-5 flex items-end justify-between">
                <span className="text-sm text-zinc-400">Auszahlung</span>
                <span className="font-display text-4xl font-bold text-gradient">9.031,89 €</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SO GEHT'S */}
      <section id="so-gehts" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-28 sm:px-6">
        <SectionTitle eyebrow="In 3 Schritten" title="In drei Schritten startklar" text="Eine Fahrt von Calais nach Duisburg dauert länger." />
        <div className="relative mt-16 grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-8 hidden h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent md:block" />
          {[
            [Sparkles, '01', 'Firma gründen', 'Name, Kürzel und Farbe wählen. Lohnformel einstellen – oder einfach unsere fairen Standardwerte nutzen.'],
            [KeyRound, '02', 'Team einladen', 'Einladungscode in euren Discord posten. Fahrer registrieren sich und sind mit einem Klick dabei.'],
            [Download, '03', 'Client starten & fahren', 'Token einfügen, Spiel starten. Ab jetzt landet jede Tour automatisch im Fahrtenbuch.'],
          ].map(([I, n, t, d]: any, i) => (
            <motion.div key={n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} className="relative text-center">
              <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-amber-500/30 bg-ink-900 shadow-glow"><I className="h-6 w-6 text-amber-400" /></div>
              <div className="mt-5 font-mono text-xs text-amber-400/80">{n}</div>
              <h3 className="mt-1 font-display text-xl font-semibold text-white">{t}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-zinc-400">{d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* VERGLEICH */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="Warum wechseln?" title="Frachtwerk im Vergleich" />
        <div className="mt-12 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02]">
          <div className="grid grid-cols-[1fr_90px_90px] items-center border-b border-white/[0.06] px-5 py-4 text-xs sm:grid-cols-[1fr_140px_140px] sm:px-8">
            <span className="label">Funktion</span>
            <span className="text-center font-display text-sm font-semibold text-amber-300">Frachtwerk</span>
            <span className="text-center text-zinc-500">Typische VTC-Tools</span>
          </div>
          {compare.map(([l, a, b], i) => (
            <div key={l as string} className={cx('grid grid-cols-[1fr_90px_90px] items-center px-5 py-3.5 text-sm sm:grid-cols-[1fr_140px_140px] sm:px-8', i % 2 && 'bg-white/[0.015]')}>
              <span className="text-zinc-300">{l}</span>
              <span className="grid place-items-center">{a ? <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-500/15"><Check className="h-3.5 w-3.5 text-amber-400" /></span> : <XIcon className="h-4 w-4 text-zinc-600" />}</span>
              <span className="grid place-items-center">{b ? <Check className="h-4 w-4 text-zinc-500" /> : <span className="text-xs text-zinc-600">teilweise / Premium</span>}</span>
            </div>
          ))}
        </div>
      </section>

      {/* PREIS */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-[32px] border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.12] via-ink-900 to-ink-900 p-8 sm:p-14">
          <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-amber-500/20 blur-[100px]" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="label text-amber-300/80">Preis</div>
              <div className="mt-3 flex items-end gap-3"><span className="font-display text-7xl font-bold text-white sm:text-8xl">0 €</span><span className="mb-3 text-zinc-400">/ für immer</span></div>
              <p className="mt-4 max-w-md text-zinc-400">Jede Funktion, für jede Firma, für jeden Fahrer. Unbegrenzte Mitglieder, unbegrenzte Touren. Open Source und selbst hostbar.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {['Unbegrenzte Fahrer', 'Unbegrenzte Touren', 'Alle Abrechnungs-Features', 'Live-Tracking', 'Lohnzettel & Export', 'Eigenes Hosting möglich'].map((t) => (
                <div key={t} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-ink-950/40 px-4 py-3 text-sm text-zinc-200"><ShieldCheck className="h-4 w-4 text-amber-400" />{t}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-24 sm:px-6">
        <SectionTitle eyebrow="FAQ" title="Häufige Fragen" />
        <div className="mt-12 space-y-3">
          {faqs.map(([q, a], i) => (
            <div key={q} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
              <button onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
                <span className="font-medium text-white">{q}</span>
                <ChevronDown className={cx('h-5 w-5 shrink-0 text-zinc-500 transition-transform', faq === i && 'rotate-180 text-amber-400')} />
              </button>
              <motion.div initial={false} animate={{ height: faq === i ? 'auto' : 0, opacity: faq === i ? 1 : 0 }} className="overflow-hidden">
                <p className="px-6 pb-5 text-sm leading-relaxed text-zinc-400">{a}</p>
              </motion.div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-4 pb-32 pt-10 text-center sm:px-6">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/15 blur-[120px]" />
        <div className="relative">
          <h2 className="mx-auto max-w-3xl font-display text-4xl font-bold tracking-tight text-white sm:text-6xl">Leg deine Spedition an.</h2>
          <p className="mx-auto mt-5 max-w-xl text-zinc-400">Gründe deine Spedition in unter fünf Minuten – oder schließ dich einer der Firmen im Verzeichnis an.</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button to="/register" size="lg">Spedition anlegen <ArrowRight className="h-4 w-4" /></Button>
            <Button to="/companies" size="lg" variant="outline">Firmen entdecken</Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function SectionTitle({ eyebrow, title, text, left }: { eyebrow: string; title: any; text?: string; left?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className={left ? '' : 'text-center'}>
      <div className="label text-amber-400/90">{eyebrow}</div>
      <h2 className="mt-3 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">{title}</h2>
      {text && <p className={cx('mt-5 text-zinc-400 sm:text-lg', !left && 'mx-auto max-w-2xl')}>{text}</p>}
    </motion.div>
  );
}
