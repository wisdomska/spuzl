/**
 * Glicko-2 (Glickman 2012). Ratings per world and for Duels (SRS 4.3).
 * Daily performances are scored against the day's field: beating the median ≈ a win vs a 1500 player.
 */
export interface Rating {
  rating: number;
  rd: number;
  vol: number;
}
export interface Result {
  opponent: Rating;
  /** 1 win, 0.5 draw, 0 loss */
  score: number;
}

const SCALE = 173.7178;
const TAU = 0.5;
const EPS = 0.000001;

export const DEFAULT_RATING: Rating = { rating: 1000, rd: 350, vol: 0.06 };

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muj: number, phij: number) => 1 / (1 + Math.exp(-g(phij) * (mu - muj)));

export function update(player: Rating, results: Result[]): Rating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  if (!results.length) {
    const phiStar = Math.sqrt(phi * phi + player.vol * player.vol);
    return { rating: player.rating, rd: Math.min(350, phiStar * SCALE), vol: player.vol };
  }
  let vInv = 0;
  let deltaSum = 0;
  for (const r of results) {
    const muj = (r.opponent.rating - 1500) / SCALE;
    const phij = r.opponent.rd / SCALE;
    const e = E(mu, muj, phij);
    vInv += g(phij) ** 2 * e * (1 - e);
    deltaSum += g(phij) * (r.score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;
  // volatility (Illinois algorithm)
  const a = Math.log(player.vol ** 2);
  const f = (x: number) =>
    (Math.exp(x) * (delta ** 2 - phi ** 2 - v - Math.exp(x))) / (2 * (phi ** 2 + v + Math.exp(x)) ** 2) - (x - a) / TAU ** 2;
  let A = a;
  let B: number;
  if (delta ** 2 > phi ** 2 + v) B = Math.log(delta ** 2 - phi ** 2 - v);
  else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPS) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  const vol = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi ** 2 + vol ** 2);
  const phiNew = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / v);
  const muNew = mu + phiNew ** 2 * deltaSum;
  return { rating: muNew * SCALE + 1500, rd: Math.max(30, phiNew * SCALE), vol };
}

/**
 * Turns a Daily performance into a Glicko result: percentile p (0..100) vs a virtual 1500 field.
 * Accuracy matters: each hint or mistake costs 5 percentile points.
 */
export function dailyResult(percentile: number, hints: number, mistakes: number): Result {
  const adj = Math.max(0, Math.min(100, percentile - 5 * (hints + mistakes)));
  return { opponent: { rating: 1500, rd: 120, vol: 0.06 }, score: adj / 100 };
}

/**
 * Free play moves world ranks at half the weight of a Daily: boards are unique per player, so the field is
 * recent free-play clears of the same game and difficulty rather than everyone on the same puzzle.
 */
export const FREE_PLAY_WEIGHT = 0.5;

/** Moves a rating only part of the way from `before` to the full Glicko-2 result `after` (0 = no change, 1 = full). */
export function weighted(before: Rating, after: Rating, weight: number): Rating {
  const w = Math.max(0, Math.min(1, weight));
  return {
    rating: before.rating + w * (after.rating - before.rating),
    rd: before.rd + w * (after.rd - before.rd),
    vol: before.vol + w * (after.vol - before.vol),
  };
}

/** Rank names (SRS 4.3), each with divisions III, II, I. */
export const RANKS = [
  { name: "Rookie", min: -Infinity, emblem: "pebble" },
  { name: "Thinker", min: 1000, emblem: "spark" },
  { name: "Solver", min: 1200, emblem: "gear" },
  { name: "Strategist", min: 1400, emblem: "compass" },
  { name: "Mastermind", min: 1600, emblem: "crown" },
  { name: "Legend", min: 1800, emblem: "prism" },
] as const;

export function rankFor(rating: number): { name: string; division: "III" | "II" | "I" | ""; emblem: string } {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (rating >= RANKS[i].min) idx = i;
  const r = RANKS[idx];
  if (r.name === "Legend") return { name: r.name, division: "", emblem: r.emblem };
  const lo = idx === 0 ? 700 : r.min;
  const span = 200;
  const third = Math.min(2, Math.max(0, Math.floor(((rating - lo) / span) * 3)));
  return { name: r.name, division: (["III", "II", "I"] as const)[third], emblem: r.emblem };
}

const tierIndex = (rating: number) => {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (rating >= RANKS[i].min) idx = i;
  return idx;
};

/**
 * A single result moves a player at most one rank (SPZ-26): a big jump from Thinker lands at the top of
 * Solver, never straight in Strategist; a big drop lands at the bottom of the rank below.
 */
export function clampOneTier(before: number, after: number): number {
  const from = tierIndex(before);
  const to = tierIndex(after);
  if (to > from + 1) return RANKS[from + 2].min - 0.01;
  if (to < from - 1) return RANKS[from - 1].min;
  return after;
}
