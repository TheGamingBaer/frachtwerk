import { useEffect, useMemo, useState } from 'react';
import { Calculator, Save, Palette, Coins, Trash2 } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Button, Card, CardHeader, CompanyBadge, Field, Input, Modal, PageHeader, PageLoader, Select, Textarea, Toggle, useToast, cx } from '../../components/ui';
import { eur, num } from '../../lib/format';
import { useNavigate } from 'react-router-dom';

const HUES = [28, 0, 340, 280, 230, 200, 170, 140, 90, 50];

/** gleiche Formel wie im Backend (logic.js) – für die Live-Vorschau */
function preview(c: any, j: any) {
  const lines: [string, number][] = [];
  const kmPay = j.km * c.rate_per_km, share = j.income * (c.revenue_share / 100), base = kmPay + share;
  lines.push(['Kilometergeld', kmPay], ['Frachtanteil', share]);
  let ded = 0, bonus = 0;
  if (j.damage > 0) { ded += j.damage * c.damage_penalty; lines.push(['Schadensabzug', -j.damage * c.damage_penalty]); }
  else if (c.clean_bonus > 0) { bonus = base * (c.clean_bonus / 100); lines.push(['Schadenfrei-Bonus', bonus]); }
  if (!c.company_pays_fuel) { ded += j.fuel * c.fuel_price; lines.push(['Kraftstoff', -j.fuel * c.fuel_price]); }
  if (c.max_speed_limit > 0 && j.speed > c.max_speed_limit) { ded += c.speeding_penalty; lines.push(['Tempoverstoß', -c.speeding_penalty]); }
  return { lines, total: Math.max(0, base + bonus - ded) };
}

export default function CompanySettings() {
  const { refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { data, reload } = useApi('/company');
  const [c, setC] = useState<any>(null);
  const [sample, setSample] = useState({ km: 850, income: 42000, damage: 0, fuel: 280, speed: 90 });
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  useEffect(() => { if (data) setC({ ...data }); }, [data]);
  const pv = useMemo(() => (c ? preview(numify(c), sample) : null), [c, sample]);
  if (!c) return <PageLoader />;

  const set = (k: string) => (e: any) => setC({ ...c, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try { await api('/company', { method: 'PATCH', body: numify(c) }); toast('Einstellungen gespeichert'); reload(); refresh(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const dissolve = async () => {
    try { await api('/company', { method: 'DELETE', body: { confirm: confirmName } }); await refresh(); toast('Firma aufgelöst'); nav('/app'); } catch (e: any) { toast(e.message, 'err'); }
  };

  return (
    <div>
      <PageHeader eyebrow={c.name} title="Einstellungen" subtitle="Profil, Aufnahme und eure Lohnformel."
        actions={<Button onClick={save} loading={busy}><Save className="h-4 w-4" /> Speichern</Button>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Profil" icon={Palette} />
            <div className="space-y-4 px-5 pb-5">
              <div className="flex items-center gap-4">
                <CompanyBadge tag={c.tag} hue={c.hue} size={56} />
                <div className="flex flex-wrap gap-2">{HUES.map((h) => <button key={h} onClick={() => setC({ ...c, hue: h })} className={cx('h-8 w-8 rounded-lg transition', c.hue === h ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-900' : 'opacity-60 hover:opacity-100')} style={{ background: `hsl(${h} 85% 50%)` }} />)}</div>
              </div>
              <Field label="Beschreibung"><Textarea value={c.description} onChange={set('description')} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Spiel"><Select value={c.games} onChange={set('games')}><option value="ets2">ETS2</option><option value="ats">ATS</option><option value="both">Beide</option></Select></Field>
                <Field label="Aufnahme"><Select value={c.join_mode} onChange={set('join_mode')}><option value="open">Offen</option><option value="apply">Bewerbung</option><option value="invite">Nur Einladung</option></Select></Field>
                <Field label="Discord-Link"><Input value={c.discord} onChange={set('discord')} placeholder="https://discord.gg/…" /></Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Lohnformel" subtitle="Gilt für alle neuen Touren" icon={Coins} />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <Field label="Kilometergeld (€/km)"><Input type="number" step="0.01" value={c.rate_per_km} onChange={set('rate_per_km')} /></Field>
              <Field label="Frachtanteil für Fahrer (%)"><Input type="number" step="0.5" value={c.revenue_share} onChange={set('revenue_share')} /></Field>
              <Field label="Schadenfrei-Bonus (%)" hint="Aufschlag bei 0 % Frachtschaden"><Input type="number" value={c.clean_bonus} onChange={set('clean_bonus')} /></Field>
              <Field label="Abzug je % Schaden (€)"><Input type="number" value={c.damage_penalty} onChange={set('damage_penalty')} /></Field>
              <Field label="Tempolimit (km/h, 0 = aus)"><Input type="number" value={c.max_speed_limit} onChange={set('max_speed_limit')} /></Field>
              <Field label="Strafe bei Überschreitung (€)"><Input type="number" value={c.speeding_penalty} onChange={set('speeding_penalty')} /></Field>
              <Field label="Kraftstoffpreis (€/l)"><Input type="number" step="0.01" value={c.fuel_price} onChange={set('fuel_price')} /></Field>
              <Field label="Mindeststrecke Auto-Freigabe (km)"><Input type="number" value={c.min_distance} onChange={set('min_distance')} /></Field>
              <div className="space-y-2 sm:col-span-2">
                <Toggle checked={!!c.company_pays_fuel} onChange={(v) => setC({ ...c, company_pays_fuel: v ? 1 : 0 })} label="Firma zahlt den Kraftstoff" desc="Sonst wird der Verbrauch vom Fahrerlohn abgezogen." />
                <Toggle checked={!!c.auto_approve} onChange={(v) => setC({ ...c, auto_approve: v ? 1 : 0 })} label="Client-Touren automatisch freigeben" desc="Manuell eingereichte Touren werden immer von der Disposition geprüft." />
              </div>
            </div>
          </Card>

          {c.myRole === 'owner' && (
            <Card className="border-rose-500/20">
              <CardHeader title="Gefahrenzone" icon={Trash2} />
              <div className="flex items-center justify-between gap-4 px-5 pb-5"><p className="text-sm text-zinc-400">Firma mit allen Daten unwiderruflich löschen.</p><Button variant="danger" onClick={() => setDel(true)}>Firma auflösen</Button></div>
            </Card>
          )}
        </div>

        <div className="xl:sticky xl:top-8 xl:self-start">
          <Card glow>
            <CardHeader title="Lohnrechner" subtitle="Live-Vorschau mit deinen Werten" icon={Calculator} />
            <div className="px-5 pb-5">
              <div className="grid grid-cols-2 gap-3">
                {[['km', 'Strecke (km)'], ['income', 'Frachterlös (€)'], ['damage', 'Schaden (%)'], ['fuel', 'Verbrauch (l)'], ['speed', 'Max. Tempo']].map(([k, l]) => (
                  <Field key={k} label={l}><Input type="number" value={(sample as any)[k]} onChange={(e) => setSample({ ...sample, [k]: Number(e.target.value) })} /></Field>
                ))}
              </div>
              <div className="mt-5 space-y-2 rounded-2xl border border-white/[0.06] bg-ink-950/50 p-4 font-mono text-sm">
                {pv!.lines.map(([l, v]) => <div key={l} className="flex justify-between"><span className="font-sans text-zinc-400">{l}</span><span className={v < 0 ? 'text-rose-300' : l.includes('Bonus') ? 'text-emerald-300' : 'text-zinc-200'}>{eur(v, 2)}</span></div>)}
                <div className="mt-2 flex items-end justify-between border-t border-white/10 pt-3"><span className="font-sans text-zinc-400">Fahrerlohn</span><span className="font-display text-2xl font-bold text-gradient">{eur(pv!.total, 2)}</span></div>
              </div>
              <p className="mt-3 text-xs text-zinc-500">Firma behält: <span className="font-mono text-zinc-300">{eur(sample.income - (c.company_pays_fuel ? sample.fuel * Number(c.fuel_price) : 0), 0)}</span> Erlös (abzgl. Kraftstoff) · Marge {num(sample.income ? (1 - pv!.total / sample.income) * 100 : 0, 0)} %</p>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={del} onClose={() => setDel(false)} title="Firma auflösen">
        <p className="text-sm text-zinc-400">Gib zur Bestätigung den Firmennamen <b className="text-white">{c.name}</b> ein. Alle Mitglieder werden freigestellt, Finanzen und Abrechnungen gelöscht.</p>
        <Input className="mt-4" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
        <Button variant="danger" className="mt-4 w-full" disabled={confirmName !== c.name} onClick={dissolve}>Endgültig auflösen</Button>
      </Modal>
    </div>
  );
}

function numify(c: any) {
  const out = { ...c };
  for (const k of ['rate_per_km', 'revenue_share', 'fuel_price', 'damage_penalty', 'clean_bonus', 'max_speed_limit', 'speeding_penalty', 'min_distance', 'hue']) out[k] = Number(c[k]) || 0;
  return out;
}
