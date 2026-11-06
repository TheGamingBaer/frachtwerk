import { PublicPage } from '../components/PublicLayout';
import { useSite } from '../lib/site';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui';

/** Impressum & Datenschutz – Inhalte pflegt der Plattform-Admin unter Admin → Website */
export default function Legal({ kind }: { kind: 'impressum' | 'datenschutz' }) {
  const { site } = useSite();
  const { me } = useAuth();
  const text = site[kind];
  const title = kind === 'impressum' ? 'Impressum' : 'Datenschutzerklärung';
  return (
    <PublicPage>
      <article className="mx-auto max-w-3xl">
        <div className="hazard mb-8 h-1.5 w-24 rounded-full" />
        <h1 className="font-display text-5xl font-bold uppercase text-white">{title}</h1>
        {text
          ? <div className="mt-8 whitespace-pre-line text-[15px] leading-relaxed text-zinc-300">{text}</div>
          : <div className="mt-8 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-6 text-zinc-300">
              Dieser Text wurde noch nicht hinterlegt.
              {me?.user.is_admin && <div className="mt-4"><Button to="/app/admin?tab=site" size="sm">Jetzt im Admin-Bereich eintragen</Button></div>}
            </div>}
      </article>
    </PublicPage>
  );
}
