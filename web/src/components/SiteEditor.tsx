import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, ArrowUp, ArrowDown, ExternalLink, Save, Upload, Type, Images, Scale } from 'lucide-react';
import { api, tokenStore } from '../lib/api';
import { Site, useSite } from '../lib/site';
import { Button, Card, CardHeader, Field, Input, Textarea, useToast, cx } from './ui';

async function upload(file: File): Promise<string> {
  const r = await fetch('/api/admin/upload', { method: 'POST', headers: { Authorization: `Bearer ${tokenStore.get()}`, 'Content-Type': file.type || 'application/octet-stream' }, body: file });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Upload fehlgeschlagen');
  return d.url;
}

/** Bildfeld: Klicken oder Datei hineinziehen */
function ImageDrop({ value, onChange, label, hint, aspect = 'aspect-video', multiple, onMany }: { value?: string; onChange?: (url: string) => void; label: string; hint?: string; aspect?: string; multiple?: boolean; onMany?: (urls: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const toast = useToast();
  const take = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await upload(f));
      multiple ? onMany?.(urls) : onChange?.(urls[0]);
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-zinc-400">{label}</div>
      <button type="button" onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
        className={cx('group relative grid w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed transition', aspect, over ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/25')}>
        {value && !multiple && <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <span className={cx('relative flex flex-col items-center gap-1.5 rounded-xl px-4 py-3 text-sm', value && !multiple ? 'bg-black/60 text-white opacity-0 backdrop-blur group-hover:opacity-100' : 'text-zinc-400')}>
          {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : <Upload className="h-5 w-5" />}
          {busy ? 'Lädt hoch …' : value && !multiple ? 'Bild ersetzen' : multiple ? 'Bilder auswählen oder hierher ziehen' : 'Bild auswählen oder hierher ziehen'}
        </span>
      </button>
      {hint && <div className="mt-1.5 text-xs text-zinc-500">{hint}</div>}
      {value && !multiple && onChange && <button type="button" onClick={() => onChange('')} className="mt-1.5 text-xs text-zinc-500 hover:text-rose-300">Bild entfernen</button>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple={multiple} hidden onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

const IMPRESSUM_VORLAGE = `Angaben gemäß § 5 DDG

Vorname Nachname
Straße Hausnummer
PLZ Ort

Kontakt
E-Mail: name@example.de

Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:
Vorname Nachname, Anschrift wie oben

Hinweis: Frachtwerk ist ein privates, nicht-kommerzielles Community-Projekt und steht in keiner Verbindung zu SCS Software.`;

const DATENSCHUTZ_VORLAGE = `1. Verantwortlicher
Siehe Impressum.

2. Welche Daten wir speichern
• Konto: Benutzername, E-Mail-Adresse, Passwort (nur verschlüsselt als Hash), optional Discord-Name und -Avatar.
• Spieldaten: Touren aus ETS2/ATS (Start, Ziel, Fracht, Kilometer, Verbrauch, Schaden) und – während der Client läuft – Position und Tempo im Spiel für die Live-Map.
• Technisch: IP-Adressen in Server-Protokollen zur Abwehr von Missbrauch.

3. Zweck und Rechtsgrundlage
Bereitstellung der Plattform (Art. 6 Abs. 1 lit. b DSGVO) und Sicherheit des Betriebs (Art. 6 Abs. 1 lit. f DSGVO).

4. Sichtbarkeit
Deine Spedition sieht deine Touren und Live-Position. Auf der öffentlichen Live-Map erscheinst du nur, wenn du das im Profil erlaubst (Standard: an, jederzeit abschaltbar).

5. Weitergabe
Keine Weitergabe an Dritte. Beim Discord-Login gelten zusätzlich die Datenschutzbestimmungen von Discord.

6. Speicherdauer
Solange dein Konto besteht. Auf Wunsch löschen wir dein Konto und deine Daten.

7. Deine Rechte
Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch sowie Beschwerde bei einer Datenschutz-Aufsichtsbehörde. Kontakt siehe Impressum.`;

export function SiteEditor() {
  const { site, setSite } = useSite();
  const [f, setF] = useState<Site>(site);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => setF(site), [site]);
  const set = (k: keyof Site) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try { const s = await api<Site>('/admin/site', { method: 'PUT', body: f }); setSite(s); toast('Website gespeichert'); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const move = (i: number, d: number) => { const g = [...f.gallery]; const j = i + d; if (j < 0 || j >= g.length) return; [g[i], g[j]] = [g[j], g[i]]; setF({ ...f, gallery: g }); };

  return (
    <div className="space-y-6">
      <div className="sticky top-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink-900/90 px-4 py-3 backdrop-blur-xl">
        <span className="text-sm text-zinc-400">Änderungen sind nach dem Speichern sofort für alle sichtbar.</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" href="/"><ExternalLink className="h-4 w-4" /> Startseite ansehen</Button>
          <Button size="sm" loading={busy} onClick={save}><Save className="h-4 w-4" /> Speichern</Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Marke" subtitle="Name und Logo erscheinen überall: Navigation, Login, Browser-Tab" icon={Type} />
        <div className="grid gap-5 px-5 pb-5 sm:grid-cols-[1fr_200px]">
          <div className="space-y-4">
            <Field label="Name der Plattform"><Input value={f.site_name} onChange={set('site_name')} maxLength={40} /></Field>
            <Field label="Discord-Einladung (optional)" hint="Erscheint in der Galerie und im Footer."><Input value={f.discord_url} onChange={set('discord_url')} placeholder="https://discord.gg/…" /></Field>
            <Field label="Discord Application ID (für den Discord-Status)" hint={<>Damit zeigt Discord bei deinen Fahrern „Spielt {f.site_name || 'Frachtwerk'}“ mit aktueller Tour. Einmalig: <a className="text-amber-400 hover:underline" href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">Discord Developer Portal</a> → „New Application“, Name = Plattformname → „Application ID“ kopieren. Optional unter „Rich Presence → Art Assets“ ein Bild mit dem Namen <code className="rounded bg-white/5 px-1">logo</code> hochladen.</>}>
              <Input value={f.discord_app_id} onChange={set('discord_app_id')} placeholder="z. B. 1234567890123456789" inputMode="numeric" className="font-mono" />
            </Field>
          </div>
          <ImageDrop label="Logo (quadratisch)" value={f.logo_url} onChange={(u) => setF({ ...f, logo_url: u })} aspect="aspect-square" hint="PNG mit transparentem Hintergrund, mind. 256 × 256" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Startseite" subtitle="Der erste Eindruck – Überschrift, Text, Hintergrundbild" icon={ImagePlus} />
        <div className="grid gap-5 px-5 pb-5 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Kleine Zeile über der Überschrift"><Input value={f.hero_kicker} onChange={set('hero_kicker')} maxLength={80} /></Field>
            <Field label="Überschrift (weiß)"><Input value={f.hero_title} onChange={set('hero_title')} maxLength={80} /></Field>
            <Field label="Überschrift, zweite Zeile (Akzentfarbe)"><Input value={f.hero_accent} onChange={set('hero_accent')} maxLength={80} /></Field>
            <Field label="Text darunter"><Textarea value={f.hero_text} onChange={set('hero_text')} maxLength={400} /></Field>
          </div>
          <ImageDrop label="Hintergrundbild" value={f.hero_image} onChange={(u) => setF({ ...f, hero_image: u })} hint="Ein starker Screenshot aus ETS2/ATS, mind. 1920 × 1080. Wird automatisch abgedunkelt." />
        </div>
        {/* Vorschau */}
        <div className="relative mx-5 mb-5 overflow-hidden rounded-2xl border border-white/10 bg-ink-950 px-6 py-12 text-center">
          {f.hero_image && <><img src={f.hero_image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" /><div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 via-ink-950/40 to-ink-950" /></>}
          <div className="relative">
            <div className="text-xs text-amber-200/80">{f.hero_kicker}</div>
            <div className="mt-3 font-display text-4xl font-bold uppercase leading-none text-white">{f.hero_title}<br /><span className="text-amber-400">{f.hero_accent}</span></div>
            <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-400">{f.hero_text}</p>
          </div>
          <div className="absolute left-3 top-3 rounded-md bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-400">Vorschau</div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Galerie" subtitle="Eure Screenshots: Konvois, LKW, Firmenhof – erscheint auf der Startseite" icon={Images} />
        <div className="space-y-4 px-5 pb-5">
          <Field label="Überschrift der Galerie"><Input value={f.gallery_title} onChange={set('gallery_title')} maxLength={60} /></Field>
          <ImageDrop label="Bilder hinzufügen" multiple aspect="h-28" onMany={(urls) => setF((cur) => ({ ...cur, gallery: [...cur.gallery, ...urls.map((url) => ({ url, caption: '' }))].slice(0, 24) }))} hint="Mehrere auf einmal möglich, bis zu 24 Bilder. Reihenfolge mit den Pfeilen ändern." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {f.gallery.map((g, i) => (
              <div key={g.url + i} className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
                <img src={g.url} alt="" className="aspect-video w-full object-cover" />
                <div className="flex items-center gap-1 p-2">
                  <Input value={g.caption} placeholder="Bildunterschrift" maxLength={120} className="h-8 py-1 text-xs"
                    onChange={(e) => { const gl = [...f.gallery]; gl[i] = { ...g, caption: e.target.value }; setF({ ...f, gallery: gl }); }} />
                  <button type="button" onClick={() => move(i, -1)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => move(i, 1)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setF({ ...f, gallery: f.gallery.filter((_, k) => k !== i) })} className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Impressum & Datenschutz" subtitle="In Deutschland Pflicht, sobald die Seite öffentlich ist" icon={Scale} />
        <div className="grid gap-5 px-5 pb-5 lg:grid-cols-2">
          <Field label="Impressum" hint={!f.impressum ? <button type="button" className="text-amber-400 hover:text-amber-300" onClick={() => setF({ ...f, impressum: IMPRESSUM_VORLAGE })}>Vorlage einfügen</button> : undefined}>
            <Textarea value={f.impressum} onChange={set('impressum')} className="min-h-[260px] font-mono text-xs" />
          </Field>
          <Field label="Datenschutzerklärung" hint={!f.datenschutz ? <button type="button" className="text-amber-400 hover:text-amber-300" onClick={() => setF({ ...f, datenschutz: DATENSCHUTZ_VORLAGE })}>Vorlage einfügen</button> : 'Vorlage ist keine Rechtsberatung – im Zweifel prüfen lassen.'}>
            <Textarea value={f.datenschutz} onChange={set('datenschutz')} className="min-h-[260px] font-mono text-xs" />
          </Field>
        </div>
      </Card>
    </div>
  );
}
