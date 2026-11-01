/**
 * SPUZL sound palette: the pure, testable half of the sound kit (no WebAudio here).
 *
 * Three layers of names resolve to one synth voice:
 *   1. Voices (SfxName): the synth recipes in voices.ts.
 *   2. Handoff aliases (tick_soft, buzz_low...): the names in the original sound map.
 *   3. Palette events (tap, clear, levelUp...): what a feature means. New code should use these.
 *
 * Design rules for every voice: short (most under 250 ms), warm (soft attacks, low-passed edges, a gentle
 * high-shelf cut on the master), layered (a transient for definition plus a body for weight, with a
 * 150 Hz+ harmonic so lows still read on phone speakers) and never identical twice (tiny pitch and level
 * variation per play).
 */

export const VOICES = [
  "tick",
  "pop",
  "buzz",
  "chime",
  "twinkle",
  "jingle",
  "fanfare",
  "whoosh",
  "swoosh",
  "fizzle",
  "clink",
  "coins",
  "cheer",
  "splat",
  "drum",
  "horn",
  "hop",
  "emote",
  "sting",
  "bump",
  "clack",
  "capture",
  "check",
  "synth",
  "jump",
  "land",
  "spike",
  // Palette additions
  "toggle",
  "success",
  "streak",
  "notify",
  "nav",
  "sheet_open",
  "sheet_close",
  "count",
  "win",
  "lose",
  "join",
  // Logo intro
  "rush",
  "thump",
  "letter",
  "spuzpop",
] as const;

export type SfxName = (typeof VOICES)[number];

/** Handoff spec names mapped onto kit names. */
export const ALIASES: Record<string, SfxName> = {
  tick_soft: "tick",
  buzz_low: "buzz",
  win_jingle: "jingle",
  coin_ticks: "coins",
  crowd_cheer: "cheer",
  pass_swoosh: "swoosh",
  sting_short: "sting",
  emote_pop: "emote",
  synth_rise: "synth",
  fail_soft: "fizzle",
};

/** What each product event sounds like. Keep this table and the report in sync. */
export const PALETTE = {
  /** any button or chip press: a soft wooden tap */
  tap: "tick",
  /** switch flipped: two tiny clicks, rising for on, falling for off (step 1 = on) */
  toggle: "toggle",
  /** a cell, tile or piece placed: rounded blip that climbs with the correct-move streak */
  place: "pop",
  /** small win (correct answer, quest claimed, purchase done): two-note lift */
  success: "success",
  /** puzzle cleared: four-note major arpeggio */
  clear: "jingle",
  /** big celebration (full clear, party winner): airy crowd swell with a bright chord */
  celebrate: "cheer",
  /** rule break or wrong answer: short low-passed double buzz, felt more than heard */
  error: "buzz",
  /** hint revealed: three sparkling notes panned left to right */
  hint: "twinkle",
  /** XP or Sparks counted in: quick alternating coin ticks */
  reward: "coins",
  /** streak kept or extended: rising whoosh with a warm two-note tail */
  streak: "streak",
  /** level or rank up: brass-like triad then a held chord */
  levelUp: "fanfare",
  /** badge or item unlocked: glassy clink */
  unlock: "clink",
  /** in-app notification or toast: soft two-tone ding */
  notify: "notify",
  /** tab or page switch: very short low tick, quieter than tap */
  nav: "nav",
  /** sheet or dialog opens: short upward air */
  sheetOpen: "sheet_open",
  /** sheet or dialog closes: short downward air */
  sheetClose: "sheet_close",
  /** countdown 3, 2, 1 (step = number left; 0 = go, higher and brighter) */
  countdown: "count",
  /** duel or ghost race won */
  duelWin: "win",
  /** duel or ghost race lost: gentle falling pair, never mocking */
  duelLose: "lose",
  /** someone joined the party lobby: two-note bubble */
  partyJoin: "join",
  /** logo intro: the Z flying in from the right (pass duration and pan) */
  introSwoosh: "rush",
  /** logo intro: the Z landing in its notch */
  introThump: "thump",
  /** logo intro: each letter landing (step = letter index) */
  letterLand: "letter",
  /** logo intro: Spuz popping out */
  spuzPop: "spuzpop",
} as const satisfies Record<string, SfxName>;

export type PaletteEvent = keyof typeof PALETTE;

/** Audible length per voice in ms (tail included). Frees the voice slot; also the default for unknowns. */
export const LENGTH_MS: Record<SfxName, number> = {
  tick: 60,
  pop: 110,
  buzz: 220,
  chime: 400,
  twinkle: 420,
  jingle: 760,
  fanfare: 1250,
  whoosh: 360,
  swoosh: 260,
  fizzle: 520,
  clink: 460,
  coins: 420,
  cheer: 1150,
  splat: 200,
  drum: 300,
  horn: 720,
  hop: 110,
  emote: 140,
  sting: 560,
  bump: 420,
  clack: 80,
  capture: 130,
  check: 360,
  synth: 100,
  jump: 130,
  land: 90,
  spike: 160,
  toggle: 90,
  success: 320,
  streak: 620,
  notify: 380,
  nav: 50,
  sheet_open: 200,
  sheet_close: 170,
  count: 200,
  win: 900,
  lose: 620,
  join: 220,
  rush: 450,
  thump: 380,
  letter: 90,
  spuzpop: 160,
};

/**
 * Pitch wobble per voice in cents. Percussive and noisy voices vary more; tuned phrases (jingles,
 * fanfares) barely move so chords stay in tune with each other.
 */
export const VARIATION_CENTS: Partial<Record<SfxName, number>> = {
  tick: 60,
  nav: 50,
  clack: 70,
  capture: 50,
  pop: 25,
  letter: 30,
  land: 60,
  splat: 60,
  thump: 20,
  rush: 40,
  swoosh: 60,
  whoosh: 60,
  sheet_open: 50,
  sheet_close: 50,
  toggle: 30,
  hop: 30,
  emote: 30,
  spuzpop: 30,
};
const DEFAULT_CENTS = 8;

/** Max simultaneous voices. Extra plays are dropped, never queued (a late sound is worse than none). */
export const MAX_VOICES = 6;
/** The same voice retriggered inside this window is dropped (stops doubled ticks from two listeners). */
export const RETRIGGER_MS = 30;

export function resolve(name: string): SfxName | null {
  if ((VOICES as readonly string[]).includes(name)) return name as SfxName;
  if (name in PALETTE) return PALETTE[name as PaletteEvent];
  return ALIASES[name] ?? null;
}

/** Per-play variation: a pitch rate (1 = unchanged) and a level multiplier, both centred on 1. */
export function variation(name: SfxName, rand: () => number = Math.random) {
  const cents = VARIATION_CENTS[name] ?? DEFAULT_CENTS;
  const rate = Math.pow(2, ((rand() * 2 - 1) * cents) / 1200);
  const gain = 1 + (rand() * 2 - 1) * 0.08; // about ±0.7 dB
  return { rate, gain };
}

/** Voice gate: whether a new play of `name` at time `now` (ms) may start. Pure, so it can be unit tested. */
export function canStart(state: { active: number; last: Partial<Record<SfxName, number>> }, name: SfxName, now: number) {
  if (state.active >= MAX_VOICES) return false;
  const prev = state.last[name];
  if (prev !== undefined && now - prev < RETRIGGER_MS) return false;
  return true;
}

/** Clamps a stereo position to [-1, 1]; non-finite becomes centre. */
export function clampPan(p: number | undefined) {
  if (p === undefined || !Number.isFinite(p)) return 0;
  return Math.max(-1, Math.min(1, p));
}
