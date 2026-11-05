import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api, tokenStore } from './api';

type Me = { user: any; member: any; stats: any; level: any; achievements: any[]; pendingApplication: any } | null;
const Ctx = createContext<{ me: Me; loading: boolean; refresh: () => Promise<void>; login: (t: string) => Promise<void>; logout: () => void }>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setMe(null); setLoading(false); return; }
    try { setMe(await api('/me')); } catch { setMe(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    refresh();
    const out = () => setMe(null);
    window.addEventListener('fw:logout', out);
    return () => window.removeEventListener('fw:logout', out);
  }, [refresh]);
  const login = async (t: string) => { tokenStore.set(t); await refresh(); };
  const logout = () => { tokenStore.set(null); setMe(null); };
  return <Ctx.Provider value={{ me, loading, refresh, login, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);

/** Kleiner Daten-Hook */
export function useApi<T = any>(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try { setData(await api<T>(path)); setError(null); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}
