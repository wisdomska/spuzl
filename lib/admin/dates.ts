/** GMT date helpers for the admin console (ISO yyyy-mm-dd strings). Pure. */
export const DAY_MS = 86_400_000;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);

/** Monday of the week holding `iso` (GMT). */
export function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const back = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -back);
}

/** ISO 8601 week number. */
export function isoWeek(iso: string): number {
  const d = new Date(iso + "T00:00:00Z");
  const thursday = new Date(d.getTime() + (3 - ((d.getUTCDay() + 6) % 7)) * DAY_MS);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / 7);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mon 3" */
export const shortDay = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
};
/** "Sat 8 Nov" */
export const dayMonth = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
/** "3 to 9 Nov" (or "29 Oct to 4 Nov") */
export function weekRange(monday: string): string {
  const a = new Date(monday + "T00:00:00Z");
  const b = new Date(addDays(monday, 6) + "T00:00:00Z");
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()} to ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
    : `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} to ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
}

/** Compact age: "12m", "3h", "2d". */
export function age(fromIso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - Date.parse(fromIso)) / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** "1:44" from ms */
export const clock = (ms: number | null | undefined) => {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** 212000 -> "212k", 61200 -> "61.2k", 18402 -> "18,402" */
export function compact(n: number): string {
  if (n >= 100_000) return `${Math.round(n / 1000)}k`;
  if (n >= 20_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("en-US");
}
