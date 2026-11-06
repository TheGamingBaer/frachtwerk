import React, { ReactNode, Suspense, lazy, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './lib/auth';
import { SiteProvider } from './lib/site';
import { ToastProvider, Logo } from './components/ui';
import { AppShell } from './components/AppShell';
import Landing from './pages/Landing';

// Seiten werden bei Bedarf geladen – die Homepage bleibt schlank
const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Register })));
const AuthCallback = lazy(() => import('./pages/Auth').then((m) => ({ default: m.AuthCallback })));
const Companies = lazy(() => import('./pages/Companies'));
const CompanyPublic = lazy(() => import('./pages/CompanyPublic'));
const DriverPublic = lazy(() => import('./pages/DriverPublic'));
const PublicMap = lazy(() => import('./pages/PublicMap'));
const Forgot = lazy(() => import('./pages/Reset').then((m) => ({ default: m.Forgot })));
const Reset = lazy(() => import('./pages/Reset').then((m) => ({ default: m.Reset })));
const Admin = lazy(() => import('./pages/app/Admin'));
const Legal = lazy(() => import('./pages/Legal'));
const Pair = lazy(() => import('./pages/app/Pair'));
const Dashboard = lazy(() => import('./pages/app/Dashboard'));
const Jobs = lazy(() => import('./pages/app/Jobs'));
const Live = lazy(() => import('./pages/app/Live'));
const Leaderboard = lazy(() => import('./pages/app/Leaderboard'));
const Onboarding = lazy(() => import('./pages/app/Onboarding'));
const CompanyHome = lazy(() => import('./pages/app/CompanyHome'));
const Members = lazy(() => import('./pages/app/Members'));
const Events = lazy(() => import('./pages/app/Events'));
const News = lazy(() => import('./pages/app/News'));
const Fleet = lazy(() => import('./pages/app/Fleet'));
const Payroll = lazy(() => import('./pages/app/Payroll'));
const PayslipView = lazy(() => import('./pages/app/Payroll').then((m) => ({ default: m.PayslipView })));
const Finance = lazy(() => import('./pages/app/Finance'));
const CompanySettings = lazy(() => import('./pages/app/CompanySettings'));
const Profile = lazy(() => import('./pages/app/Profile'));
const ClientPage = lazy(() => import('./pages/app/Client'));

const Splash = () => <div className="grid min-h-screen place-items-center"><div className="animate-pulse"><Logo /></div></div>;

function Protected({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}
function NeedsCompany({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  if (!me?.member) return <Navigate to="/app/onboarding" replace />;
  return <>{children}</>;
}

/** Spotlight-Effekt: Mausposition als CSS-Variablen an die Karte unter dem Zeiger */
function useSpotlight() {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const el = (e.target as HTMLElement)?.closest?.('.card') as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);
}

function ScrollTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function App() {
  useSpotlight();
  const c = (el: ReactNode) => <NeedsCompany>{el}</NeedsCompany>;
  return (
    <Suspense fallback={<Splash />}>
      <ScrollTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/map" element={<PublicMap />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/reset" element={<Reset />} />
        <Route path="/impressum" element={<Legal kind="impressum" />} />
        <Route path="/datenschutz" element={<Legal kind="datenschutz" />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/c/:slug" element={<CompanyPublic />} />
        <Route path="/driver/:username" element={<DriverPublic />} />
        <Route path="/app" element={<Protected><AppShell /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="map" element={<Live />} />
          <Route path="live" element={<Navigate to="/app/map" replace />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="onboarding" element={<Onboarding />} />
          <Route path="profile" element={<Profile />} />
          <Route path="client" element={<ClientPage />} />
          <Route path="admin" element={<Admin />} />
          <Route path="pair" element={<Pair />} />
          <Route path="payslip/:id" element={<PayslipView />} />
          <Route path="company" element={c(<CompanyHome />)} />
          <Route path="company/members" element={c(<Members />)} />
          <Route path="company/events" element={c(<Events />)} />
          <Route path="company/news" element={c(<News />)} />
          <Route path="company/fleet" element={c(<Fleet />)} />
          <Route path="company/payroll" element={c(<Payroll />)} />
          <Route path="company/finance" element={c(<Finance />)} />
          <Route path="company/settings" element={c(<CompanySettings />)} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SiteProvider>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
      </SiteProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
