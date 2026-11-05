import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Copy, RefreshCw, UserMinus, Check, X, Users2, UserPlus, Pencil, LogOut } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Avatar, Badge, Button, Card, CardHeader, Empty, Field, Input, Modal, PageHeader, PageLoader, Select, Tabs, useToast } from '../../components/ui';
import { ago, can, eur, km, num, ROLE_LABEL } from '../../lib/format';

const ROLE_TONE: Record<string, any> = { owner: 'amber', admin: 'violet', dispatcher: 'cyan', driver: 'zinc' };

export default function Members() {
  const { me, refresh } = useAuth();
  const toast = useToast();
  const { data: c, reload } = useApi('/company');
  const admin = can(c?.myRole, 'admin');
  const { data: apps, reload: reloadApps } = useApi(admin ? '/company/applications' : null, [admin]);
  const [tab, setTab] = useState('team');
  const [edit, setEdit] = useState<any>(null);

  if (!c) return <PageLoader />;
  const pending = (apps || []).filter((a: any) => a.status === 'pending');

  const copy = (t: string) => { navigator.clipboard?.writeText(t); toast('In die Zwischenablage kopiert'); };
  const regen = async () => { await api('/company/invite', { body: {} }); reload(); toast('Neuer Code erstellt'); };
  const decide = async (id: number, action: string) => {
    try { await api(`/company/applications/${id}`, { body: { action } }); toast(action === 'accept' ? 'Fahrer aufgenommen 🎉' : 'Bewerbung abgelehnt'); reloadApps(); reload(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const saveEdit = async () => {
    try { await api(`/company/members/${edit.id}`, { method: 'PATCH', body: { role: edit.role, rank_title: edit.rank_title } }); toast('Gespeichert'); setEdit(null); reload(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const kick = async () => {
    if (!confirm(`${edit.display_name} wirklich aus der Firma entfernen?`)) return;
    try { await api(`/company/members/${edit.id}`, { method: 'DELETE' }); toast('Mitglied entfernt'); setEdit(null); reload(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const transfer = async () => {
    if (!confirm(`Firma wirklich an ${edit.display_name} übertragen? Du wirst Admin.`)) return;
    try { await api('/company/transfer', { body: { user_id: edit.id } }); toast('Firma übertragen'); setEdit(null); reload(); refresh(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const leave = async () => {
    if (!confirm('Firma wirklich verlassen?')) return;
    try { await api('/company/leave', { body: {} }); await refresh(); toast('Du hast die Firma verlassen'); } catch (e: any) { toast(e.message, 'err'); }
  };

  return (
    <div>
      <PageHeader eyebrow={c.name} title="Team" subtitle={`${c.members.length} Mitglieder`}
        actions={c.myRole !== 'owner' && <Button variant="ghost" onClick={leave}><LogOut className="h-4 w-4" /> Firma verlassen</Button>} />

      {admin && (
        <Card glow className="mb-6 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/15"><UserPlus className="h-5 w-5 text-amber-400" /></div>
            <div className="flex-1"><div className="font-medium text-white">Fahrer einladen</div><div className="text-sm text-zinc-400">Mit diesem Code treten Fahrer sofort bei – ideal für euren Discord.</div></div>
            <div className="flex items-center gap-2">
              <code className="rounded-xl border border-amber-500/30 bg-ink-950/60 px-4 py-2 font-mono text-lg tracking-[0.25em] text-amber-300">{c.invite_code}</code>
              <Button variant="outline" size="sm" onClick={() => copy(c.invite_code)}><Copy className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={regen} title="Neuen Code erzeugen"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>
        </Card>
      )}

      {admin && <div className="mb-4"><Tabs id="mt" value={tab} onChange={setTab} tabs={[{ id: 'team', label: 'Mitglieder' }, { id: 'apps', label: 'Bewerbungen', count: pending.length }]} /></div>}

      {tab === 'team' && (
        <Card>
          <div className="hidden grid-cols-[1.6fr_1fr_.8fr_.8fr_.8fr_.6fr] gap-4 border-b border-white/[0.06] px-5 py-3 text-[11px] uppercase tracking-widest text-zinc-500 lg:grid">
            <span>Fahrer</span><span>Rolle</span><span className="text-right">Kilometer</span><span className="text-right">Verdient</span><span className="text-right">Ø Schaden</span><span />
          </div>
          {c.members.map((m: any) => (
            <div key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-white/[0.04] px-5 py-3.5 last:border-0 lg:grid-cols-[1.6fr_1fr_.8fr_.8fr_.8fr_.6fr]">
              <Link to={`/driver/${m.username}`} className="flex min-w-0 items-center gap-3">
                <Avatar name={m.display_name} hue={m.avatar_hue} size={38} />
                <div className="min-w-0"><div className="flex items-center gap-1.5 truncate text-sm font-medium text-white">{m.display_name}{m.role === 'owner' && <Crown className="h-3.5 w-3.5 text-amber-400" />}{m.id === me?.user.id && <span className="text-xs text-zinc-500">(du)</span>}</div><div className="text-xs text-zinc-500">{m.last_job ? `Zuletzt ${ago(m.last_job)}` : 'Noch keine Tour'}</div></div>
              </Link>
              <div className="hidden lg:block"><Badge tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Badge><div className="mt-1 text-xs text-zinc-500">{m.rank_title}</div></div>
              <div className="hidden text-right font-mono text-sm text-zinc-300 lg:block">{km(m.km)}</div>
              <div className="hidden text-right font-mono text-sm text-zinc-300 lg:block">{eur(m.payout)}</div>
              <div className="hidden text-right font-mono text-sm text-zinc-300 lg:block">{num(m.avg_damage, 1)} %</div>
              <div className="flex justify-end">{admin && m.role !== 'owner' && m.id !== me?.user.id ? <Button size="sm" variant="ghost" onClick={() => setEdit({ ...m })}><Pencil className="h-4 w-4" /></Button> : c.myRole === 'owner' && m.id !== me?.user.id ? null : <span className="font-mono text-xs text-zinc-500 lg:hidden">{km(m.km)}</span>}</div>
            </div>
          ))}
        </Card>
      )}

      {tab === 'apps' && (
        <div className="space-y-3">
          {!apps?.length && <Card><Empty icon={Users2} title="Keine Bewerbungen" text="Teile euren Einladungscode oder stellt die Aufnahme im Verzeichnis auf „Bewerbung“." /></Card>}
          {apps?.map((a: any) => (
            <Card key={a.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Avatar name={a.display_name} hue={a.avatar_hue} size={46} />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2"><Link to={`/driver/${a.username}`} className="font-medium text-white hover:text-amber-300">{a.display_name}</Link><span className="text-xs text-zinc-500">{ago(a.created_at)}</span>
                    {a.status !== 'pending' && <Badge tone={a.status === 'accepted' ? 'emerald' : 'rose'}>{a.status === 'accepted' ? 'Angenommen' : 'Abgelehnt'}</Badge>}</div>
                  <div className="mt-1 text-xs text-zinc-500">{km(a.km)} · {a.jobs} Lieferungen</div>
                  {a.message && <p className="mt-3 rounded-xl bg-white/[0.03] p-3 text-sm text-zinc-300">„{a.message}"</p>}
                </div>
                {a.status === 'pending' && <div className="flex gap-2"><Button size="sm" onClick={() => decide(a.id, 'accept')}><Check className="h-4 w-4" /> Aufnehmen</Button><Button size="sm" variant="danger" onClick={() => decide(a.id, 'reject')}><X className="h-4 w-4" /></Button></div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `${edit.display_name} bearbeiten` : ''}>
        {edit && (
          <div className="space-y-4">
            <Field label="Rolle" hint="Disponenten prüfen Touren & planen Events. Admins verwalten Firma, Finanzen und Abrechnung.">
              <Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                <option value="driver">Fahrer</option><option value="dispatcher">Disponent</option>{c.myRole === 'owner' && <option value="admin">Admin</option>}
              </Select>
            </Field>
            <Field label="Rangbezeichnung"><Input value={edit.rank_title} onChange={(e) => setEdit({ ...edit, rank_title: e.target.value })} placeholder="z. B. Senior-Fernfahrer" /></Field>
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <div className="flex gap-2">
                <Button variant="danger" size="sm" onClick={kick}><UserMinus className="h-4 w-4" /> Entfernen</Button>
                {c.myRole === 'owner' && <Button variant="ghost" size="sm" onClick={transfer}><Crown className="h-4 w-4" /> Firma übertragen</Button>}
              </div>
              <Button onClick={saveEdit}>Speichern</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
