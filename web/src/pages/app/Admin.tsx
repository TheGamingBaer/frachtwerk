import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SiteEditor } from '../../components/SiteEditor';
import { ShieldAlert, Users2, Building2, Package, Radio, HardDriveDownload, Search, Ban, Crown, KeyRound, Trash2, Copy, Mail, CheckCircle2, XCircle } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { api, tokenStore } from '../../lib/api';
import { Avatar, Badge, Button, Card, CardHeader, CompanyBadge, Empty, Input, Modal, PageHeader, PageLoader, Stat, Tabs, useToast, cx } from '../../components/ui';
import { ago, eur, num } from '../../lib/format';

export default function Admin() {
  const { me } = useAuth();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [tab, setTab] = useState(sp.get('tab') || 'users');
  const [q, setQ] = useState('');
  const { data: o, reload: reloadO } = useApi('/admin/overview');
  const { data: users, reload: reloadU } = useApi<any[]>(tab === 'users' ? `/admin/users?q=${encodeURIComponent(q)}` : null, [tab, q]);
  const { data: companies, reload: reloadC } = useApi<any[]>(tab === 'companies' ? '/admin/companies' : null, [tab]);
  const [link, setLink] = useState<{ name: string; link: string } | null>(null);

  if (!me?.user.is_admin) return <Card><Empty icon={ShieldAlert} title="Kein Zugriff" text="Dieser Bereich ist nur für Plattform-Admins." /></Card>;
  if (!o) return <PageLoader />;

  const patch = async (u: any, body: any, msg: string) => { try { await api(`/admin/users/${u.id}`, { method: 'PATCH', body }); toast(msg); reloadU(); reloadO(); } catch (e: any) { toast(e.message, 'err'); } };
  const resetLink = async (u: any) => { try { const r = await api(`/admin/users/${u.id}/reset-link`, { body: {} }); setLink({ name: u.display_name, link: r.link }); } catch (e: any) { toast(e.message, 'err'); } };
  const delCompany = async (c: any) => {
    if (prompt(`Firma „${c.name}“ mit allen Daten löschen? Zur Bestätigung den Namen eingeben:`) !== c.name) return;
    await api(`/admin/companies/${c.id}`, { method: 'DELETE' }); toast('Firma gelöscht'); reloadC(); reloadO();
  };
  const backupNow = async () => { try { const r = await api('/admin/backups', { body: {} }); toast(`Backup erstellt: ${r.name}`); reloadO(); } catch (e: any) { toast(e.message, 'err'); } };
  const download = async (name: string) => {
    const r = await fetch(`/api/admin/backups/${name}`, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
    if (!r.ok) return toast('Download fehlgeschlagen', 'err');
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = name; a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Plattform" title="Admin" subtitle="Benutzer, Speditionen und Backups der gesamten Instanz." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Benutzer" value={o.users} icon={Users2} hint={`+${o.users_week} diese Woche`} />
        <Stat label="Speditionen" value={o.companies} icon={Building2} accent="cyan" />
        <Stat label="Lieferungen" value={o.jobs} icon={Package} accent="violet" hint={`${o.jobs_week} in 7 Tagen`} />
        <Stat label="Gerade live" value={o.live} icon={Radio} accent="emerald" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[[o.mail, 'E-Mail-Versand', o.mail ? 'Passwort-Links werden per Mail verschickt' : 'Nicht eingerichtet – Reset-Links hier im Admin erstellen (SMTP_* in der README)'],
          [o.discord, 'Discord-Login', o.discord ? 'Aktiv' : 'Nicht eingerichtet – DISCORD_CLIENT_ID/SECRET setzen']].map(([ok, t, d]: any) => (
          <Card key={t} className="flex items-center gap-3 p-4">
            {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <XCircle className="h-5 w-5 shrink-0 text-zinc-500" />}
            <div><div className="text-sm font-medium text-white">{t}</div><div className="text-xs text-zinc-500">{d}</div></div>
          </Card>
        ))}
      </div>

      <Tabs id="adm" value={tab} onChange={setTab} tabs={[{ id: 'site', label: 'Website' }, { id: 'users', label: 'Benutzer' }, { id: 'companies', label: 'Speditionen' }, { id: 'backups', label: 'Backups' }]} />

      {tab === 'site' && <SiteEditor />}

      {tab === 'users' && (
        <Card>
          <div className="p-4"><div className="relative max-w-sm"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Benutzername, E-Mail…" className="pl-10" /></div></div>
          {users?.map((u) => (
            <div key={u.id} className={cx('flex flex-col gap-3 border-t border-white/[0.05] px-5 py-3.5 sm:flex-row sm:items-center', u.banned && 'bg-rose-500/[0.04]')}>
              <Link to={`/driver/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={u.display_name} hue={u.avatar_hue} src={u.avatar_url} size={36} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-white">{u.display_name}
                    {!!u.is_admin && <Badge tone="amber"><Crown className="h-3 w-3" />Admin</Badge>}{!!u.banned && <Badge tone="rose">Gesperrt</Badge>}{u.discord_name && <Badge tone="violet">Discord</Badge>}</div>
                  <div className="truncate text-xs text-zinc-500">@{u.username} · {u.email.endsWith('@discord.invalid') ? 'keine E-Mail' : u.email} · {u.company_tag ? `${u.company_tag} · ` : ''}{u.jobs} Touren · seit {ago(u.created_at)}</div>
                </div>
              </Link>
              {u.id !== me.user.id && (
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => resetLink(u)}><KeyRound className="h-3.5 w-3.5" />Reset-Link</Button>
                  <Button size="sm" variant="ghost" onClick={() => patch(u, { is_admin: !u.is_admin }, u.is_admin ? 'Admin-Rechte entzogen' : 'Zum Admin ernannt')}><Crown className="h-3.5 w-3.5" />{u.is_admin ? 'Kein Admin' : 'Admin'}</Button>
                  <Button size="sm" variant={u.banned ? 'subtle' : 'danger'} onClick={() => patch(u, { banned: !u.banned }, u.banned ? 'Entsperrt' : 'Gesperrt')}><Ban className="h-3.5 w-3.5" />{u.banned ? 'Entsperren' : 'Sperren'}</Button>
                </div>
              )}
            </div>
          ))}
          {users && !users.length && <Empty icon={Users2} title="Niemand gefunden" />}
        </Card>
      )}

      {tab === 'companies' && (
        <Card>
          {companies?.map((c) => (
            <div key={c.id} className="flex items-center gap-4 border-t border-white/[0.05] px-5 py-3.5 first:border-0">
              <CompanyBadge tag={c.tag} hue={c.hue} size={38} />
              <Link to={`/c/${c.slug}`} className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-white">{c.name}</div><div className="text-xs text-zinc-500">Inhaber {c.owner || '–'} · {c.members} Mitglieder · {num(c.jobs)} Touren · {eur(c.balance)}</div></Link>
              <Button size="sm" variant="danger" onClick={() => delCompany(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </Card>
      )}

      {tab === 'backups' && (
        <Card>
          <CardHeader title="Datenbank-Backups" subtitle={`Automatisch täglich · Ordner: ${o.backup_dir}`} icon={HardDriveDownload} action={<Button size="sm" onClick={backupNow}>Jetzt sichern</Button>} />
          <div className="px-2 pb-2">
            {o.backups.map((b: any) => (
              <div key={b.name} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.03]">
                <HardDriveDownload className="h-4 w-4 text-zinc-500" />
                <span className="flex-1 font-mono text-sm text-zinc-300">{b.name}</span>
                <span className="text-xs text-zinc-500">{(b.size / 1024 / 1024).toFixed(1)} MB</span>
                <Button size="sm" variant="ghost" onClick={() => download(b.name)}>Download</Button>
              </div>
            ))}
            {!o.backups.length && <p className="px-3 py-4 text-sm text-zinc-500">Noch keine Backups.</p>}
          </div>
        </Card>
      )}

      <Modal open={!!link} onClose={() => setLink(null)} title={`Reset-Link für ${link?.name}`}>
        <p className="text-sm text-zinc-400">Schick diesen Link privat an den Fahrer (z. B. per Discord-DM). Er ist <b className="text-white">1 Stunde</b> gültig und funktioniert nur einmal.</p>
        <div className="mt-4 flex gap-2">
          <code className="flex-1 truncate rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5 font-mono text-xs text-amber-200">{link?.link}</code>
          <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(link!.link); toast('Kopiert'); }}><Copy className="h-4 w-4" /></Button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500"><Mail className="h-3.5 w-3.5" />Mit eingerichtetem E-Mail-Versand können Fahrer das auch selbst über „Passwort vergessen“.</p>
      </Modal>
    </div>
  );
}
