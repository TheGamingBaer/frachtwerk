import { useState } from 'react';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, Fuel, Gift, Receipt, Landmark } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Button, Card, CardHeader, Field, Input, Modal, PageHeader, PageLoader, Select, Tabs, useToast, cx } from '../../components/ui';
import { GroupedBars } from '../../components/charts';
import { can, dateTime, eur, monthName } from '../../lib/format';

const TYPE: Record<string, [string, any, string]> = {
  income: ['Frachterlös', ArrowDownLeft, 'text-emerald-400 bg-emerald-500/10'], payout: ['Lohnauszahlung', Receipt, 'text-cyan-300 bg-cyan-500/10'],
  fuel: ['Kraftstoff', Fuel, 'text-amber-300 bg-amber-500/10'], expense: ['Ausgabe', ArrowUpRight, 'text-rose-300 bg-rose-500/10'],
  deposit: ['Einzahlung', Landmark, 'text-emerald-300 bg-emerald-500/10'], bonus: ['Prämie', Gift, 'text-violet-300 bg-violet-500/10'],
};

export default function Finance() {
  const { me } = useAuth();
  const toast = useToast();
  const { data, reload } = useApi('/company/transactions');
  const { data: c } = useApi('/company');
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: 'expense', amount: '', description: '', user_id: '' });
  if (!data) return <PageLoader />;

  const book = async () => {
    try { await api('/company/transactions', { body: f }); toast('Gebucht'); setOpen(false); setF({ type: 'expense', amount: '', description: '', user_id: '' }); reload(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const inflow = data.byType.filter((t: any) => t.total > 0).reduce((s: number, t: any) => s + t.total, 0);
  const outflow = -data.byType.filter((t: any) => t.total < 0).reduce((s: number, t: any) => s + t.total, 0);
  const rows = filter ? data.rows.filter((r: any) => r.type === filter) : data.rows;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Firmenkonto" title="Finanzen" subtitle="Alle Buchungen eurer Spedition."
        actions={can(me?.member?.role, 'admin') && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Buchung</Button>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card glow className="p-6 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm text-zinc-400"><Wallet className="h-4 w-4 text-amber-400" />Kontostand</div>
          <div className={cx('mt-3 font-display text-4xl font-bold tracking-tight', data.balance >= 0 ? 'text-white' : 'text-rose-300')}>{eur(data.balance, 2)}</div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-500/[0.07] p-3"><div className="label">Eingang · Monat</div><div className="mt-1 font-mono text-emerald-300">{eur(inflow)}</div></div>
            <div className="rounded-xl bg-rose-500/[0.07] p-3"><div className="label">Ausgang · Monat</div><div className="mt-1 font-mono text-rose-300">{eur(outflow)}</div></div>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Cashflow" subtitle="Letzte 6 Monate" />
          <div className="px-3 pb-4"><GroupedBars height={220} data={data.monthly.map((m: any) => ({ ...m, label: monthName(m.month).split(' ')[0].slice(0, 3) }))} series={[{ key: 'inflow', name: 'Eingang', color: '#34d399' }, { key: 'outflow', name: 'Ausgang', color: '#fb7185' }]} /></div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-display font-semibold text-white">Buchungsjournal</h3>
          <Tabs id="ft" value={filter} onChange={setFilter} tabs={[{ id: '', label: 'Alle' }, ...Object.entries(TYPE).map(([id, [l]]) => ({ id, label: l }))]} />
        </div>
        <div className="mt-3">
          {rows.slice(0, 150).map((t: any) => {
            const [label, Icon, cls] = TYPE[t.type] || [t.type, Wallet, 'bg-white/5 text-zinc-400'];
            return (
              <div key={t.id} className="flex items-center gap-4 border-t border-white/[0.04] px-5 py-3">
                <div className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cls)}><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm text-white">{t.description || label}</div><div className="text-xs text-zinc-500">{label}{t.user_name ? ` · ${t.user_name}` : ''} · {dateTime(t.created_at)}</div></div>
                <span className={cx('font-mono text-sm font-semibold', t.amount >= 0 ? 'text-emerald-300' : 'text-zinc-300')}>{t.amount >= 0 ? '+' : ''}{eur(t.amount, 2)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Neue Buchung">
        <div className="space-y-4">
          <Field label="Art"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="expense">Ausgabe (z. B. Werkstatt, Server)</option><option value="deposit">Einzahlung</option><option value="bonus">Prämie an Fahrer</option></Select></Field>
          {f.type === 'bonus' && <Field label="Fahrer"><Select value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })}><option value="">Bitte wählen</option>{c?.members.map((m: any) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</Select></Field>}
          <Field label="Betrag (€)"><Input type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Beschreibung"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Button className="w-full" onClick={book}>Buchen</Button>
        </div>
      </Modal>
    </div>
  );
}
