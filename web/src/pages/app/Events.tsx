import { useState } from 'react';
import { CalendarDays, Plus, MapPin, Server, Users2, Trash2, Check } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Textarea, useToast, Badge, cx } from '../../components/ui';
import { ago, can, parseDate } from '../../lib/format';

export default function Events() {
  const { me } = useAuth();
  const toast = useToast();
  const { data, reload } = useApi<any[]>('/company/events');
  const staff = can(me?.member?.role, 'dispatcher');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', description: '', start_at: '', origin: '', destination: '', server: 'TruckersMP Simulation 1' });

  const create = async () => {
    try {
      // lokale Zeit -> UTC für die Datenbank
      const utc = new Date(f.start_at).toISOString().slice(0, 16).replace('T', ' ');
      await api('/company/events', { body: { ...f, start_at: utc } }); toast('Event erstellt'); setOpen(false); reload();
    } catch (e: any) { toast(e.message, 'err'); }
  };
  const attend = async (id: number) => { await api(`/company/events/${id}/attend`, { body: {} }); reload(); };
  const del = async (id: number) => { if (confirm('Event löschen?')) { await api(`/company/events/${id}`, { method: 'DELETE' }); reload(); } };

  return (
    <div>
      <PageHeader eyebrow="Gemeinsam fahren" title="Konvois & Events" subtitle="Plant gemeinsame Fahrten und sammelt Zusagen."
        actions={staff && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Event planen</Button>} />
      {data && !data.length && <Card><Empty icon={CalendarDays} title="Noch keine Events" text="Konvois sind der beste Weg, eine Community zusammenzuschweißen." /></Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        {data?.map((e) => {
          const d = parseDate(e.start_at)!;
          const past = d.getTime() < Date.now() - 3 * 3600_000;
          return (
            <Card key={e.id} className={cx('flex gap-5 p-5', past && 'opacity-50')}>
              <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/15 to-transparent py-3">
                <span className="text-[11px] uppercase tracking-widest text-amber-300">{d.toLocaleDateString('de-DE', { month: 'short' })}</span>
                <span className="font-display text-3xl font-bold leading-none text-white">{d.getDate()}</span>
                <span className="mt-1 font-mono text-[11px] text-zinc-400">{d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold text-white">{e.title}</h3>
                  {!past && <Badge tone="amber">{ago(e.start_at)}</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                  {e.origin && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-amber-400" />{e.origin} → {e.destination}</span>}
                  <span className="flex items-center gap-1"><Server className="h-3.5 w-3.5" />{e.server}</span>
                  <span className="flex items-center gap-1"><Users2 className="h-3.5 w-3.5" />{e.attendees} Zusagen</span>
                </div>
                {e.description && <p className="mt-3 text-sm text-zinc-400">{e.description}</p>}
                <div className="mt-4 flex items-center gap-2">
                  {!past && <Button size="sm" variant={e.attending ? 'subtle' : 'primary'} onClick={() => attend(e.id)}>{e.attending ? <><Check className="h-4 w-4" /> Du bist dabei</> : 'Ich bin dabei'}</Button>}
                  {staff && <Button size="sm" variant="ghost" onClick={() => del(e.id)}><Trash2 className="h-4 w-4" /></Button>}
                  <span className="ml-auto text-xs text-zinc-600">von {e.author}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Neues Event">
        <div className="space-y-4">
          <Field label="Titel"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Freitagskonvoi" /></Field>
          <Field label="Start"><Input type="datetime-local" value={f.start_at} onChange={(e) => setF({ ...f, start_at: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Von"><Input value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })} /></Field>
            <Field label="Nach"><Input value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} /></Field>
          </div>
          <Field label="Server"><Input value={f.server} onChange={(e) => setF({ ...f, server: e.target.value })} /></Field>
          <Field label="Beschreibung"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Button className="w-full" onClick={create} disabled={!f.title || !f.start_at}>Event erstellen</Button>
        </div>
      </Modal>
    </div>
  );
}
