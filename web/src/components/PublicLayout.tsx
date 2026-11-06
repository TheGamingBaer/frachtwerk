import { Link, NavLink } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo, Button, cx } from './ui';
import { useAuth } from '../lib/auth';
import { useSite } from '../lib/site';

export function PublicNav() {
  const { me } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 10);
    f(); window.addEventListener('scroll', f); return () => window.removeEventListener('scroll', f);
  }, []);
  const links = [['/#features', 'Features'], ['/#abrechnung', 'Abrechnung'], ['/map', 'Live-Map'], ['/companies', 'Firmen'], ['/#faq', 'FAQ']];
  return (
    <header className={cx('fixed inset-x-0 top-0 z-40 transition-all duration-300', scrolled ? 'py-2' : 'py-4')}>
      <div className={cx('mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 transition-all duration-300 sm:px-5',
        scrolled ? 'mx-3 h-14 border border-white/[0.08] bg-ink-900/70 backdrop-blur-xl shadow-2xl sm:mx-auto' : 'h-14')}>
        <Link to="/"><Logo /></Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map(([to, l]) => <a key={to} href={to} className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-white">{l}</a>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {me ? <Button to="/app" size="sm">Zum Cockpit →</Button> : (<>
            <Button to="/login" variant="ghost" size="sm">Anmelden</Button>
            <Button to="/register" size="sm">Kostenlos starten</Button>
          </>)}
        </div>
        <button className="rounded-lg p-2 text-zinc-300 md:hidden" onClick={() => setOpen(!open)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
      {open && (
        <div className="mx-3 mt-2 rounded-2xl border border-white/10 bg-ink-900/95 p-3 backdrop-blur-xl md:hidden">
          {links.map(([to, l]) => <a key={to} href={to} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-zinc-300">{l}</a>)}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {me ? <Button to="/app" className="col-span-2">Zum Cockpit</Button> : (<><Button to="/login" variant="outline">Anmelden</Button><Button to="/register">Starten</Button></>)}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { site } = useSite();
  return (
    <footer className="relative border-t border-white/[0.06] bg-ink-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-zinc-500">Die kostenlose Speditions- und Abrechnungsplattform für virtuelle Fernfahrer in Euro Truck Simulator 2 und American Truck Simulator.</p>
          <p className="mt-4 text-xs text-zinc-600">Nicht mit SCS Software verbunden. Euro Truck Simulator 2 und American Truck Simulator sind Marken von SCS Software.</p>
        </div>
        <div>
          <div className="label mb-3">Plattform</div>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><a href="/#features" className="hover:text-white">Features</a></li>
            <li><Link to="/companies" className="hover:text-white">Firmenverzeichnis</Link></li>
            <li><Link to="/app/client" className="hover:text-white">App herunterladen</Link></li>
          </ul>
        </div>
        <div>
          <div className="label mb-3">Konto</div>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><Link to="/register" className="hover:text-white">Registrieren</Link></li>
            <li><Link to="/login" className="hover:text-white">Anmelden</Link></li>
            <li><a href="/#faq" className="hover:text-white">FAQ</a></li>
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/[0.04] py-6 text-xs text-zinc-600"><Link to="/impressum" className="hover:text-zinc-300">Impressum</Link><Link to="/datenschutz" className="hover:text-zinc-300">Datenschutz</Link><span>© {new Date().getFullYear()} {site.site_name}</span>{site.discord_url && <a href={site.discord_url} target="_blank" rel="noreferrer" className="hover:text-zinc-300">Discord</a>}</div>
    </footer>
  );
}

export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-amber-500/[0.08] blur-[120px]" />
        <div className="absolute inset-0 bg-grid mask-fade-b opacity-50" />
      </div>
      <PublicNav />
      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6">{children}</main>
      <Footer />
    </div>
  );
}
