import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Gauge, Fuel, Package, Navigation, Download } from 'lucide-react';
import { api } from '../../lib/api';
import { Avatar, Button, Card, Empty, PageHeader, Badge } from '../../components/ui';
import { num } from '../../lib/format';

export default function Live() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = () => api('/live').then((r) => !stop && setRows(r)).catch(() => {});
    tick(); const t = setInterval(tick, 4000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  // Positionen für das Radar normalisieren
  const pts = (rows || []).filter((r) => r.x || r.z);
  const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
  const minX = Math.min(...xs, -60000), maxX = Math.max(...xs, 60000), minZ = Math.min(...zs, -60000), maxZ = Math.max(...zs, 60000);
  const pos = (p: any) => ({ left: `${8 + ((p.x - minX) / (maxX - minX || 1)) * 84}%`, top: `${8 + ((p.z - minZ) / (maxZ - minZ || 1)) * 84}%` });

  return (
    <div>
      <PageHeader eyebrow="Echtzeit" title="Live-Karte" subtitle="Wer ist gerade auf der Straße? Aktualisiert alle 4 Sekunden."
        actions={<Badge tone="cyan"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />{rows?.length || 0} online</Badge>} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="aspect-square max-h-[620px] w-full sm:aspect-[4/3]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.08),transparent_70%)]" />
          <div className="absolute inset-0 bg-grid opacity-60" style={{ backgroundSize: '40px 40px' }} />
          {[20, 40, 60, 80].map((r) => <div key={r} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/10" style={{ width: `${r}%`, height: `${r * 1.33}%` }} />)}
          <div className="absolute left-1/2 top-1/2 h-1/2 w-1/2 origin-top-left animate-[spin_6s_linear_infinite] bg-[conic-gradient(from_0deg,rgba(34,211,238,.18),transparent_25%)]" style={{ borderRadius: '0 0 100% 0' }} />
          <AnimatePresence>
            {pts.map((p) => (
              <motion.div key={p.user_id} initial={{ scale: 0 }} animate={{ scale: 1, ...pos(p) }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 80, damping: 20 }} className="absolute -translate-x-1/2 -translate-y-1/2" style={pos(p)}>
                <span className="absolute inset-0 m-auto h-4 w-4 animate-pulsering rounded-full bg-cyan-400" />
                <span className="relative block h-4 w-4 rounded-full border-2 border-ink-950 bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,.9)]" />
                <div className="absolute left-5 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-ink-900/90 px-2 py-1 text-[11px] text-white backdrop-blur">
                  {p.display_name} · <span className="font-mono text-cyan-300">{Math.round(p.speed)} km/h</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {!pts.length && <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">Keine Positionsdaten</div>}
          <div className="absolute bottom-3 left-4 font-mono text-[10px] uppercase tracking-widest text-cyan-300/50">Spielwelt-Radar · relative Positionen</div>
        </Card>

        <div className="space-y-3">
          {rows && !rows.length && (
            <Card><Empty icon={Radio} title="Gerade niemand unterwegs" text="Sobald ein Fahrer mit gestartetem Client fährt, erscheint er hier in Echtzeit." action={<Button to="/app/client" variant="outline"><Download className="h-4 w-4" /> Client einrichten</Button>} /></Card>
          )}
          {rows?.map((r) => {
            const fuelPct = r.fuel_capacity ? r.fuel / r.fuel_capacity : 0;
            return (
              <motion.div key={r.user_id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.display_name} hue={r.avatar_hue} size={40} />
                    <div className="min-w-0 flex-1"><div className="font-medium text-white">{r.display_name}</div><div className="truncate text-xs text-zinc-500">{r.truck}</div></div>
                    <div className="text-right"><div className="font-display text-2xl font-semibold text-white tnum">{Math.round(r.speed)}</div><div className="text-[10px] uppercase tracking-widest text-zinc-500">km/h</div></div>
                  </div>
                  {r.destination ? (
                    <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex items-center gap-2 text-sm text-white"><Navigation className="h-4 w-4 text-cyan-400" />{r.origin} → {r.destination}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500"><Package className="h-3.5 w-3.5" />{r.cargo}{r.damage > 0 && <span className="text-rose-300">· {num(r.damage, 1)} % Schaden</span>}</div>
                      <div className="mt-3 flex justify-between text-xs"><span className="text-zinc-400">noch <span className="font-mono text-white">{num(r.remaining_km)} km</span></span>{r.eta_min > 0 && <span className="text-zinc-500">ETA {Math.floor(r.eta_min / 60)}h {Math.round(r.eta_min % 60)}m</span>}</div>
                    </div>
                  ) : <div className="mt-4 text-xs text-zinc-500">Freie Fahrt – kein Auftrag</div>}
                  <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                    <Fuel className="h-3.5 w-3.5" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${fuelPct < 0.15 ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${fuelPct * 100}%` }} /></div>
                    <span className="font-mono">{num(r.fuel)} l</span>
                    {r.paused && <Badge>Pausiert</Badge>}
                    <Gauge className="hidden" />
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
