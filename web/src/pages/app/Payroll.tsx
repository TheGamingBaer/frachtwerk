import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Receipt, FileDown, Printer, CheckCircle2, AlertTriangle, ArrowLeft, Lock } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Avatar, Button, Card, CardHeader, CompanyBadge, Empty, Modal, PageHeader, Select, Skeleton, useToast, Badge } from '../../components/ui';
import { can, date, eur, km, monthName, num } from '../../lib/format';

function lastMonths(n = 12) {
  const out: string[] = []; const d = new Date();
  for (let i = 0; i < n; i++) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() - 1); }
  return out;
}

function csv(rows: any[], period: string) {
  const head = ['Fahrer', 'Touren', 'Kilometer', 'Frachterlös', 'Grundlohn', 'Bonus', 'Abzüge', 'Auszahlung'];
  const lines = rows.map((r) => [r.display_name, r.jobs, r.km, r.income, r.gross, r.bonus, r.deductions, r.net].map((v) => `"${String(v).replace('.', ',')}"`).join(';'));
  const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `abrechnung-${period}.csv`; a.click();
}

export default function Payroll() {
  const { me } = useAuth();
  const toast = useToast();
  const admin = can(me?.member?.role, 'admin');
  const [period, setPeriod] = useState(lastMonths()[0]);
  const { data: pv, reload, loading } = useApi(`/company/payroll/preview?period=${period}`, [period]);
  const { data: hist, reload: reloadHist } = useApi<any[]>('/company/payrolls');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try { await api('/company/payroll', { body: { period } }); toast(`Lohnlauf ${monthName(period)} abgeschlossen 💸`); setConfirmOpen(false); reload(); reloadHist(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Lohnbuchhaltung" title="Abrechnung" subtitle="Freigegebene Touren eines Monats prüfen und mit einem Klick auszahlen."
        actions={<Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-52">{lastMonths().map((p) => <option key={p} value={p}>{monthName(p)}</option>)}</Select>} />

      {pv?.pendingReview > 0 && (
        <Card className="flex items-center gap-3 border-amber-500/25 bg-amber-500/[0.05] p-4 text-sm text-amber-100">
          <AlertTriangle className="h-5 w-5 text-amber-400" />{pv.pendingReview} Touren aus diesem Monat sind noch nicht geprüft und werden nicht abgerechnet.
          <Link to="/app/jobs" className="ml-auto text-amber-300 underline-offset-2 hover:underline">Prüfen</Link>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><div className="label">Auszuzahlen</div><div className="mt-2 font-display text-3xl font-semibold text-gradient">{eur(pv?.total || 0, 2)}</div></Card>
        <Card className="p-5"><div className="label">Fahrer</div><div className="mt-2 font-display text-3xl font-semibold text-white">{pv?.rows.length || 0}</div></Card>
        <Card className="p-5"><div className="label">Offene Touren</div><div className="mt-2 font-display text-3xl font-semibold text-white">{pv?.jobs || 0}</div></Card>
      </div>

      <Card>
        <CardHeader title={`Vorschau ${monthName(period)}`} subtitle="Nur freigegebene, noch nicht abgerechnete Touren" icon={Receipt}
          action={pv?.rows.length > 0 && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => csv(pv.rows, period)}><FileDown className="h-4 w-4" /> CSV</Button>{admin && <Button size="sm" onClick={() => setConfirmOpen(true)}><Lock className="h-4 w-4" /> Lohnlauf abschließen</Button>}</div>} />
        {loading && !pv ? <div className="p-5"><Skeleton className="h-40" /></div> : pv?.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-y border-white/[0.06] text-left text-[11px] uppercase tracking-widest text-zinc-500">
                <th className="px-5 py-3 font-medium">Fahrer</th><th className="px-3 py-3 text-right font-medium">Touren</th><th className="px-3 py-3 text-right font-medium">km</th><th className="px-3 py-3 text-right font-medium">Grundlohn</th><th className="px-3 py-3 text-right font-medium">Bonus</th><th className="px-3 py-3 text-right font-medium">Abzüge</th><th className="px-5 py-3 text-right font-medium">Auszahlung</th>
              </tr></thead>
              <tbody>
                {pv.rows.map((r: any) => (
                  <tr key={r.user_id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={r.display_name} hue={r.avatar_hue} size={30} /><span className="font-medium text-white">{r.display_name}</span></div></td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-300">{r.jobs}</td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-300">{num(r.km)}</td>
                    <td className="px-3 py-3 text-right font-mono text-zinc-300">{eur(r.gross, 2)}</td>
                    <td className="px-3 py-3 text-right font-mono text-emerald-300">+{eur(r.bonus, 2)}</td>
                    <td className="px-3 py-3 text-right font-mono text-rose-300">−{eur(r.deductions, 2)}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-white">{eur(r.net, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={CheckCircle2} title="Alles abgerechnet" text={`Für ${monthName(period)} gibt es keine offenen, freigegebenen Touren.`} />}
      </Card>

      <Card>
        <CardHeader title="Abgeschlossene Lohnläufe" icon={Lock} />
        {hist?.length ? (
          <div className="px-2 pb-2">
            {hist.map((p) => (
              <Link key={p.id} to={`/app/payslip/${p.id}`} className="flex items-center gap-4 rounded-xl px-3 py-3 hover:bg-white/[0.03]">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10"><CheckCircle2 className="h-5 w-5 text-emerald-400" /></div>
                <div className="flex-1"><div className="font-medium text-white">{monthName(p.period)}</div><div className="text-xs text-zinc-500">{p.drivers} Fahrer · {p.jobs} Touren · {date(p.created_at)} von {p.created_by_name}</div></div>
                <span className="font-mono font-semibold text-white">{eur(p.total, 2)}</span>
              </Link>
            ))}
          </div>
        ) : <p className="px-5 pb-5 text-sm text-zinc-500">Noch keine Lohnläufe.</p>}
      </Card>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Lohnlauf abschließen?">
        <p className="text-sm text-zinc-400">Es werden <b className="text-white">{eur(pv?.total || 0, 2)}</b> an <b className="text-white">{pv?.rows.length} Fahrer</b> für {monthName(period)} ausgezahlt und vom Firmenkonto abgebucht. Die {pv?.jobs} Touren werden als abgerechnet markiert. Das kann nicht rückgängig gemacht werden.</p>
        <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Abbrechen</Button><Button loading={busy} onClick={run}>Jetzt auszahlen</Button></div>
      </Modal>
    </div>
  );
}

/** Druckbarer Lohnzettel / Lohnlauf-Beleg */
export function PayslipView() {
  const { id } = useParams();
  const { data: p, error } = useApi(`/payrolls/${id}`, [id]);
  if (error) return <Card><Empty icon={Receipt} title="Nicht verfügbar" text={error} /></Card>;
  if (!p) return <Skeleton className="h-96" />;
  const single = p.items.length === 1;
  const jobsBy = (uid: number) => p.jobs.filter((j: any) => j.user_id === uid);
  return (
    <div>
      <div className="no-print mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => history.back()}><ArrowLeft className="h-4 w-4" /> Zurück</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Drucken / PDF</Button>
      </div>
      <Card className="print-area mx-auto max-w-4xl p-6 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4"><CompanyBadge tag={p.company_tag} hue={p.company_hue} size={56} /><div><div className="font-display text-2xl font-bold text-white">{p.company_name}</div><div className="text-sm text-zinc-400">{single ? 'Lohnzettel' : 'Lohnlauf'} · {monthName(p.period)}</div></div></div>
          <div className="text-right text-sm text-zinc-400"><div>Beleg-Nr. <span className="font-mono text-white">LL-{String(p.id).padStart(5, '0')}</span></div><div>erstellt am {date(p.created_at)}</div><Badge tone="emerald" className="mt-2">Ausgezahlt</Badge></div>
        </div>
        {p.items.map((it: any) => (
          <div key={it.id} className="border-b border-white/10 py-6 last:border-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3"><Avatar name={it.display_name} hue={it.avatar_hue} size={38} /><div><div className="font-semibold text-white">{it.display_name}</div><div className="text-xs text-zinc-500">{it.jobs} Touren · {km(it.km)}</div></div></div>
              <div className="text-right"><div className="label">Auszahlung</div><div className="font-display text-2xl font-bold text-white">{eur(it.net, 2)}</div></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-sm sm:grid-cols-4">
              {[['Frachterlös', eur(it.income, 2)], ['Grundlohn', eur(it.gross, 2)], ['Bonus', `+${eur(it.bonus, 2)}`], ['Abzüge', `−${eur(it.deductions, 2)}`]].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-white/[0.06] p-2.5"><div className="font-sans text-[10px] uppercase tracking-widest text-zinc-500">{l}</div><div className="mt-0.5 text-zinc-200">{v}</div></div>
              ))}
            </div>
            {single && (
              <table className="mt-5 w-full text-xs">
                <thead><tr className="text-left text-zinc-500"><th className="py-2 font-medium">Datum</th><th className="py-2 font-medium">Route</th><th className="py-2 font-medium">Fracht</th><th className="py-2 text-right font-medium">km</th><th className="py-2 text-right font-medium">Schaden</th><th className="py-2 text-right font-medium">Lohn</th></tr></thead>
                <tbody>{jobsBy(it.user_id).map((j: any) => (
                  <tr key={j.id} className="border-t border-white/[0.05] text-zinc-300"><td className="py-2">{date(j.finished_at)}</td><td className="py-2">{j.origin_city} → {j.dest_city}</td><td className="py-2">{j.cargo}</td><td className="py-2 text-right font-mono">{num(j.driven_km)}</td><td className="py-2 text-right font-mono">{num(j.damage, 1)} %</td><td className="py-2 text-right font-mono">{eur(j.payout, 2)}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        ))}
        {!single && <div className="mt-4 flex justify-end gap-6 border-t border-white/10 pt-6"><span className="text-zinc-400">Gesamt</span><span className="font-display text-3xl font-bold text-gradient">{eur(p.total, 2)}</span></div>}
      </Card>
    </div>
  );
}
