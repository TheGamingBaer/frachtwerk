import { useState } from 'react';
import { Truck, Plus, Trash2 } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Select, useToast, Badge } from '../../components/ui';
import { can, eur, km } from '../../lib/format';

const BRANDS = ['Scania', 'Volvo', 'MAN', 'DAF', 'Mercedes-Benz', 'Renault', 'Iveco', 'Kenworth', 'Peterbilt', 'Freightliner', 'Western Star', 'Mack', 'International'];

export default function Fleet() {
  const { me } = useAuth();
  const toast = useToast();
  const role = me?.member?.role;
  const { data, reload } = useApi<any[]>('/company/trucks');
  const { data: c } = useApi('/company');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ brand: 'Scania', model: '', plate: '', assigned_user: '', value: '165000', odometer: '0' });

  const buy = async () => {
    try { await api('/company/trucks', { body: f }); toast('Fahrzeug hinzugefügt'); setOpen(false); reload(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const assign = async (id: number, uid: string) => { await api(`/company/trucks/${id}`, { method: 'PATCH', body: { assigned_user: uid } }); reload(); };
  const del = async (id: number) => { if (confirm('Fahrzeug aus dem Fuhrpark entfernen?')) { await api(`/company/trucks/${id}`, { method: 'DELETE' }); reload(); } };

  return (
    <div>
      <PageHeader eyebrow="Fuhrpark" title="Fahrzeuge" subtitle="Kilometerstände laufen automatisch mit, wenn der zugewiesene Fahrer Touren abschließt."
        actions={can(role, 'admin') && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Fahrzeug kaufen</Button>} />
      {data && !data.length && <Card><Empty icon={Truck} title="Fuhrpark ist leer" text="Kaufe den ersten LKW vom Firmenkonto und weise ihn einem Fahrer zu." /></Card>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.map((t) => (
          <Card key={t.id} className="group p-5">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-500/10 blur-2xl" />
            <div className="relative flex items-start justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-transparent ring-1 ring-white/10"><Truck className="h-6 w-6 text-amber-300" /></div>
              <div className="rounded-md border-2 border-zinc-300/80 bg-zinc-100 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-ink-950">{t.plate || '—'}</div>
            </div>
            <div className="relative mt-4"><div className="font-display text-xl font-semibold text-white">{t.brand}</div><div className="text-sm text-zinc-400">{t.model}</div></div>
            <div className="relative mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><div className="label">Kilometerstand</div><div className="mt-0.5 font-mono text-white">{km(t.odometer)}</div></div>
              <div><div className="label">Wert</div><div className="mt-0.5 font-mono text-white">{eur(t.value)}</div></div>
            </div>
            <div className="relative mt-4 flex items-center gap-2">
              {can(role, 'dispatcher') ? (
                <Select value={t.assigned_user || ''} onChange={(e) => assign(t.id, e.target.value)} className="h-9 py-1.5 text-xs">
                  <option value="">Nicht zugewiesen</option>
                  {c?.members.map((m: any) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                </Select>
              ) : <Badge tone={t.driver ? 'emerald' : 'zinc'}>{t.driver || 'Nicht zugewiesen'}</Badge>}
              {can(role, 'admin') && <Button size="sm" variant="ghost" onClick={() => del(t.id)}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Fahrzeug kaufen">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Marke"><Select value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })}>{BRANDS.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Modell"><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="S 730 V8" /></Field>
          <Field label="Kennzeichen"><Input value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} placeholder="NLX-005" /></Field>
          <Field label="Fahrer"><Select value={f.assigned_user} onChange={(e) => setF({ ...f, assigned_user: e.target.value })}><option value="">–</option>{c?.members.map((m: any) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</Select></Field>
          <Field label="Kaufpreis (€)" hint={c && `Kontostand: ${eur(c.balance)}`}><Input type="number" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
          <Field label="Kilometerstand"><Input type="number" value={f.odometer} onChange={(e) => setF({ ...f, odometer: e.target.value })} /></Field>
        </div>
        <Button className="mt-6 w-full" onClick={buy}>Kaufen</Button>
      </Modal>
    </div>
  );
}
