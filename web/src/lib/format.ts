const de = 'de-DE';
export const eur = (n: number, digits = 0) =>
  new Intl.NumberFormat(de, { style: 'currency', currency: 'EUR', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n || 0);
export const num = (n: number, digits = 0) => new Intl.NumberFormat(de, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n || 0);
export const km = (n: number) => `${num(n)} km`;
export const compact = (n: number) => new Intl.NumberFormat(de, { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

/** SQLite liefert UTC "YYYY-MM-DD HH:MM:SS" */
export const parseDate = (s?: string | null) => (s ? new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z') : null);
export const date = (s?: string | null) => parseDate(s)?.toLocaleDateString(de, { day: '2-digit', month: '2-digit', year: 'numeric' }) ?? '–';
export const dateTime = (s?: string | null) =>
  parseDate(s)?.toLocaleString(de, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) ?? '–';
export const monthName = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(de, { month: 'long', year: 'numeric' });
};
export function ago(s?: string | null) {
  const d = parseDate(s); if (!d) return '–';
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 0) {
    const f = -sec;
    if (f < 3600) return `in ${Math.round(f / 60)} Min.`;
    if (f < 86400) return `in ${Math.round(f / 3600)} Std.`;
    return `in ${Math.round(f / 86400)} Tagen`;
  }
  if (sec < 60) return 'gerade eben';
  if (sec < 3600) return `vor ${Math.round(sec / 60)} Min.`;
  if (sec < 86400) return `vor ${Math.round(sec / 3600)} Std.`;
  if (sec < 86400 * 30) return `vor ${Math.round(sec / 86400)} Tagen`;
  return date(s);
}
export const ROLE_LABEL: Record<string, string> = { owner: 'Inhaber', admin: 'Admin', dispatcher: 'Disponent', driver: 'Fahrer' };
export const RANK: Record<string, number> = { driver: 1, dispatcher: 2, admin: 3, owner: 4 };
export const can = (role: string | undefined, min: string) => !!role && RANK[role] >= RANK[min];
