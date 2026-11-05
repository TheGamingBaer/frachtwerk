import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Users2, Route, Package, CalendarDays, ArrowRight, MessageCircle, Crown } from 'lucide-react';
import { PublicPage } from '../components/PublicLayout';
import { useApi, useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { Avatar, Badge, Button, Card, CardHeader, CompanyBadge, Field, Modal, Skeleton, Textarea, Input, useToast } from '../components/ui';
import { ago, compact, dateTime, km, ROLE_LABEL, num } from '../lib/format';
import { JOIN_LABEL, GAME_LABEL } from './Companies';

export default function CompanyPublic() {
  const { slug } = useParams();
  const { data: c, error } = useApi(`/companies/${slug}`, [slug]);
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) return <PublicPage><p className="text-center text-zinc-400">{error}</p></PublicPage>;
  if (!c) return <PublicPage><Skeleton className="h-64" /></PublicPage>;

  const join = async () => {
    setBusy(true);
    try {
      const r = await api(`/companies/${c.id}/join`, { body: { message: msg, invite_code: code } });
      await refresh();
      if (r.joined) { toast(`Willkommen bei ${c.name}!`); nav('/app/company'); } else { toast('Bewerbung abgeschickt'); setOpen(false); }
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const isMember = me?.member?.company_id === c.id;

  return (
    <PublicPage>
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 p-8 sm:p-12" style={{ background: `linear-gradient(135deg, hsl(${c.hue} 80% 40% / .25), rgba(10,12,18,.9) 60%)` }}>
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full blur-[100px]" style={{ background: `hsl(${c.hue} 90% 50% / .35)` }} />
        <div className="absolute inset-0 bg-grid opacity-30 mask-radial" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <CompanyBadge tag={c.tag} hue={c.hue} size={96} />
          <div className="flex-1">
            <div className="flex flex-wrap gap-2"><Badge tone={JOIN_LABEL[c.join_mode][1]}>{JOIN_LABEL[c.join_mode][0]}</Badge><Badge>{GAME_LABEL[c.games]}</Badge><Badge>Seit {new Date(c.created_at.replace(' ', 'T') + 'Z').getFullYear()}</Badge></div>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">{c.name}</h1>
            <p className="mt-3 max-w-2xl text-zinc-300">{c.description}</p>
          </div>
          <div className="flex flex-col gap-2">
            {isMember ? <Button to="/app/company">Zur Firma <ArrowRight className="h-4 w-4" /></Button>
              : me ? (me.member ? <Badge>Du bist bereits in einer Firma</Badge> : <Button onClick={() => setOpen(true)} size="lg">{c.join_mode === 'open' ? 'Jetzt beitreten' : c.join_mode === 'apply' ? 'Bewerben' : 'Mit Code beitreten'}</Button>)
              : <Button to={`/register`} size="lg">Registrieren & beitreten</Button>}
          </div>
        </div>
        <div className="relative mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
          {[[Users2, c.members.length, 'Fahrer'], [Route, compact(c.km), 'Kilometer'], [Package, num(c.jobs), 'Lieferungen']].map(([I, v, l]: any) => (
            <div key={l}><div className="flex items-center gap-2 font-display text-2xl font-semibold text-white sm:text-3xl"><I className="hidden h-5 w-5 text-white/40 sm:block" />{v}</div><div className="text-xs uppercase tracking-widest text-zinc-400">{l}</div></div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Team" subtitle={`${c.members.length} Mitglieder`} icon={Users2} />
          <div className="divide-y divide-white/[0.05] px-2 pb-2">
            {c.members.map((m: any) => (
              <Link key={m.id} to={`/driver/${m.username}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-white/[0.03]">
                <Avatar name={m.display_name} hue={m.avatar_hue} src={m.avatar_url} size={36} />
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-sm font-medium text-white">{m.display_name}{m.role === 'owner' && <Crown className="h-3.5 w-3.5 text-amber-400" />}</div><div className="text-xs text-zinc-500">{m.rank_title} · {ROLE_LABEL[m.role]}</div></div>
                <div className="font-mono text-sm text-zinc-300">{km(m.km)}</div>
              </Link>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          {c.events.length > 0 && (
            <Card>
              <CardHeader title="Kommende Events" icon={CalendarDays} />
              <div className="space-y-2 px-5 pb-5">{c.events.map((e: any) => (
                <div key={e.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="text-sm font-medium text-white">{e.title}</div><div className="text-xs text-zinc-500">{dateTime(e.start_at)} · {e.origin} → {e.destination}</div></div>
              ))}</div>
            </Card>
          )}
          <Card>
            <CardHeader title="Letzte Lieferungen" icon={Package} />
            <div className="space-y-1 px-3 pb-4">{c.recent.map((j: any) => (
              <div key={j.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm">
                <div className="min-w-0"><div className="truncate text-zinc-200">{j.origin_city} → {j.dest_city}</div><div className="truncate text-xs text-zinc-500">{j.cargo} · {j.driver}</div></div>
                <div className="text-right"><div className="font-mono text-xs text-zinc-300">{km(j.driven_km)}</div><div className="text-[11px] text-zinc-600">{ago(j.finished_at)}</div></div>
              </div>
            ))}</div>
          </Card>
          {c.discord && <Button href={c.discord} variant="outline" className="w-full"><MessageCircle className="h-4 w-4" /> Discord</Button>}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`${c.name} beitreten`}>
        <div className="space-y-4">
          {c.join_mode === 'apply' && <Field label="Nachricht an die Firma"><Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Erzähl kurz etwas über dich: Erfahrung, Lieblingsrouten, Spielzeiten…" /></Field>}
          {c.join_mode !== 'open' && <Field label="Einladungscode (optional)" hint={c.join_mode === 'apply' ? 'Mit Code trittst du sofort bei, ohne Bewerbung.' : 'Den Code bekommst du von der Firmenleitung.'}><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono tracking-widest" /></Field>}
          {c.join_mode === 'open' && <p className="text-sm text-zinc-400">Diese Firma ist offen – du bist sofort Mitglied.</p>}
          <Button className="w-full" loading={busy} onClick={join}>{c.join_mode === 'open' || code ? 'Beitreten' : 'Bewerbung absenden'}</Button>
        </div>
      </Modal>
    </PublicPage>
  );
}
