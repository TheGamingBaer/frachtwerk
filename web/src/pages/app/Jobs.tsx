import { useEffect, useState } from 'react';
import { Search, Plus, Route, Package, Fuel, Gauge, ShieldAlert, Truck, Check, X, Trash2, MapPin, Clock } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Avatar, Button, Card, Empty, Field, Input, Modal, PageHeader, ReviewBadge, Select, Skeleton, Tabs, Textarea, useToast, cx, Badge } from '../../components/ui';
import { ago, can, dateTime, eur, km, num } from '../../lib/format';

export default function Jobs() {
  const { me } = useAuth();
  const staff = can(me?.member?.role, 'dispatcher');
  const [scope, setScope] = useState('me');
  const [review, setReview] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [jobId, setJobId] = useState<number | null>(null);
  const [newJob, setNewJob] = useState(false);
  useEffect(() => setPage(0), [scope, review, q]);
  const { data, loading, reload } = useApi(`/jobs?scope=${scope}&review=${review}&q=${encodeURIComponent(q)}&limit=25&offset=${page * 25}`, [scope, review, q, page]);

  return (
    <div>
      <PageHeader eyebrow="Fahrtenbuch" title="Touren" subtitle="Alle erfassten Lieferungen mit Abrechnung."
        actions={<Button onClick={() => setNewJob(true)}><Plus className="h-4 w-4" /> Tour einreichen</Button>} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {me?.member && <Tabs id="scope" value={scope} onChange={setScope} tabs={[{ id: 'me', label: 'Meine' }, { id: 'company', label: 'Ganze Firma' }]} />}
          <Tabs id="review" value={review} onChange={setReview} tabs={[{ id: '', label: 'Alle' }, { id: 'pending', label: 'In Prüfung' }, { id: 'approved', label: 'Freigegeben' }, { id: 'rejected', label: 'Abgelehnt' }]} />
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Stadt oder Fracht…" className="pl-10" />
        </div>
      </div>

      <Card>
        <div className="hidden grid-cols-[1.6fr_1fr_.7fr_.7fr_.8fr_.8fr] gap-4 border-b border-white/[0.06] px-5 py-3 text-[11px] uppercase tracking-widest text-zinc-500 md:grid">
          <span>Route</span><span>Fracht</span><span className="text-right">Strecke</span><span className="text-right">Schaden</span><span>Status</span><span className="text-right">Lohn</span>
        </div>
        {loading && !data && <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>}
        {data?.rows.map((j: any) => (
          <button key={j.id} onClick={() => setJobId(j.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-white/[0.04] px-5 py-3.5 text-left transition last:border-0 hover:bg-white/[0.025] md:grid-cols-[1.6fr_1fr_.7fr_.7fr_.8fr_.8fr]">
            <div className="flex min-w-0 items-center gap-3">
              {scope === 'company' ? <Avatar name={j.display_name} hue={j.avatar_hue} size={32} /> : <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04]"><Route className="h-4 w-4 text-zinc-500" /></div>}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{j.origin_city} <span className="text-zinc-600">→</span> {j.dest_city}</div>
                <div className="truncate text-xs text-zinc-500">{scope === 'company' ? `${j.display_name} · ` : ''}{ago(j.finished_at || j.started_at)}{j.source === 'manual' ? ' · manuell' : ''}</div>
              </div>
            </div>
            <div className="hidden min-w-0 md:block"><div className="truncate text-sm text-zinc-300">{j.cargo}</div><div className="text-xs text-zinc-500">{num(j.cargo_mass, 1)} t</div></div>
            <div className="hidden text-right font-mono text-sm text-zinc-300 md:block">{km(j.driven_km)}</div>
            <div className={cx('hidden text-right font-mono text-sm md:block', j.damage > 5 ? 'text-rose-300' : j.damage > 0 ? 'text-amber-300' : 'text-emerald-300')}>{num(j.damage, 1)} %</div>
            <div className="hidden md:block"><ReviewBadge review={j.review} status={j.status} /></div>
            <div className="text-right"><div className="font-mono text-sm font-semibold text-white">{eur(j.payout)}</div><div className="text-xs text-zinc-500 md:hidden">{km(j.driven_km)}</div></div>
          </button>
        ))}
        {data && !data.rows.length && <Empty icon={Route} title="Keine Touren gefunden" text="Sobald du mit dem Client fährst, erscheinen deine Touren hier." />}
        {data && data.total > 25 && (
          <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-sm text-zinc-500">
            <span>{page * 25 + 1}–{Math.min(data.total, (page + 1) * 25)} von {data.total}</span>
            <div className="flex gap-2"><Button size="sm" variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>Zurück</Button><Button size="sm" variant="outline" disabled={(page + 1) * 25 >= data.total} onClick={() => setPage(page + 1)}>Weiter</Button></div>
          </div>
        )}
      </Card>
      {staff && scope === 'me' && <p className="mt-3 text-xs text-zinc-500">Tipp: Als Disponent prüfst du Touren unter „Ganze Firma" → „In Prüfung".</p>}

      <JobModal id={jobId} onClose={() => setJobId(null)} onChange={reload} />
      <NewJobModal open={newJob} onClose={() => setNewJob(false)} onDone={reload} />
    </div>
  );
}

export function JobModal({ id, onClose, onChange }: { id: number | null; onClose: () => void; onChange?: () => void }) {
  const [j, setJ] = useState<any>(null);
  const [note, setNote] = useState('');
  const [fines, setFines] = useState('');
  const [busy, setBusy] = useState(false);
  const { me } = useAuth();
  const toast = useToast();
  useEffect(() => { setJ(null); setNote(''); if (id) api(`/jobs/${id}`).then((r) => { setJ(r); setFines(String(r.fines || 0)); }).catch((e) => toast(e.message, 'err')); }, [id]);

  const review = async (action: string) => {
    setBusy(true);
    try { await api(`/jobs/${id}/review`, { body: { action, note, fines: Number(fines) } }); toast(action === 'approve' ? 'Tour freigegeben' : 'Tour abgelehnt'); onChange?.(); onClose(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!confirm('Tour wirklich löschen?')) return;
    try { await api(`/jobs/${id}`, { method: 'DELETE' }); toast('Tour gelöscht'); onChange?.(); onClose(); } catch (e: any) { toast(e.message, 'err'); }
  };

  return (
    <Modal open={!!id} onClose={onClose} title={j ? `Frachtbrief #${j.id}` : 'Lädt…'} wide>
      {!j ? <Skeleton className="h-80" /> : (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-amber-500/10 via-transparent to-cyan-500/[0.06] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3"><Avatar name={j.display_name} hue={j.avatar_hue} size={34} /><div><div className="text-sm font-medium text-white">{j.display_name}</div><div className="text-xs text-zinc-500">{dateTime(j.finished_at || j.started_at)} · {j.game.toUpperCase()} · {j.source === 'client' ? 'Client' : 'Manuell'}</div></div></div>
              <ReviewBadge review={j.review} status={j.status} />
            </div>
            <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div><div className="label">Start</div><div className="mt-1 font-display text-xl font-semibold text-white">{j.origin_city}</div><div className="text-xs text-zinc-500">{j.origin_company}</div></div>
              <div className="flex items-center gap-1 text-amber-400"><MapPin className="h-4 w-4" /><span className="h-px w-10 bg-gradient-to-r from-amber-400 to-cyan-400 sm:w-24" /><MapPin className="h-4 w-4 text-cyan-400" /></div>
              <div className="text-right"><div className="label">Ziel</div><div className="mt-1 font-display text-xl font-semibold text-white">{j.dest_city}</div><div className="text-xs text-zinc-500">{j.dest_company}</div></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[[Package, 'Fracht', j.cargo, `${num(j.cargo_mass, 1)} t`], [Route, 'Strecke', km(j.driven_km), `geplant ${km(j.planned_km)}`], [Fuel, 'Kraftstoff', `${num(j.fuel_used)} l`, j.driven_km ? `${num((j.fuel_used / j.driven_km) * 100, 1)} l/100km` : ''],
              [ShieldAlert, 'Schaden', `${num(j.damage, 1)} %`, `LKW ${num(j.truck_damage, 1)} %`], [Gauge, 'Max. Tempo', `${num(j.max_speed)} km/h`, `Ø ${num(j.avg_speed)} km/h`], [Truck, 'LKW', j.truck || '–', ''], [Clock, 'Frachterlös', eur(j.income), j.late ? 'verspätet' : 'pünktlich']].map(([I, l, v, s]: any) => (
              <div key={l} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-zinc-500"><I className="h-3 w-3" />{l}</div>
                <div className="mt-1 truncate text-sm font-semibold text-white">{v}</div>{s && <div className="text-[11px] text-zinc-500">{s}</div>}
              </div>
            ))}
          </div>

          {j.breakdown.length > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-ink-950/40 p-5">
              <div className="label mb-3">Abrechnung {j.company_name && `· ${j.company_name}`}</div>
              <div className="space-y-2 font-mono text-sm">
                {j.breakdown.map((l: any) => (
                  <div key={l.label} className="flex justify-between gap-4 border-b border-dashed border-white/[0.06] pb-2"><span className="font-sans text-zinc-400">{l.label}</span><span className={l.amount < 0 ? 'text-rose-300' : l.label.includes('Bonus') ? 'text-emerald-300' : 'text-zinc-200'}>{eur(l.amount, 2)}</span></div>
                ))}
              </div>
              <div className="mt-4 flex items-end justify-between"><span className="text-sm text-zinc-400">Auszahlung</span><span className="font-display text-3xl font-bold text-gradient">{eur(j.payout, 2)}</span></div>
              {j.payroll_id && <div className="mt-2 text-right"><Badge tone="emerald">Bereits abgerechnet</Badge></div>}
            </div>
          )}

          {j.review_note && <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300"><span className="text-zinc-500">Notiz Disposition: </span>{j.review_note}</div>}
          {j.notes && <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300"><span className="text-zinc-500">Notiz Fahrer: </span>{j.notes}</div>}

          {j.canReview && j.review === 'pending' && j.status === 'delivered' && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5">
              <div className="mb-3 font-display font-semibold text-white">Tour prüfen</div>
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <Field label="Bußgelder (€)"><Input type="number" min={0} value={fines} onChange={(e) => setFines(e.target.value)} /></Field>
                <Field label="Notiz (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Screenshot fehlt" /></Field>
              </div>
              <div className="mt-4 flex gap-2"><Button loading={busy} onClick={() => review('approve')}><Check className="h-4 w-4" /> Freigeben</Button><Button variant="danger" loading={busy} onClick={() => review('reject')}><X className="h-4 w-4" /> Ablehnen</Button></div>
            </div>
          )}
          {j.user_id === me?.user.id && j.review !== 'approved' && <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={del}><Trash2 className="h-4 w-4" /> Tour löschen</Button></div>}
        </div>
      )}
    </Modal>
  );
}

export function NewJobModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  const init = { game: 'ets2', origin_city: '', origin_company: '', dest_city: '', dest_company: '', cargo: '', cargo_mass: '', truck: '', driven_km: '', income: '', fuel_used: '', damage: '0', fines: '0', notes: '' };
  const [f, setF] = useState<any>(init);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setBusy(true);
    try { await api('/jobs', { body: f }); toast('Tour eingereicht – wartet auf Prüfung'); setF(init); onDone?.(); onClose(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Tour manuell einreichen" wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Spiel"><Select value={f.game} onChange={set('game')}><option value="ets2">Euro Truck Simulator 2</option><option value="ats">American Truck Simulator</option></Select></Field>
        <Field label="LKW"><Input value={f.truck} onChange={set('truck')} placeholder="Scania S 730" /></Field>
        <Field label="Startstadt *"><Input value={f.origin_city} onChange={set('origin_city')} /></Field>
        <Field label="Absender"><Input value={f.origin_company} onChange={set('origin_company')} /></Field>
        <Field label="Zielstadt *"><Input value={f.dest_city} onChange={set('dest_city')} /></Field>
        <Field label="Empfänger"><Input value={f.dest_company} onChange={set('dest_company')} /></Field>
        <Field label="Fracht *"><Input value={f.cargo} onChange={set('cargo')} /></Field>
        <Field label="Gewicht (t)"><Input type="number" value={f.cargo_mass} onChange={set('cargo_mass')} /></Field>
        <Field label="Gefahrene km *"><Input type="number" value={f.driven_km} onChange={set('driven_km')} /></Field>
        <Field label="Frachterlös (€)"><Input type="number" value={f.income} onChange={set('income')} /></Field>
        <Field label="Verbrauch (l)"><Input type="number" value={f.fuel_used} onChange={set('fuel_used')} /></Field>
        <Field label="Frachtschaden (%)"><Input type="number" step="0.1" value={f.damage} onChange={set('damage')} /></Field>
        <Field label="Notiz / Screenshot-Link" className="sm:col-span-2"><Textarea value={f.notes} onChange={set('notes')} placeholder="Manuelle Touren werden von der Disposition geprüft." /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Abbrechen</Button><Button loading={busy} onClick={submit}>Einreichen</Button></div>
    </Modal>
  );
}
