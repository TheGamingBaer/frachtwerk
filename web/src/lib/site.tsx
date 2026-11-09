import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export type Site = {
  site_name: string; logo_url: string; hero_kicker: string; hero_title: string; hero_accent: string; hero_text: string; hero_image: string;
  gallery_title: string; gallery: { url: string; caption: string }[]; discord_url: string; discord_app_id: string; impressum: string; datenschutz: string;
};
const DEFAULT: Site = {
  site_name: 'Frachtwerk', logo_url: '', hero_kicker: 'Für ETS2 & ATS · kostenlos', hero_title: 'Fahren. Abliefern.', hero_accent: 'Lohnzettel.',
  hero_text: 'Frachtwerk erfasst jede Tour aus ETS2 und ATS, rechnet den Lohn nach euren Regeln ab und zeigt eure Fahrer live auf der Karte. Kostenlos, für jede Spedition.',
  hero_image: '', gallery_title: 'Von der Straße', gallery: [], discord_url: '', discord_app_id: '', impressum: '', datenschutz: '',
};
const Ctx = createContext<{ site: Site; reload: () => void; setSite: (s: Site) => void }>({ site: DEFAULT, reload: () => {}, setSite: () => {} });

export function SiteProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<Site>(DEFAULT);
  const reload = useCallback(() => { fetch('/api/site').then((r) => r.json()).then((s) => setSite({ ...DEFAULT, ...s })).catch(() => {}); }, []);
  useEffect(reload, [reload]);
  useEffect(() => { document.title = `${site.site_name} – Abrechnung & Live-Map für ETS2/ATS`; }, [site.site_name]);
  return <Ctx.Provider value={{ site, reload, setSite }}>{children}</Ctx.Provider>;
}
export const useSite = () => useContext(Ctx);
