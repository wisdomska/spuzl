/**
 * Age from birth month and year (no day is ever asked or kept). One rule, mirrored by the SQL function
 * `public.age_band_of(year, month, today)` (migration 20261119000001_birth_month_year.sql); keep both in step.
 *
 * Without a day we cannot know when in the birth month the birthday falls, so we take the careful reading:
 * a player turns a year older on the 1st of the month AFTER their birth month. Born March 2010: 15 through
 * 31 March 2026, 16 from 1 April 2026. Bands therefore only ever change on the 1st of a month (GMT).
 *
 * Bands: under 13 has no band (SPUZL is 13 and up; no profile is made), 13 to 15, 16 to 17, 18 and older.
 */
export type AgeBand = "13-15" | "16-17" | "18+";
export const AGE_BANDS: readonly AgeBand[] = ["13-15", "16-17", "18+"];
export const MIN_AGE = 13;
/** Oldest birth year offered and accepted, counted back from the current year. */
export const MAX_AGE_YEARS = 100;

const ymOf = (today: Date) => ({ y: today.getUTCFullYear(), m: today.getUTCMonth() + 1 });

/** Whole years of age on `today` (GMT), counting the birthday as the 1st of the month after the birth month. */
export function ageOn(birthYear: number, birthMonth: number, today: Date = new Date()): number {
  const { y, m } = ymOf(today);
  return y - birthYear - (m <= birthMonth ? 1 : 0);
}

/** The band for this birth month and year on `today`; null when under 13 (or the input is missing). */
export function ageBandOf(
  birthYear: number | null | undefined,
  birthMonth: number | null | undefined,
  today: Date = new Date(),
): AgeBand | null {
  if (birthYear == null || birthMonth == null) return null;
  const age = ageOn(birthYear, birthMonth, today);
  if (age < MIN_AGE) return null;
  if (age < 16) return "13-15";
  if (age < 18) return "16-17";
  return "18+";
}

/** Younger bands rank lower. Unknown bands rank lowest, so they get the most careful rules. */
export const bandRank = (band: string | null | undefined) => AGE_BANDS.indexOf(band as AgeBand);

/** Why a birth month and year can't be accepted at all (shape, future, too far back); null when it can. */
export function birthProblem(birthYear: number, birthMonth: number, today: Date = new Date()): "invalid" | "future" | null {
  const { y, m } = ymOf(today);
  if (!Number.isInteger(birthYear) || !Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) return "invalid";
  if (birthYear < y - MAX_AGE_YEARS) return "invalid";
  if (birthYear > y || (birthYear === y && birthMonth > m)) return "future";
  return null;
}

/**
 * R2-09: the birth step's 4-digit year field. Keeps digits only (pasted spaces, a stray letter) and at most four;
 * `year` is set once all four are there, else null (Continue waits). Range checks stay with birthProblem and the
 * age gate, so an under-13 year is still accepted here and then turned away honestly by the band check.
 */
export function readYearInput(text: string): { text: string; year: number | null } {
  const digits = text.replace(/\D/g, "").slice(0, 4);
  return { text: digits, year: digits.length === 4 ? Number(digits) : null };
}

/** Years for the picker, newest first: this year back to MAX_AGE_YEARS ago. */
export function birthYears(today: Date = new Date()): number[] {
  const { y } = ymOf(today);
  return Array.from({ length: MAX_AGE_YEARS + 1 }, (_, i) => y - i);
}

/**
 * The band the rules use for a stored player row: derived from birth month and year when they are kept, else
 * the stored band (players from before birth month and year were asked, until they add theirs).
 */
export function effectiveBand(
  row: { age_band?: string | null; birth_year?: number | null; birth_month?: number | null },
  today: Date = new Date(),
): string {
  return ageBandOf(row.birth_year, row.birth_month, today) ?? row.age_band ?? "13-15";
}
