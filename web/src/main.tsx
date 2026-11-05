import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/ui';
import { AppShell } from './components/AppShell';
import Landing from './pages/Landing';
import { Login, Register } from './pages/Auth';
import Companies from './pages/Companies';
import CompanyPublic from './pages/CompanyPublic';
import DriverPublic from './pages/DriverPublic';
import Dashboard from './pages/app/Dashboard';
import Jobs from './pages/app/Jobs';
import Live from './pages/app/Live';
import Leaderboard from './pages/app/Leaderboard';
import Onboarding from './pages/app/Onboarding';
import CompanyHome from './pages/app/CompanyHome';
import Members from './pages/app/Members';
import Events from './pages/app/Events';
import News from './pages/app/News';
import Fleet from './pages/app/Fleet';
import Payroll, { PayslipView } from './pages/app/Payroll';
import Finance from './pages/app/Finance';
import CompanySettings from './pages/app/CompanySettings';
import Profile from './pages/app/Profile';
import ClientPage from './pages/app/Client';
import { Logo } from './components/ui';

function Protected({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center"><div className="animate-pulse"><Logo /></div></div>;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}
function NeedsCompany({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  if (!me?.member) return <Navigate to="/app/onboarding" replace />;
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/c/:slug" element={<CompanyPublic />} />
            <Route path="/driver/:username" element={<DriverPublic />} />
            <Route path="/app" element={<Protected><AppShell /></Protected>}>
              <Route index element={<Dashboard />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="live" element={<Live />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="profile" element={<Profile />} />
              <Route path="client" element={<ClientPage />} />
              <Route path="payslip/:id" element={<PayslipView />} />
              <Route path="company" element={<NeedsCompany><CompanyHome /></NeedsCompany>} />
              <Route path="company/members" element={<NeedsCompany><Members /></NeedsCompany>} />
              <Route path="company/events" element={<NeedsCompany><Events /></NeedsCompany>} />
              <Route path="company/news" element={<NeedsCompany><News /></NeedsCompany>} />
              <Route path="company/fleet" element={<NeedsCompany><Fleet /></NeedsCompany>} />
              <Route path="company/payroll" element={<NeedsCompany><Payroll /></NeedsCompany>} />
              <Route path="company/finance" element={<NeedsCompany><Finance /></NeedsCompany>} />
              <Route path="company/settings" element={<NeedsCompany><CompanySettings /></NeedsCompany>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
