import { useState } from 'react';
import { Megaphone, Pin, Trash2, Send } from 'lucide-react';
import { useApi, useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Avatar, Button, Card, Empty, Input, PageHeader, Textarea, Toggle, useToast } from '../../components/ui';
import { ago, can } from '../../lib/format';

export default function News() {
  const { me } = useAuth();
  const toast = useToast();
  const staff = can(me?.member?.role, 'dispatcher');
  const { data, reload } = useApi<any[]>('/company/news');
  const [f, setF] = useState({ title: '', body: '', pinned: false });
  const post = async () => {
    try { await api('/company/news', { body: f }); setF({ title: '', body: '', pinned: false }); toast('Veröffentlicht'); reload(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const del = async (id: number) => { if (confirm('Beitrag löschen?')) { await api(`/company/news/${id}`, { method: 'DELETE' }); reload(); } };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={me?.member?.company_name} title="News" subtitle="Ankündigungen für das ganze Team." />
      {staff && (
        <Card className="mb-6 p-5">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Titel der Ankündigung" className="border-0 bg-transparent px-0 font-display text-lg focus:ring-0" />
          <Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Was gibt's Neues?" className="mt-2" />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1"><Toggle checked={f.pinned} onChange={(v) => setF({ ...f, pinned: v })} label="Oben anpinnen" /></div>
            <Button onClick={post} disabled={!f.title}><Send className="h-4 w-4" /> Veröffentlichen</Button>
          </div>
        </Card>
      )}
      {data && !data.length && <Card><Empty icon={Megaphone} title="Noch keine News" /></Card>}
      <div className="space-y-4">
        {data?.map((n) => (
          <Card key={n.id} className={n.pinned ? 'border-amber-500/25 p-6' : 'p-6'}>
            <div className="flex items-center gap-3">
              <Avatar name={n.author || '?'} hue={n.avatar_hue} src={n.avatar_url} size={36} />
              <div className="flex-1"><div className="text-sm font-medium text-white">{n.author}</div><div className="text-xs text-zinc-500">{ago(n.created_at)}</div></div>
              {n.pinned ? <Pin className="h-4 w-4 text-amber-400" /> : null}
              {staff && <button onClick={() => del(n.id)} className="rounded-lg p-1.5 text-zinc-600 hover:bg-white/5 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>}
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold text-white">{n.title}</h3>
            {n.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{n.body}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
