import { useEffect, useRef, useState } from 'react';
import { tokenStore } from './api';

export type Driver = {
  user_id: number; username: string; display_name: string; avatar_hue: number; avatar_url?: string | null;
  company_id?: number | null; company_name?: string | null; company_tag?: string | null; company_hue: number; company_slug?: string | null;
  game: 'ets2' | 'ats'; x: number; z: number; speed: number; paused?: boolean; updated_at: number;
  origin?: string; destination?: string; cargo?: string; truck?: string; cargo_mass?: number; income?: number; rank_title?: string;
  remaining_km?: number; eta_min?: number; fuel?: number; fuel_capacity?: number; damage?: number;
  trail: [number, number][];
  // Interpolation (clientseitig)
  _from?: { x: number; z: number; t: number }; _to?: { x: number; z: number; t: number }; _dur?: number; _seen?: number;
};

export type LiveEvent = { id: number; type: 'delivery' | 'cancel'; user_id: number; display_name: string; job: any; at: number };

const STALE = 90_000;

/** Aktuelle, interpolierte Position eines Fahrers in Spielkoordinaten */
export function driverPos(d: Driver, now = performance.now()): [number, number] {
  if (!d._from || !d._to) return [d.x, d.z];
  const p = Math.min(1, Math.max(0, (now - d._to.t) / (d._dur || 1500)));
  return [d._from.x + (d._to.x - d._from.x) * p, d._from.z + (d._to.z - d._from.z) * p];
}

/**
 * Live-Fahrer per Server-Sent-Events (mit Polling-Fallback).
 * scope: 'all' | 'company' · publicMode: ohne Anmeldung (Homepage / öffentliche Karte)
 */
export function useLiveDrivers({ scope = 'all', publicMode = false }: { scope?: 'all' | 'company'; publicMode?: boolean }) {
  const store = useRef(new Map<number, Driver>());
  const [version, setVersion] = useState(0);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState<'connecting' | 'live' | 'polling'>('connecting');

  useEffect(() => {
    store.current = new Map();
    setVersion((v) => v + 1);
    const bump = () => setVersion((v) => v + 1);

    const upsert = (d: Driver, replaceTrail = false) => {
      const now = performance.now();
      const old = store.current.get(d.user_id);
      if (old) {
        const [cx, cz] = driverPos(old, now);
        const jump = Math.hypot(d.x - cx, d.z - cz) > 20_000; // Fähre/Teleport: nicht animieren
        const dur = Math.min(6000, Math.max(800, now - (old._to?.t ?? now)));
        let trail = old.trail;
        if (replaceTrail) trail = d.trail;
        else for (const p of d.trail || []) { const l = trail[trail.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) trail = [...trail, p]; }
        if (d.game !== old.game) trail = d.trail || [];
        store.current.set(d.user_id, { ...old, ...d, _seen: Date.now(), trail: trail.slice(-600), _from: jump ? { x: d.x, z: d.z, t: now } : { x: cx, z: cz, t: now }, _to: { x: d.x, z: d.z, t: now }, _dur: dur });
      } else {
        store.current.set(d.user_id, { ...d, _seen: Date.now(), trail: d.trail || [], _from: { x: d.x, z: d.z, t: now }, _to: { x: d.x, z: d.z, t: now }, _dur: 1 });
      }
    };

    let es: EventSource | null = null;
    let poll: any = null;
    const token = tokenStore.get();
    const base = publicMode ? '/api/public' : '/api';
    const startPolling = () => {
      setStatus('polling');
      const tick = async () => {
        try {
          const r = await fetch(`${base}/live${publicMode ? '' : `?scope=${scope}`}`, { headers: token && !publicMode ? { Authorization: `Bearer ${token}` } : {} });
          const list: Driver[] = await r.json();
          const ids = new Set(list.map((d) => d.user_id));
          for (const id of [...store.current.keys()]) if (!ids.has(id)) store.current.delete(id);
          list.forEach((d) => upsert(d, true)); bump();
        } catch {}
      };
      tick(); poll = setInterval(tick, 4000);
    };

    if (typeof EventSource !== 'undefined') {
      const url = publicMode ? `/api/public/stream` : `/api/stream?scope=${scope}&access_token=${encodeURIComponent(token || '')}`;
      es = new EventSource(url);
      let opened = false;
      es.addEventListener('open', () => { opened = true; setStatus('live'); });
      es.addEventListener('snapshot', (e: any) => {
        const list: Driver[] = JSON.parse(e.data);
        store.current = new Map();
        list.forEach((d) => upsert(d, true)); bump();
      });
      es.addEventListener('driver', (e: any) => { upsert(JSON.parse(e.data)); bump(); });
      es.addEventListener('leave', (e: any) => { store.current.delete(JSON.parse(e.data).user_id); bump(); });
      const onJob = (type: 'delivery' | 'cancel') => (e: any) => {
        const d = JSON.parse(e.data);
        setEvents((list) => [{ id: Date.now() + Math.random(), type, user_id: d.user_id, display_name: d.display_name, job: d.job, at: Date.now() }, ...list].slice(0, 20));
      };
      es.addEventListener('delivery', onJob('delivery'));
      es.addEventListener('cancel', onJob('cancel'));
      es.onerror = () => { if (!opened) { es?.close(); es = null; startPolling(); } };
    } else startPolling();

    // veraltete Fahrer entfernen
    const prune = setInterval(() => {
      let changed = false;
      for (const [id, d] of store.current) if (Date.now() - (d._seen || 0) > STALE) { store.current.delete(id); changed = true; }
      if (changed) bump();
    }, 10_000);

    return () => { es?.close(); clearInterval(poll); clearInterval(prune); };
  }, [scope, publicMode]);

  return { drivers: [...store.current.values()], store, version, events, status };
}
