import { forwardRef, useEffect, useImperativeHandle, useRef, useState, MutableRefObject } from 'react';
import { zoom as d3zoom, zoomIdentity, ZoomBehavior, ZoomTransform } from 'd3-zoom';
import { select } from 'd3-selection';
import { Plus, Minus, Maximize2, Minimize2, LocateFixed } from 'lucide-react';
import { gameToMap, findCity, Game } from '../lib/gamegeo';
import { Driver, driverPos } from '../lib/live';
import { cx } from './ui';

type Geo = { extent: [[number, number], [number, number]]; cities: [string, number, number, number][]; paths: Record<string, Path2D> };
const cache: Record<string, Promise<Geo>> = {};
function loadGeo(game: Game): Promise<Geo> {
  return (cache[game] ||= fetch(`/geo/${game}.json`).then((r) => r.json()).then((d) => ({
    extent: d.extent, cities: d.cities, paths: Object.fromEntries(Object.entries(d.layers).map(([k, v]) => [k, new Path2D(v as string)])),
  })));
}

export type LiveMapHandle = { flyTo: (id: number) => void; fit: () => void };
type Props = {
  game: Game; store: MutableRefObject<Map<number, Driver>>; version: number;
  selectedId?: number | null; onSelect?: (id: number | null) => void;
  follow?: boolean; onFollowChange?: (f: boolean) => void;
  className?: string; compact?: boolean; interactive?: boolean;
};

const hsl = (h: number, s = 90, l = 60, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

export const LiveMap = forwardRef<LiveMapHandle, Props>(function LiveMap({ game, store, version, selectedId, onSelect, follow, onFollowChange, className, compact, interactive = true }, ref) {
  const wrap = useRef<HTMLDivElement>(null);
  const baseCv = useRef<HTMLCanvasElement>(null);
  const dynCv = useRef<HTMLCanvasElement>(null);
  const markers = useRef(new Map<number, HTMLDivElement>());
  const geo = useRef<Geo | null>(null);
  const t = useRef<ZoomTransform>(zoomIdentity);
  const fitK = useRef(1);
  const zb = useRef<ZoomBehavior<HTMLDivElement, unknown>>();
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const baseDirty = useRef(true);
  const anim = useRef<number | null>(null);
  const followRef = useRef(follow); followRef.current = follow;
  const selRef = useRef(selectedId); selRef.current = selectedId;
  const [ready, setReady] = useState(false);
  const [full, setFull] = useState(false);
  const [, force] = useState(0);

  // ---------- Grundkarte laden ----------
  useEffect(() => {
    let alive = true; setReady(false);
    loadGeo(game).then((g) => { if (!alive) return; geo.current = g; setReady(true); fit(false); });
    return () => { alive = false; };
  }, [game]);

  // ---------- Zoom & Größe ----------
  useEffect(() => {
    const el = wrap.current!;
    const resize = () => {
      const r = el.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: r.width, h: r.height, dpr };
      for (const cv of [baseCv.current!, dynCv.current!]) { cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = `${r.width}px`; cv.style.height = `${r.height}px`; }
      if (geo.current && t.current === zoomIdentity) fit(false);
      baseDirty.current = true;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);
    const z = d3zoom<HTMLDivElement, unknown>().scaleExtent([0.0001, 100])
      .filter((e: any) => interactive && (!e.ctrlKey || e.type === 'wheel') && !e.button)
      .on('start', (e: any) => { if (e.sourceEvent && followRef.current) onFollowChange?.(false); })
      .on('zoom', (e) => { t.current = e.transform; baseDirty.current = true; });
    zb.current = z;
    const sel = select(el).call(z);
    if (!interactive) sel.on('.zoom', null);
    return () => { ro.disconnect(); sel.on('.zoom', null); };
  }, [interactive]);

  function contentBox() {
    const g = geo.current!; const xs = g.cities.map((c) => c[1]), ys = g.cities.map((c) => c[2]);
    return [Math.min(...xs) - 60, Math.min(...ys) - 60, Math.max(...xs) + 60, Math.max(...ys) + 60];
  }
  function setTransform(nt: ZoomTransform) { select(wrap.current!).call(zb.current!.transform as any, nt); }
  function animateTo(nt: ZoomTransform, ms = 900) {
    const from = t.current; const start = performance.now();
    if (anim.current) cancelAnimationFrame(anim.current);
    const ease = (p: number) => 1 - Math.pow(1 - p, 3);
    // logarithmische Zoom-Interpolation wirkt natürlicher
    const step = (now: number) => {
      const p = ease(Math.min(1, (now - start) / ms));
      const k = Math.exp(Math.log(from.k) + (Math.log(nt.k) - Math.log(from.k)) * p);
      const { w, h } = size.current;
      const c0 = [(w / 2 - from.x) / from.k, (h / 2 - from.y) / from.k], c1 = [(w / 2 - nt.x) / nt.k, (h / 2 - nt.y) / nt.k];
      const c = [c0[0] + (c1[0] - c0[0]) * p, c0[1] + (c1[1] - c0[1]) * p];
      setTransform(zoomIdentity.translate(w / 2 - c[0] * k, h / 2 - c[1] * k).scale(k));
      if (p < 1) anim.current = requestAnimationFrame(step); else anim.current = null;
    };
    anim.current = requestAnimationFrame(step);
  }
  function fit(animated = true) {
    if (!geo.current || !size.current.w) return;
    const [x0, y0, x1, y1] = contentBox(); const { w, h } = size.current;
    const k = Math.min(w / (x1 - x0), h / (y1 - y0)) * (compact ? 1.05 : 0.95);
    fitK.current = k;
    zb.current?.scaleExtent([k * 0.7, k * 80]);
    const nt = zoomIdentity.translate(w / 2 - ((x0 + x1) / 2) * k, h / 2 - ((y0 + y1) / 2) * k).scale(k);
    animated ? animateTo(nt) : setTransform(nt);
  }
  function centerOn(km: [number, number], k: number) {
    const { w, h } = size.current;
    return zoomIdentity.translate(w / 2 - km[0] * k, h / 2 - km[1] * k).scale(k);
  }

  useImperativeHandle(ref, () => ({
    flyTo: (id: number) => {
      const d = store.current.get(id); if (!d || d.game !== game) return;
      const km = gameToMap(game, ...driverPos(d));
      animateTo(centerOn(km, Math.max(t.current.k, fitK.current * 7)), 1100);
    },
    fit: () => fit(true),
  }));

  // ---------- Zeichnen ----------
  function drawBase() {
    const g = geo.current; const cv = baseCv.current; if (!g || !cv) return;
    const ctx = cv.getContext('2d')!; const { w, h, dpr } = size.current; const tr = t.current; const k = tr.k;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Meer
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.8);
    bg.addColorStop(0, '#070b16'); bg.addColorStop(1, '#030409');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // Punktraster
    ctx.fillStyle = 'rgba(148,163,184,0.06)';
    const gs = 28; const ox = ((tr.x % gs) + gs) % gs, oy = ((tr.y % gs) + gs) % gs;
    for (let x = ox; x < w; x += gs) for (let y = oy; y < h; y += gs) ctx.fillRect(x, y, 1, 1);

    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * tr.x, dpr * tr.y);
    const px = 1 / k;
    // Land mit Küstenleuchten
    const lg = ctx.createLinearGradient(0, -2000, 0, 2000);
    lg.addColorStop(0, '#141d33'); lg.addColorStop(1, '#10172a');
    ctx.fillStyle = lg; ctx.fill(g.paths.land);
    ctx.save(); ctx.shadowColor = 'rgba(56,189,248,0.45)'; ctx.shadowBlur = 12 * dpr;
    ctx.strokeStyle = 'rgba(120,175,255,0.32)'; ctx.lineWidth = 1 * px; ctx.stroke(g.paths.coast); ctx.restore();
    // Seen & Flüsse
    ctx.fillStyle = '#060a14'; ctx.fill(g.paths.lakes);
    if (k > fitK.current * 2) { ctx.strokeStyle = 'rgba(56,189,248,0.14)'; ctx.lineWidth = 0.8 * px; ctx.stroke(g.paths.rivers); }
    // Grenzen
    if (g.paths.states) { ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 0.8 * px; ctx.stroke(g.paths.states); }
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 0.9 * px; ctx.setLineDash([4 * px, 3 * px]); ctx.stroke(g.paths.borders); ctx.setLineDash([]);

    // Städte (Bildschirmkoordinaten für scharfe Schrift)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rel = k / fitK.current;
    const placed: number[][] = [];
    const sorted = [...g.cities].sort((a, b) => a[3] - b[3]);
    for (const [name, x, y, rank] of sorted) {
      const sx = tr.x + x * k, sy = tr.y + y * k;
      if (sx < -50 || sy < -20 || sx > w + 50 || sy > h + 20) continue;
      const showDot = rank === 1 || (rank === 2 && rel > 1.4) || rel > 2.6;
      if (!showDot) continue;
      ctx.fillStyle = rank === 1 ? 'rgba(255,214,150,0.9)' : 'rgba(203,213,225,0.55)';
      ctx.beginPath(); ctx.arc(sx, sy, rank === 1 ? 2.6 : 1.8, 0, Math.PI * 2); ctx.fill();
      const showLabel = (rank === 1 && rel > (compact ? 1.6 : 0.9)) || (rank === 2 && rel > 2.2) || (rank === 3 && rel > 4.5);
      if (!showLabel) continue;
      ctx.font = `${rank === 1 ? 600 : 500} ${rank === 1 ? 12 : 11}px Inter, system-ui, sans-serif`;
      const tw = ctx.measureText(name).width; const box = [sx + 6, sy - 8, sx + 8 + tw, sy + 6];
      if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      placed.push(box);
      ctx.fillStyle = 'rgba(5,7,13,0.75)'; ctx.fillText(name, sx + 7, sy + 4.5 + 1);
      ctx.fillStyle = rank === 1 ? 'rgba(255,232,200,0.92)' : 'rgba(203,213,225,0.7)';
      ctx.fillText(name, sx + 7, sy + 4.5);
    }
  }

  function drawDynamic(now: number) {
    const cv = dynCv.current; const g = geo.current; if (!cv || !g) return;
    const ctx = cv.getContext('2d')!; const { w, h, dpr } = size.current; const tr = t.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const S = (p: [number, number]) => [tr.x + p[0] * tr.k, tr.y + p[1] * tr.k];
    for (const d of store.current.values()) {
      if (d.game !== game) continue;
      const sel = d.user_id === selRef.current;
      const pos = gameToMap(game, ...driverPos(d, now)); const sp = S(pos);
      // Route zum Ziel
      const dest = findCity(g.cities, d.destination);
      if (dest && (sel || compact === false)) {
        const dp = S([dest[1], dest[2]]);
        ctx.setLineDash([6, 6]); ctx.lineDashOffset = -now / 60;
        ctx.strokeStyle = hsl(d.company_hue, 90, 70, sel ? 0.75 : 0.25); ctx.lineWidth = sel ? 2 : 1.2;
        ctx.beginPath(); ctx.moveTo(sp[0], sp[1]); ctx.lineTo(dp[0], dp[1]); ctx.stroke(); ctx.setLineDash([]);
        if (sel) {
          ctx.strokeStyle = hsl(d.company_hue, 90, 70, 0.9); ctx.lineWidth = 2;
          const r = 7 + Math.sin(now / 300) * 2;
          ctx.beginPath(); ctx.arc(dp[0], dp[1], r, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = hsl(d.company_hue, 90, 70, 0.25); ctx.beginPath(); ctx.arc(dp[0], dp[1], 14, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Spur
      if (d.trail.length > 1) {
        const pts = (sel ? d.trail : d.trail.slice(-150)).map((p) => S(gameToMap(game, p[0], p[1]))); pts.push(sp);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (sel) { ctx.save(); ctx.shadowColor = hsl(d.company_hue, 95, 60, 0.9); ctx.shadowBlur = 12; }
        const n = pts.length;
        for (let i = 1; i < n; i++) {
          const a = 0.08 + 0.75 * (i / n);
          ctx.strokeStyle = hsl(d.company_hue, 95, 62, sel ? Math.min(1, a + 0.2) : a * 0.8);
          ctx.lineWidth = sel ? 3 : 2;
          ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
        }
        if (sel) ctx.restore();
      }
    }
  }

  function updateMarkers(now: number) {
    const tr = t.current; const { w, h } = size.current;
    for (const [id, el] of markers.current) {
      const d = store.current.get(id); if (!d || d.game !== game) { el.style.display = 'none'; continue; }
      const pos = gameToMap(game, ...driverPos(d, now));
      const x = tr.x + pos[0] * tr.k, y = tr.y + pos[1] * tr.k;
      const off = x < -40 || y < -40 || x > w + 40 || y > h + 40;
      el.style.display = off ? 'none' : '';
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      // Fahrtrichtung: Bewegung zwischen den letzten beiden Meldungen (Fallback: Spur)
      let a: [number, number] | null = null, b: [number, number] | null = null;
      if (d._from && d._to && Math.hypot(d._to.x - d._from.x, d._to.z - d._from.z) > 30) { a = [d._from.x, d._from.z]; b = [d._to.x, d._to.z]; }
      else if (d.trail.length > 1) { a = d.trail[d.trail.length - 2]; b = d.trail[d.trail.length - 1]; }
      if (a && b) {
        const pa = gameToMap(game, a[0], a[1]), pb = gameToMap(game, b[0], b[1]);
        const ang = (Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) * 180) / Math.PI + 90;
        const arrow = el.querySelector<HTMLElement>('[data-arrow]'); if (arrow) arrow.style.transform = `rotate(${ang}deg)`;
      }
    }
  }

  // Render-Schleife
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    const loop = (now: number) => {
      // Verfolgen: Karte weich auf den gewählten Fahrer zentrieren
      if (followRef.current && selRef.current && !anim.current) {
        const d = store.current.get(selRef.current);
        if (d && d.game === game) {
          const km = gameToMap(game, ...driverPos(d, now)); const tr = t.current; const { w, h } = size.current;
          const tx = w / 2 - km[0] * tr.k, ty = h / 2 - km[1] * tr.k;
          if (Math.abs(tx - tr.x) > 0.3 || Math.abs(ty - tr.y) > 0.3) setTransform(zoomIdentity.translate(tr.x + (tx - tr.x) * 0.12, tr.y + (ty - tr.y) * 0.12).scale(tr.k));
        }
      }
      if (baseDirty.current) { drawBase(); baseDirty.current = false; }
      drawDynamic(now); updateMarkers(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready, game]);

  useEffect(() => { force((x) => x + 1); }, [version]);
  useEffect(() => { baseDirty.current = true; }, [compact]);

  const toggleFull = async () => {
    try {
      if (!document.fullscreenElement) { await wrap.current!.parentElement!.requestFullscreen(); setFull(true); }
      else { await document.exitFullscreen(); setFull(false); }
    } catch { setFull((f) => !f); }
  };
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);

  const drivers = [...store.current.values()].filter((d) => d.game === game);
  const zoomBy = (f: number) => { const { w, h } = size.current; const tr = t.current; const k = tr.k * f; const c = [(w / 2 - tr.x) / tr.k, (h / 2 - tr.y) / tr.k]; animateTo(zoomIdentity.translate(w / 2 - c[0] * k, h / 2 - c[1] * k).scale(k), 350); };

  return (
    <div className={cx('relative h-full w-full overflow-hidden bg-[#05070d]', className)}>
      <div ref={wrap} className={cx('absolute inset-0 touch-none', interactive && 'cursor-grab active:cursor-grabbing')} onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'CANVAS') onSelect?.(null); }}>
        <canvas ref={baseCv} className="absolute inset-0" />
        <canvas ref={dynCv} className="pointer-events-none absolute inset-0" />
        {drivers.map((d) => {
          const sel = d.user_id === selectedId;
          return (
            <div key={d.user_id} ref={(el) => { if (el) markers.current.set(d.user_id, el); else markers.current.delete(d.user_id); }}
              className="absolute left-0 top-0 will-change-transform" style={{ zIndex: sel ? 20 : 10 }}>
              <button onClick={(e) => { e.stopPropagation(); onSelect?.(d.user_id); }} className="group relative -translate-x-1/2 -translate-y-1/2 outline-none">
                <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-pulsering rounded-full" style={{ background: hsl(d.company_hue, 90, 60, 0.45) }} />
                <span className={cx('relative grid place-items-center rounded-full border-2 border-[#05070d] shadow-lg transition-transform', sel ? 'h-8 w-8 scale-110' : 'h-6 w-6 group-hover:scale-110')}
                  style={{ background: `linear-gradient(135deg, ${hsl(d.company_hue, 95, 64)}, ${hsl((d.company_hue + 30) % 360, 85, 42)})`, boxShadow: `0 0 18px ${hsl(d.company_hue, 95, 60, 0.8)}` }}>
                  <svg data-arrow viewBox="0 0 24 24" className={cx('transition-transform duration-500', sel ? 'h-4 w-4' : 'h-3 w-3')} fill="#05070d"><path d="M12 2 L20 21 L12 16.5 L4 21 Z" /></svg>
                </span>
                <span className={cx('pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#0a0e18]/90 px-2 py-0.5 text-[11px] font-medium text-white shadow-xl backdrop-blur transition-opacity',
                  sel || !compact ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                  {d.company_tag && <span className="mr-1 font-mono text-[10px]" style={{ color: hsl(d.company_hue, 90, 70) }}>{d.company_tag}</span>}
                  {d.display_name.split(' ')[0]} <span className="font-mono text-zinc-400">{Math.round(d.speed)}</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {!ready && <div className="absolute inset-0 grid place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400/20 border-t-amber-400" /></div>}

      {interactive && (
        <div className="absolute bottom-4 right-4 z-30 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0a0e18]/80 backdrop-blur-xl">
          {[[Plus, () => zoomBy(1.8), 'Hineinzoomen'], [Minus, () => zoomBy(1 / 1.8), 'Herauszoomen'], [LocateFixed, () => fit(true), 'Alles anzeigen'], [full ? Minimize2 : Maximize2, toggleFull, 'Vollbild']].map(([I, f, l]: any) => (
            <button key={l} title={l} onClick={f} className="grid h-10 w-10 place-items-center border-b border-white/[0.06] text-zinc-300 transition last:border-0 hover:bg-white/10 hover:text-white"><I className="h-4 w-4" /></button>
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-1.5 left-3 z-10 text-[10px] text-zinc-600">Kartendaten © Natural Earth · Spielprojektion {game === 'ets2' ? 'ETS2' : 'ATS'}</div>
    </div>
  );
});
