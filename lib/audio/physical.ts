/**
 * Physically modelled board-game sounds (modal synthesis). A real knock is a very short contact transient that
 * excites a handful of damped resonances: the piece's own modes (small and stiff, so high: 1 to 4 kHz, dying in
 * 15 to 45 ms) and the board's panel modes (big and soft, so low: 150 to 700 Hz, ringing up to about 120 ms).
 * Wood is heavily damped, which is why nothing here rings: decays are given as T60 (time to fall 60 dB) and taken
 * from typical values for hardwood pieces, felt pads, plastic counters and seed pods.
 *
 * Every strike jitters its mode frequencies and levels a little (no two pieces, squares or throws sound the
 * same), and anything below 200 Hz has a partner an octave up so it still reads on phone speakers.
 */
import { N, noise, type Kit } from "./voices";

/** One resonance: frequency (Hz), T60 decay (s) and level. */
export interface Mode {
  f: number;
  d: number;
  g: number;
}

const jit = (x: number, amount: number) => x * (1 + (Math.random() * 2 - 1) * amount);

/** Rings a set of modes from time t with a near-instant attack and exponential (natural) decay. */
export function ring(k: Kit, t: number, modes: Mode[], o: { jitter?: number; level?: number } = {}) {
  const { a } = k;
  const level = o.level ?? 1;
  const jitter = o.jitter ?? 0.03;
  for (const m of modes) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(jit(m.f, jitter) * k.rate, t);
    const peak = jit(m.g, 0.12) * level;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.0008);
    // T60 = 6.91 time constants.
    g.gain.setTargetAtTime(0, t + 0.0008, m.d / 6.91);
    osc.connect(g);
    g.connect(k.out);
    osc.start(t);
    osc.stop(t + m.d + 0.05);
  }
}

/** The contact itself: a few ms of band-limited noise. Felt and soft materials lower `freq` and shorten it. */
export function contact(k: Kit, t: number, o: { freq: number; q?: number; dur?: number; gain: number; type?: BiquadFilterType }) {
  noise(k, t, o.dur ?? 0.004, { freq: o.freq, q: o.q ?? 1, gain: o.gain, attack: 0.0005, type: o.type ?? "bandpass" });
}

/* ---------------- Chess: weighted boxwood pieces with felt pads on a wooden board ---------------- */

// Levels tuned against measurements: the energy centre sits near 1 kHz like a real "tok", with the 165 Hz panel
// mode kept as weight underneath rather than a boom (phone speakers barely play below 250 Hz anyway).
const BOARD: Mode[] = [
  { f: 165, d: 0.08, g: 0.055 },
  { f: 334, d: 0.06, g: 0.05 },
  { f: 612, d: 0.055, g: 0.1 },
  { f: 830, d: 0.045, g: 0.085 },
  { f: 1040, d: 0.035, g: 0.07 },
];
const PIECE: Mode[] = [
  { f: 1730, d: 0.03, g: 0.06 },
  { f: 2890, d: 0.02, g: 0.03 },
];

/** A piece set down: the felt softens the contact, so most of what you hear is the board's dull "tok". */
export function piecePlace(k: Kit, t: number, weight = 1) {
  contact(k, t, { freq: 2600, q: 0.9, dur: 0.006, gain: 0.2 * weight });
  contact(k, t, { freq: 900, type: "lowpass", dur: 0.012, gain: 0.1 * weight });
  ring(k, t, BOARD, { level: weight });
  ring(k, t, PIECE, { level: weight, jitter: 0.05 });
}

/** A piece picked up: felt leaving the board and the faintest wooden tick. Barely there, like the real thing. */
export function pieceLift(k: Kit, t: number) {
  noise(k, t, 0.05, { freq: 1700, type: "lowpass", gain: 0.08, attack: 0.015 });
  contact(k, t + 0.012, { freq: 3100, q: 2, dur: 0.004, gain: 0.07 });
  ring(k, t + 0.012, [{ f: 2200, d: 0.015, g: 0.025 }]);
}

/** Capture: the moving piece knocks the taken one (hard wood on wood), it tips over, then the move lands. */
export function pieceCapture(k: Kit, t: number) {
  contact(k, t, { freq: 3800, q: 1.2, dur: 0.004, gain: 0.28 });
  ring(k, t, [
    { f: 1480, d: 0.035, g: 0.11 },
    { f: 2350, d: 0.028, g: 0.075 },
    { f: 3720, d: 0.02, g: 0.045 },
    { f: 820, d: 0.04, g: 0.06 },
  ]);
  // the taken piece toppling onto its side
  contact(k, t + 0.055, { freq: 2200, q: 1, dur: 0.005, gain: 0.09 });
  ring(k, t + 0.055, [
    { f: 1250, d: 0.03, g: 0.045 },
    { f: 240, d: 0.06, g: 0.05 },
  ]);
  piecePlace(k, t + 0.095, 1.05);
}

/** Castling: king then rook, a beat apart. */
export function castle(k: Kit, t: number) {
  piecePlace(k, t, 1);
  piecePlace(k, t + 0.12, 0.85);
}

/** Check: a firm placement and, after it, a low muted wood-block knock so it reads without words. */
export function pieceCheck(k: Kit, t: number) {
  piecePlace(k, t, 1.2);
  // wood block (ratios of a struck block: 1, 2.57, 4.2), low and short
  ring(
    k,
    t + 0.14,
    [
      { f: 560, d: 0.09, g: 0.09 },
      { f: 1440, d: 0.05, g: 0.035 },
      { f: 2350, d: 0.03, g: 0.015 },
    ],
    { jitter: 0.01 },
  );
  contact(k, t + 0.14, { freq: 1800, q: 1, dur: 0.004, gain: 0.08 });
}

/* ---------------- Draughts: flat wooden discs, no felt ---------------- */

const DISC: Mode[] = [
  { f: 1350, d: 0.03, g: 0.075 },
  { f: 2480, d: 0.022, g: 0.055 },
  { f: 3900, d: 0.015, g: 0.03 },
];
const DISC_BOARD: Mode[] = [
  { f: 185, d: 0.07, g: 0.06 },
  { f: 372, d: 0.05, g: 0.05 },
  { f: 690, d: 0.045, g: 0.1 },
  { f: 960, d: 0.035, g: 0.07 },
];

/** A disc set down: a brighter clack than chess, and a flat disc lands edge first then slaps flat (two hits). */
export function discPlace(k: Kit, t: number, weight = 1) {
  contact(k, t, { freq: 3200, q: 1, dur: 0.004, gain: 0.24 * weight });
  ring(k, t, DISC_BOARD, { level: weight });
  ring(k, t, DISC, { level: weight, jitter: 0.04 });
  const slap = t + jit(0.016, 0.2);
  contact(k, slap, { freq: 2400, q: 1, dur: 0.004, gain: 0.08 * weight });
  ring(k, slap, DISC_BOARD.slice(0, 2), { level: 0.35 * weight });
}

/** Disc on disc: higher and glassier than disc on board. */
function clink(k: Kit, t: number, level = 1) {
  contact(k, t, { freq: 4500, q: 1.4, dur: 0.003, gain: 0.16 * level });
  ring(
    k,
    t,
    [
      { f: 2100, d: 0.04, g: 0.08 },
      { f: 3350, d: 0.03, g: 0.055 },
      { f: 5200, d: 0.02, g: 0.025 },
    ],
    { level, jitter: 0.04 },
  );
}

/** A jump: the jumping disc lands, then the taken disc is dropped on the pile. */
export function discCapture(k: Kit, t: number) {
  discPlace(k, t);
  clink(k, t + 0.08, 0.9);
  clink(k, t + 0.08 + 0.022, 0.3);
}

/** Crowning: a disc stacked on the one that reached the end, settling with a small rattle. */
export function discCrown(k: Kit, t: number) {
  clink(k, t, 1.1);
  clink(k, t + 0.024, 0.45);
  clink(k, t + 0.04, 0.18);
}

/* ---------------- Oware: hard seeds into carved wooden pits ---------------- */

/** One seed into a pit: a sharp tiny click, the hollow of the cup, and a couple of shrinking bounces. */
export function seedDrop(k: Kit, t: number, level = 1) {
  let at = t;
  let gap = jit(0.024, 0.25);
  let e = level;
  for (let i = 0; i < 3 && e > 0.08; i++) {
    contact(k, at, { freq: jit(5200, 0.15), q: 1.5, dur: 0.003, gain: 0.22 * e });
    ring(
      k,
      at,
      [
        { f: 820, d: 0.05, g: 0.075 },
        { f: 1960, d: 0.035, g: 0.065 },
        { f: 3100, d: 0.02, g: 0.045 },
      ],
      { level: e, jitter: 0.06 },
    );
    // restitution about 0.6: each bounce is shorter and has a third of the energy
    at += gap;
    gap *= 0.6;
    e *= 0.36;
  }
}

/** Capture: a hand scooping a pile of seeds out of a pit. */
export function seedScoop(k: Kit, t: number) {
  noise(k, t, 0.2, { freq: 1200, type: "lowpass", gain: 0.07, attack: 0.04 });
  for (let i = 0; i < 9; i++) {
    const at = t + Math.random() * 0.18;
    contact(k, at, { freq: jit(4200, 0.25), q: 1.4, dur: 0.003, gain: jit(0.13, 0.4) });
    ring(k, at, [{ f: jit(2600, 0.2), d: 0.02, g: 0.02 }], { jitter: 0 });
  }
}

/* ---------------- Ludo: a plastic die and plastic tokens ---------------- */

/** A die thrown on the board: bounces with restitution about 0.55 (each gap and level shrinks), then rolls still. */
export function diceRoll(k: Kit, t: number) {
  noise(k, t + 0.02, 0.36, { freq: 1900, type: "lowpass", gain: 0.03, attack: 0.05 });
  let at = t;
  let gap = jit(0.11, 0.15);
  let e = 1;
  for (let i = 0; i < 8 && e > 0.04; i++) {
    contact(k, at, { freq: jit(3800, 0.15), q: 1.2, dur: 0.003, gain: 0.2 * e });
    ring(
      k,
      at,
      [
        { f: 2600, d: 0.025, g: 0.06 },
        { f: 4100, d: 0.018, g: 0.03 },
        { f: 240, d: 0.06, g: 0.08 },
        { f: 480, d: 0.04, g: 0.03 },
      ],
      { level: e, jitter: 0.08 },
    );
    at += gap;
    gap *= 0.62;
    e *= 0.55;
  }
}

/** A token hopping one square: a light plastic tap. */
export function tokenStep(k: Kit, t: number) {
  contact(k, t, { freq: 3000, q: 1.2, dur: 0.003, gain: 0.12 });
  ring(
    k,
    t,
    [
      { f: 1900, d: 0.02, g: 0.055 },
      { f: 300, d: 0.04, g: 0.06 },
      { f: 600, d: 0.03, g: 0.02 },
    ],
    { jitter: 0.05 },
  );
}

/* ---------------- Four Up: a plastic disc dropped down an upright grid ---------------- */

/**
 * The disc rattles down `rows` slots (spaced as a falling object: the time to fall i rows grows with √i) and lands
 * on the stack with a plastic clack.
 */
export function columnDrop(k: Kit, t: number, rows = 3) {
  const n = Math.max(0, Math.min(6, Math.round(rows)));
  const fall = (i: number) => 0.045 * Math.sqrt(i);
  for (let i = 1; i <= n; i++) {
    const at = t + fall(i) - fall(1);
    contact(k, at, { freq: jit(3600, 0.1), q: 1.6, dur: 0.002, gain: 0.03 + 0.008 * i });
  }
  const land = t + Math.max(0, fall(n + 1) - fall(1));
  contact(k, land, { freq: 3500, q: 1, dur: 0.004, gain: 0.24 });
  ring(
    k,
    land,
    [
      { f: 1700, d: 0.035, g: 0.11 },
      { f: 2900, d: 0.025, g: 0.065 },
      { f: 420, d: 0.05, g: 0.09 },
      { f: 840, d: 0.035, g: 0.03 },
    ],
    { jitter: 0.04 },
  );
}

/* ---------------- Puzzle tiles: a small wooden bar, tuned ---------------- */

/** Pentatonic steps for the climbing correct-move streak. */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];

/**
 * A tile put down in a puzzle: a soft mallet on a short wooden bar (marimba-style overtones at 1 : 4 : 10), so it
 * sounds like a real object but still climbs with the streak.
 */
export function tile(k: Kit, t: number, step = 0) {
  const f = N(72 + SCALE[Math.min(SCALE.length - 1, step)]);
  contact(k, t, { freq: 2400, q: 0.8, dur: 0.005, gain: 0.06 });
  ring(
    k,
    t,
    [
      { f, d: 0.19, g: 0.12 },
      { f: f * 3.98, d: 0.07, g: 0.03 },
      { f: f * 9.9, d: 0.03, g: 0.01 },
      { f: f / 2, d: 0.08, g: 0.03 },
    ],
    { jitter: 0.002 },
  );
}

/* ---------------- Generic: a wooden block or counter moved and stopped ---------------- */

/** A small wooden block sliding a little and knocking to a stop (Trotro cars, tiles, counters). */
export function blockKnock(k: Kit, t: number) {
  noise(k, t, 0.045, { freq: 1400, type: "lowpass", gain: 0.035, attack: 0.02 });
  const stop = t + 0.035;
  contact(k, stop, { freq: 2900, q: 1, dur: 0.004, gain: 0.18 });
  ring(
    k,
    stop,
    [
      { f: 640, d: 0.05, g: 0.08 },
      { f: 1180, d: 0.035, g: 0.07 },
      { f: 2240, d: 0.025, g: 0.045 },
      { f: 210, d: 0.06, g: 0.04 },
    ],
    { jitter: 0.05 },
  );
}
