/**
 * SPUZL sound kit. Recorded effects (public/sfx, lib/audio/samples.ts) once loaded, with the WebAudio synth recipes
 * in voices.ts as the instant fallback;
 * the palette (event → voice, lengths, variation) in palette.ts.
 * play(name, opts) plays the sound and fires the paired haptic, respecting settings.
 *
 * Signal chain: voice → per-play gain (level variation) → optional panner → SFX bus → master
 *   → 30 Hz high-pass (rumble) → high-shelf −3 dB at 6 kHz (warmth) → glue compressor → brick-wall limiter.
 *
 * - Names resolve through palette events (tap, clear...), Handoff aliases (tick_soft...) or voice names.
 * - At most MAX_VOICES overlap at any instant (clear, win, error and thump may exceed it); extra plays
 *   are dropped, never queued. The same voice retriggered within RETRIGGER_MS is dropped too.
 * - Audio unlocks on the first user gesture only (autoplay rules). While locked, play() is silent and
 *   never throws; a context the browser left suspended is skipped rather than allowed to burst later.
 * - Optional per-world music loops, off by default, ducked during celebrations, disabled in low-data mode.
 * - Every play dispatches a `spuzl:fx` event so E2E tests can assert sound + haptic pairing.
 */
import { haptic, HAPTICS } from "@/lib/haptics";
import { canStart, clampPan, LENGTH_MS, prune, resolve, variation, type Scheduled } from "./palette";
import { RECIPES, type Kit } from "./voices";
import type { MusicPlayer, StyleId } from "./music";
import { createRecordedPlayer } from "./recorded";
import { loadSamples, sampleFor, sampleRate, wantSample } from "./samples";

/** Music sits well under the sound effects. */
const MUSIC_LEVEL = 0.32;

export { ALIASES, PALETTE, VOICES, resolve, type PaletteEvent, type SfxName } from "./palette";

export interface PlayOptions {
  /** pitch step: correct-move streak for pop (cap +7), letter index for chime/letter, line length for synth,
   * 1/0 for toggle on/off, numbers left for countdown (0 = go) */
  step?: number;
  /** skip the paired haptic (caller fires its own) */
  silentHaptic?: boolean;
  /** schedule this many seconds ahead on the audio clock (sample-accurate; the haptic follows by timer) */
  delay?: number;
  /** length in seconds for voices that stretch to match motion (rush, swoosh) */
  duration?: number;
  /** stereo start position, −1 left to 1 right */
  pan?: number;
  /** stereo end position, ramped over the sound's duration */
  panTo?: number;
  /** level multiplier, 0 to 1 */
  gain?: number;
}

interface Runtime {
  /** let other apps' audio keep playing (iPhone: SPUZL then follows the silent switch) */
  mixOthers?: boolean;
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  lowData: boolean;
}

const runtime: Runtime = { sfx: true, music: false, haptics: true, lowData: false };

/**
 * iPhone audio session. "playback": game sound plays even with the silent switch on (it may pause other apps' audio).
 * "ambient": mixes with other apps' audio (Spotify keeps playing) and follows the silent switch. The player picks in
 * Settings; playback is the default.
 */
function applyAudioSession() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = runtime.mixOthers ? "ambient" : "playback";
  } catch {
    /* older browsers */
  }
}

export function configure(next: Partial<Runtime>) {
  const mixChanged = next.mixOthers !== undefined && next.mixOthers !== runtime.mixOthers;
  Object.assign(runtime, next);
  if (mixChanged && typeof navigator !== "undefined" && ac) applyAudioSession();
  if (!runtime.music || runtime.lowData) haltMusic();
  else resumeMusic();
}

let ac: AudioContext | null = null;
let sfxBus: GainNode;
let musicBus: GainNode;
let nbuf: AudioBuffer;
let unlocked = false;
let scheduled: Scheduled[] = [];

type Activation = { userActivation?: { hasBeenActive?: boolean; isActive?: boolean } };

function build(a: AudioContext) {
  const master = a.createGain();
  master.gain.value = 0.7;
  const hp = a.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 30;
  const shelf = a.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 6000;
  shelf.gain.value = -3;
  const glue = a.createDynamicsCompressor();
  glue.threshold.value = -20;
  glue.knee.value = 12;
  glue.ratio.value = 3;
  glue.attack.value = 0.004;
  glue.release.value = 0.15;
  const limiter = a.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  master.connect(hp);
  hp.connect(shelf);
  shelf.connect(glue);
  glue.connect(limiter);
  limiter.connect(a.destination);
  sfxBus = a.createGain();
  sfxBus.connect(master);
  musicBus = a.createGain();
  musicBus.gain.value = MUSIC_LEVEL;
  musicBus.connect(master);
  nbuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
  const d = nbuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  // A tap on an earlier page (client-side navigation) leaves sticky activation: no need to wait for another.
  if (!unlocked && (navigator as Navigator & Activation).userActivation?.hasBeenActive) unlocked = true;
  if (!unlocked) return null;
  if (!ac) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    // iPhone: web audio follows the silent switch unless the page asks for playback; game sound is on by default
    applyAudioSession();
    ac = new AC();
    build(ac);
    if (!runtime.lowData) loadSamples(ac);
  }
  if (ac.state !== "running") void ac.resume().catch(() => {});
  return ac;
}

/** True when a sound scheduled now would be heard now (not queued behind a suspended context). */
function ready(a: AudioContext) {
  if (a.state === "running") return true;
  // Inside a gesture the resume above lands within a frame; outside one, a suspended context would
  // replay everything at once when it finally wakes, so stay silent instead.
  const act = (navigator as Navigator & Activation).userActivation;
  return a.state === "suspended" && (act?.isActive ?? false);
}

/** Plays a sound with its paired haptic. Never throws. */
export function play(name: string, o: PlayOptions = {}) {
  const key = resolve(name);
  if (!key) return;
  let played = false;
  const delay = Math.max(0, o.delay ?? 0);
  try {
    const a = runtime.sfx ? ctx() : null;
    const start = Date.now() + delay * 1000;
    if (a && ready(a)) scheduled = prune(scheduled, Date.now());
    if (a && ready(a) && canStart(scheduled, key, start)) {
      const t = a.currentTime + 0.005 + delay;
      const v = variation(key);
      const out = a.createGain();
      out.gain.value = v.gain * Math.max(0, Math.min(1, o.gain ?? 1));
      if ((o.pan !== undefined || o.panTo !== undefined) && typeof a.createStereoPanner === "function") {
        const p = a.createStereoPanner();
        p.pan.setValueAtTime(clampPan(o.pan), t);
        if (o.panTo !== undefined) p.pan.linearRampToValueAtTime(clampPan(o.panTo), t + (o.duration ?? LENGTH_MS[key] / 1000));
        out.connect(p);
        p.connect(sfxBus);
      } else out.connect(sfxBus);
      // A recorded sample when it has loaded; the synth recipe otherwise (and in low-data mode)
      const buf = runtime.lowData ? null : sampleFor(key);
      if (!buf && !runtime.lowData) wantSample(key);
      let sampleMs = 0;
      if (buf) {
        const src = a.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = sampleRate(key, buf, v.rate, o);
        src.connect(out);
        src.start(t);
        sampleMs = (buf.duration / src.playbackRate.value) * 1000;
      } else {
        const kit: Kit = { a, out, noise: nbuf, rate: v.rate };
        RECIPES[key](kit, t, o);
      }
      const length = Math.max(LENGTH_MS[key], sampleMs, (o.duration ?? 0) * 1000 + 60);
      scheduled.push({ name: key, start, end: start + length });
      played = true;
      setTimeout(
        () => {
          try {
            out.disconnect();
          } catch {
            /* already gone */
          }
        },
        length + delay * 1000 + 100,
      );
    }
  } catch {
    /* audio is decoration; never break gameplay */
  }
  const pattern = HAPTICS[key];
  if (!o.silentHaptic && pattern) {
    if (delay > 0) setTimeout(() => haptic(pattern), delay * 1000);
    else haptic(pattern);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("spuzl:fx", { detail: { sound: key, played, haptic: pattern ?? null } }));
  }
}

/** Call from the first pointerdown/keydown. Browsers block audio until then. */
export function unlock() {
  const first = !unlocked;
  unlocked = true;
  try {
    ctx();
  } catch {
    /* ignore */
  }
  // Music asked for before the first tap starts now.
  if (first) resumeMusic();
}

export function isUnlocked() {
  return unlocked;
}

/** Test hook: back to the cold, locked state. */
export function __resetForTests() {
  unlocked = false;
  ac = null;
  scheduled = [];
  Object.assign(runtime, { sfx: true, music: false, haptics: true, lowData: false });
}

/* ---------- Music: recorded loops per area (lib/audio/recorded.ts) ---------- */

export type WorldId = "logic" | "line" | "shape" | "number" | "word" | "clue" | "reflex" | "rage" | "board";

let player: MusicPlayer | null = null;
/** what is playing (or wanted, before audio unlocks): "<style>:<id>" */
let playing: string | null = null;
let wanted: { id: string; style: StyleId } | null = null;

/**
 * Plays the track for `id` in `style` ("home", "versus" or a game id). Remembers the request, so it starts as soon
 * as audio unlocks or music is switched on; the same track asked for again keeps playing without a restart.
 */
export function playMusic(id: string, style: StyleId) {
  wanted = { id, style };
  resumeMusic();
}

/** Stops the music and forgets the request (a screen that wants silence: the intro, sound-based games). */
export function stopMusic() {
  wanted = null;
  haltMusic();
}

function haltMusic() {
  player?.stop();
  player = null;
  playing = null;
}

/** Screens that hold the music off while they're shown (the public landing page). */
let holds = 0;
export function holdMusic(on: boolean) {
  holds = Math.max(0, holds + (on ? 1 : -1));
  if (holds) haltMusic();
  else resumeMusic();
}

function resumeMusic() {
  if (!wanted || !runtime.music || runtime.lowData || holds) return;
  // One recorded loop per area: moving between games of the same area keeps it playing
  const key = wanted.style;
  if (playing === key && player) return;
  const a = ctx();
  if (!a || a.state !== "running") return;
  // The old track fades out while the new one fades in (each player has its own fade).
  haltMusic();
  player = createRecordedPlayer(a, musicBus, wanted.style);
  playing = key;
}

/** Pauses music while the tab is hidden and picks it back up when it returns. */
export function setMusicHidden(hidden: boolean) {
  if (hidden) haltMusic();
  else resumeMusic();
}

/** Ducks music under celebrations (Handoff sound map). */
export function duck(ms = 1200) {
  if (!ac || !musicBus) return;
  const t = ac.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setTargetAtTime(0.04, t, 0.05);
  musicBus.gain.setTargetAtTime(MUSIC_LEVEL, t + ms / 1000, 0.2);
}
