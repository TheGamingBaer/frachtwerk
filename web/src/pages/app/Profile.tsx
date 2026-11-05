import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DiscordIcon } from '../../components/icons';
import { tokenStore } from '../../lib/api';
import { Flag, Package, Boxes, Route, Milestone, Globe2, ShieldCheck, Weight, Moon, Coins, Award, Trophy, Receipt, FileText, UserRound, Lock } from 'lucide-react';
const Icons: Record<string, any> = { Flag, Package, Boxes, Route, Milestone, Globe2, ShieldCheck, Weight, Moon, Coins, Award, Trophy, Receipt, FileText, UserRound, Lock };
import { useApi, useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Avatar, Button, Card, CardHeader, Field, Input, PageHeader, Progress, Textarea, Toggle, useToast, cx } from '../../components/ui';
import { eur, km, monthName, num } from '../../lib/format';

export function Achievements({ list }: { list: any[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {list.map((a) => {
        const I = Icons[a.icon] || Icons.Award;
        return (
          <div key={a.id} title={a.desc} className={cx('relative overflow-hidden rounded-2xl border p-3.5 transition', a.unlocked ? 'border-amber-500/25 bg-gradient-to-br from-amber-500/[0.12] to-transparent' : 'border-white/[0.06] bg-white/[0.02] opacity-50 grayscale')}>
            <div className={cx('grid h-9 w-9 place-items-center rounded-xl', a.unlocked ? 'bg-gradient-to-br from-amber-300 to-amber-600 text-ink-950 shadow-glow' : 'bg-white/5 text-zinc-500')}><I className="h-4 w-4" /></div>
            <div className="mt-2.5 text-sm font-semibold text-white">{a.name}</div>
            <div className="text-[11px] text-zinc-500">{a.desc}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Profile() {
  const { me, refresh } = useAuth();
  const toast = useToast();
  const { data: slips } = useApi<any[]>('/me/payslips');
  const [f, setF] = useState<any>(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [sp, setSp] = useSearchParams();
  const { data: providers } = useApi<{ discord: boolean }>('/auth/providers');
  useEffect(() => { if (me) setF({ display_name: me.user.display_name, bio: me.user.bio, country: me.user.country, avatar_hue: me.user.avatar_hue, live_public: !!me.user.live_public }); }, [me]);
  useEffect(() => {
    const d = sp.get('discord');
    if (d === 'linked') toast('Discord verknüpft 🎉'); else if (d === 'taken') toast('Dieses Discord-Konto ist bereits mit einem anderen Profil verknüpft', 'err');
    if (d) { sp.delete('discord'); setSp(sp, { replace: true }); }
  }, []);
  if (!me || !f) return null;

  const save = async () => { try { await api('/me', { method: 'PATCH', body: f }); await refresh(); toast('Profil gespeichert'); } catch (e: any) { toast(e.message, 'err'); } };
  const unlink = async () => { try { await api('/auth/discord/unlink', { body: {} }); await refresh(); toast('Discord getrennt'); } catch (e: any) { toast(e.message, 'err'); } };
  const changePw = async () => { try { await api('/me/password', { body: pw }); setPw({ current: '', next: '' }); toast('Passwort geändert'); } catch (e: any) { toast(e.message, 'err'); } };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Konto" title="Profil" subtitle={<>Öffentlich unter <Link className="text-amber-400" to={`/driver/${me.user.username}`}>/driver/{me.user.username}</Link></>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card glow className="p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative"><Avatar name={f.display_name} hue={f.avatar_hue} src={f.avatar_url} size={88} /><span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-2 py-0.5 font-mono text-[11px] font-bold whitespace-nowrap text-ink-950">LV {me.level.level}</span></div>
              <div className="flex-1">
                <div className="font-display text-2xl font-semibold text-white">{f.display_name}</div>
                <Progress value={me.level.progress} className="mt-3 h-2" />
                <div className="mt-1.5 text-xs text-zinc-500">{num(me.level.current)} / {num(me.level.next)} XP bis Level {me.level.level + 1}</div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[['Lieferungen', num(me.stats.jobs)], ['Kilometer', km(me.stats.km)], ['Verdient', eur(me.stats.earned)], ['Ø Schaden', `${num(me.stats.avg_damage, 1)} %`]].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="label">{l}</div><div className="mt-1 truncate font-display font-semibold text-white">{v}</div></div>
              ))}
            </div>
          </Card>
          <Card><CardHeader title="Erfolge" subtitle={`${me.achievements.filter((a) => a.unlocked).length} von ${me.achievements.length}`} icon={Icons.Trophy} /><div className="px-5 pb-5"><Achievements list={me.achievements} /></div></Card>
          <Card>
            <CardHeader title="Meine Lohnzettel" icon={Icons.Receipt} />
            <div className="px-2 pb-2">
              {slips?.length ? slips.map((s) => (
                <Link key={s.id} to={`/app/payslip/${s.payroll_id}`} className="flex items-center gap-4 rounded-xl px-3 py-3 hover:bg-white/[0.03]">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10"><Icons.FileText className="h-5 w-5 text-emerald-400" /></div>
                  <div className="flex-1"><div className="font-medium text-white">{monthName(s.period)}</div><div className="text-xs text-zinc-500">{s.company_name} · {s.jobs} Touren · {km(s.km)}</div></div>
                  <span className="font-mono font-semibold text-white">{eur(s.net, 2)}</span>
                </Link>
              )) : <p className="px-3 pb-3 text-sm text-zinc-500">Noch keine Lohnzettel – die kommen nach dem ersten Lohnlauf deiner Firma.</p>}
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Profil bearbeiten" icon={Icons.UserRound} />
            <div className="space-y-4 px-5 pb-5">
              <Field label="Anzeigename"><Input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
              <Field label="Über mich"><Textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
              <Field label="Avatar-Farbe"><input type="range" min={0} max={359} value={f.avatar_hue} onChange={(e) => setF({ ...f, avatar_hue: Number(e.target.value) })} className="w-full accent-amber-500" /></Field>
              <Toggle checked={f.live_public} onChange={(v) => setF({ ...f, live_public: v })} label="Auf der öffentlichen Live-Map zeigen" desc="Deine Spedition sieht dich immer. Hier entscheidest du, ob alle anderen dich auch sehen." />
              <Button onClick={save} className="w-full">Speichern</Button>
            </div>
          </Card>
          {(providers?.discord || me.user.discord_id) && (
            <Card>
              <div className="flex items-center gap-4 p-5">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#5865F2] text-white shadow-[0_8px_30px_-8px_rgba(88,101,242,.8)]"><DiscordIcon /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white">Discord</div>
                  <div className="truncate text-xs text-zinc-500">{me.user.discord_id ? <>Verknüpft als <span className="text-zinc-300">@{me.user.discord_name}</span></> : 'Mit Discord anmelden & Avatar übernehmen'}</div>
                </div>
                {me.user.discord_id
                  ? <Button size="sm" variant="ghost" onClick={unlink}>Trennen</Button>
                  : <Button size="sm" href={`/api/auth/discord?mode=link&token=${encodeURIComponent(tokenStore.get() || '')}`}>Verknüpfen</Button>}
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title={me.user.has_password ? 'Passwort ändern' : 'Passwort festlegen'} subtitle={me.user.has_password ? undefined : 'Damit kannst du dich auch ohne Discord anmelden.'} icon={Icons.Lock} />
            <div className="space-y-3 px-5 pb-5">
              {!!me.user.has_password && <Input type="password" placeholder="Aktuelles Passwort" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />}
              <Input type="password" placeholder="Neues Passwort (min. 8 Zeichen)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              <Button variant="outline" onClick={changePw} className="w-full" disabled={(!!me.user.has_password && !pw.current) || pw.next.length < 8}>{me.user.has_password ? 'Ändern' : 'Festlegen'}</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
