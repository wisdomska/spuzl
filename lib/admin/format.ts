/** Human number formats for the admin console (admin overhaul B). Pure. */

/** 1234 -> "1,234". */
export const count = (n: number) => Math.round(n).toLocaleString("en-US");
/** 45.4 -> "45%"; between 0 and 0.5 -> "under 1%"; null -> null. */
export const percent = (p: number | null): string | null => (p === null ? null : p > 0 && p < 0.5 ? "under 1%" : `${Math.round(p)}%`);

/** A duration in words: "0.4 s", "12 s", "1 min 20 s", "2 h 5 min", "3 days". Null for nothing measured. */
export function duration(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 10_000) return `${(Math.round(ms / 100) / 10).toFixed(1)} s`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  }
  if (s < 48 * 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  return `${Math.round(s / 86_400)} days`;
}
