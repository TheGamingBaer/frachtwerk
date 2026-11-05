import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { compact, num } from '../lib/format';

/** Fehlende Tage auffüllen, damit Verläufe lückenlos sind */
export function fillDays(rows: any[], days = 30, keys: string[] = ['km']) {
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: any[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
    const k = d.toISOString().slice(0, 10);
    const r = map.get(k) || {};
    out.push({ day: k, label: `${k.slice(8, 10)}.${k.slice(5, 7)}.`, ...Object.fromEntries(keys.map((x) => [x, r[x] || 0])) });
  }
  return out;
}

function Tip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-ink-800/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 text-zinc-500">{payload[0]?.payload?.label ?? label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-zinc-200">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
          <span className="text-zinc-400">{p.name}</span><span className="ml-auto font-mono font-semibold">{num(p.value)}{unit?.[p.dataKey] ?? ''}</span>
        </div>
      ))}
    </div>
  );
}

export function AreaTrend({ data, series, height = 240 }: { data: any[]; series: { key: string; name: string; color: string; unit?: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.35} /><stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis yAxisId="l" tickLine={false} axisLine={false} tickFormatter={compact} width={44} />
        <YAxis yAxisId="r" orientation="right" hide />
        <Tooltip content={<Tip unit={Object.fromEntries(series.map((s) => [s.key, s.unit || '']))} />} />
        {series.map((s, i) => (
          <Area key={s.key} yAxisId={i === 0 ? 'l' : 'r'} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, dataKey, nameKey, color = '#ff8a1f', height = 220, unit = '' }: { data: any[]; dataKey: string; nameKey: string; color?: string; height?: number; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data.map((d) => ({ ...d, label: d[nameKey] }))} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={compact} width={44} />
        <Tooltip content={<Tip unit={{ [dataKey]: unit }} />} />
        <Bar dataKey={dataKey} name={dataKey} radius={[6, 6, 0, 0]} maxBarSize={36}>
          {data.map((_, i) => <Cell key={i} fill={color} fillOpacity={0.45 + (0.55 * (i + 1)) / data.length} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GroupedBars({ data, series, height = 240 }: { data: any[]; series: { key: string; name: string; color: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={compact} width={44} />
        <Tooltip content={<Tip unit={Object.fromEntries(series.map((s) => [s.key, ' €']))} />} />
        {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[6, 6, 0, 0]} maxBarSize={22} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

const PIE = ['#ff8a1f', '#22d3ee', '#a78bfa', '#34d399', '#f472b6', '#facc15'];
export function Donut({ data, dataKey, nameKey, height = 200 }: { data: any[]; dataKey: string; nameKey: string; height?: number }) {
  const total = data.reduce((s, d) => s + (d[dataKey] || 0), 0);
  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius="68%" outerRadius="100%" stroke="none" paddingAngle={3} cornerRadius={4}>
              {data.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div><div className="font-display text-2xl font-semibold text-white">{num(total)}</div><div className="text-[10px] uppercase tracking-widest text-zinc-500">Touren</div></div>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PIE[i % PIE.length] }} />
            <span className="truncate text-zinc-300">{d[nameKey]}</span>
            <span className="ml-auto font-mono text-xs text-zinc-500">{Math.round(((d[dataKey] || 0) / (total || 1)) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
