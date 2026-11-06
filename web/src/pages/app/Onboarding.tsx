import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, KeyRound, Search, ArrowRight, Clock } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Button, Card, CompanyBadge, Field, Input, PageHeader, Select, Tabs, Textarea, useToast, Badge, cx } from '../../components/ui';
import { compact } from '../../lib/format';
import { JOIN_LABEL } from '../Companies';

const HUES = [28, 0, 340, 280, 230, 200, 170, 140, 90, 50];

export default function Onboarding() {
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('create');
  const [f, setF] = useState({ name: '', tag: '', description: '', hue: 28, games: 'ets2', join_mode: 'apply' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: list } = useApi<any[]>('/companies?search=');

  if (me?.member) return (
    <Card className="p-10 text-center"><p className="text-zinc-300">Du bist bereits Mitglied bei <b>{me.member.company_name}</b>.</p><Button to="/app/company" className="mt-4">Zur Firma</Button></Card>
  );

  const create = async () => {
    setBusy(true);
    try { await api('/companies', { body: f }); await refresh(); toast('Spedition gegründet!'); nav('/app/company/settings'); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const joinCode = async () => {
    setBusy(true);
    try { const r = await api('/join-by-code', { body: { code } }); await refresh(); if (r.joined) { toast('Willkommen im Team!'); nav('/app/company'); } }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const withdraw = async () => { await api('/applications/mine', { method: 'DELETE' }); refresh(); };

  return (
    <div>
      <PageHeader eyebrow="Los geht's" title="Deine Spedition" subtitle="Gründe eine eigene Firma, tritt per Code bei oder stöbere im Verzeichnis." />
      {me?.pendingApplication && (
        <Card className="mb-6 border-amber-500/20 bg-amber-500/[0.05] p-5">
          <div className="flex flex-wrap items-center gap-4">
            <Clock className="h-5 w-5 text-amber-400" />
            <div className="flex-1 text-sm text-zinc-200">Deine Bewerbung bei <b>{me.pendingApplication.company_name}</b> wird geprüft.</div>
            <Button size="sm" variant="ghost" onClick={withdraw}>Zurückziehen</Button>
          </div>
        </Card>
      )}
      <Tabs id="ob" value={tab} onChange={setTab} tabs={[{ id: 'create', label: <><Sparkles className="h-4 w-4" />Gründen</> }, { id: 'code', label: <><KeyRound className="h-4 w-4" />Code</> }, { id: 'browse', label: <><Search className="h-4 w-4" />Verzeichnis</> }]} />

      <div className="mt-6">
        {tab === 'create' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <Card className="p-6">
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <Field label="Firmenname"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z. B. Nordlicht Logistik" maxLength={48} /></Field>
                <Field label="Kürzel"><Input value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="NLX" maxLength={6} className="font-mono tracking-widest" /></Field>
              </div>
              <Field label="Beschreibung" className="mt-4"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Wofür steht ihr? Welche Routen, welche Community?" /></Field>
              <div className="mt-4">
                <span className="mb-2 block text-xs font-medium text-zinc-400">Firmenfarbe</span>
                <div className="flex flex-wrap gap-2">
                  {HUES.map((h) => (
                    <button key={h} onClick={() => setF({ ...f, hue: h })} className={cx('h-9 w-9 rounded-xl transition', f.hue === h ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-ink-900' : 'opacity-70 hover:opacity-100')}
                      style={{ background: `linear-gradient(135deg, hsl(${h} 90% 55%), hsl(${(h + 30) % 360} 85% 32%))` }} />
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Spiel"><Select value={f.games} onChange={(e) => setF({ ...f, games: e.target.value })}><option value="ets2">Euro Truck Simulator 2</option><option value="ats">American Truck Simulator</option><option value="both">Beide</option></Select></Field>
                <Field label="Aufnahme"><Select value={f.join_mode} onChange={(e) => setF({ ...f, join_mode: e.target.value })}><option value="open">Offen – jeder kann beitreten</option><option value="apply">Per Bewerbung</option><option value="invite">Nur mit Einladungscode</option></Select></Field>
              </div>
              <Button className="mt-6 w-full" size="lg" loading={busy} onClick={create} disabled={f.name.length < 3 || f.tag.length < 2}>Spedition gründen <ArrowRight className="h-4 w-4" /></Button>
              <p className="mt-3 text-center text-xs text-zinc-500">Gründen ist komplett kostenlos – echtes Geld fließt nie. Deine Firma startet bei 0 € und verdient ihr (Spiel-)Geld mit euren Touren.</p>
            </Card>
            <div>
              <div className="label mb-3">Vorschau</div>
              <motion.div layout className="card relative overflow-hidden p-6">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-28" style={{ background: `radial-gradient(ellipse at top, hsl(${f.hue} 90% 50% / .3), transparent 70%)` }} />
                <div className="relative flex items-center gap-4">
                  <CompanyBadge tag={f.tag || 'TAG'} hue={f.hue} size={60} />
                  <div className="min-w-0"><div className="truncate font-display text-xl font-semibold text-white">{f.name || 'Deine Firma'}</div><Badge tone={JOIN_LABEL[f.join_mode][1]} className="mt-1">{JOIN_LABEL[f.join_mode][0]}</Badge></div>
                </div>
                <p className="relative mt-4 line-clamp-3 text-sm text-zinc-400">{f.description || 'Hier steht eure Beschreibung.'}</p>
                <div className="relative mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4 text-center text-sm">
                  {[['1', 'Fahrer'], ['0', 'km'], ['0', 'Touren']].map(([v, l]) => <div key={l}><div className="font-display font-semibold text-white">{v}</div><div className="text-[10px] uppercase tracking-widest text-zinc-500">{l}</div></div>)}
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {tab === 'code' && (
          <Card className="mx-auto max-w-md p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15"><KeyRound className="h-6 w-6 text-amber-400" /></div>
            <h3 className="mt-4 font-display text-xl font-semibold text-white">Einladungscode eingeben</h3>
            <p className="mt-1 text-sm text-zinc-400">Den Code bekommst du von deiner Firmenleitung, z. B. im Discord.</p>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="A1B2C3D4" className="mt-6 h-14 text-center font-mono text-2xl tracking-[0.3em]" maxLength={12} />
            <Button className="mt-4 w-full" size="lg" loading={busy} onClick={joinCode} disabled={code.length < 4}>Beitreten</Button>
          </Card>
        )}

        {tab === 'browse' && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list?.map((c) => (
              <Link key={c.id} to={`/c/${c.slug}`} className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:border-white/15">
                <CompanyBadge tag={c.tag} hue={c.hue} size={48} />
                <div className="min-w-0 flex-1"><div className="truncate font-semibold text-white">{c.name}</div><div className="text-xs text-zinc-500">{c.members} Fahrer · {compact(c.km)} km</div></div>
                <Badge tone={JOIN_LABEL[c.join_mode][1]}>{JOIN_LABEL[c.join_mode][0]}</Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
