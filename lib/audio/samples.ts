import type { PlayOptions } from "./index";
import { VOICES, type SfxName } from "./palette";
import { constrainedNetwork, whenQuiet } from "@/lib/perf/quiet";

/**
 * Recorded sound effects (made with ElevenLabs, trimmed and levelled), one file per voice in public/sfx. They load
 * in the background once audio unlocks; until a file has loaded (or in low-data mode, or if it fails) the voice's
 * synth recipe in voices.ts plays instead, so nothing ever waits on the network.
 */
/** Voices kept on their synth recipe (the recording did not work out): "join" came back as a 40 ms blip. */
const SYNTH_ONLY: ReadonlySet<SfxName> = new Set<SfxName>(["join"]);
export const SAMPLED: ReadonlySet<SfxName> = new Set(VOICES.filter((v) => !SYNTH_ONLY.has(v)));

const buffers = new Map<SfxName, AudioBuffer>();
let loading = false;

/**
 * Fetches and decodes every sample, two at a time, most-used first, at low priority. Safe to call more than once.
 * R2-01: starts only once the game on screen is ready and the network is quiet (lib/perf/quiet.ts), and never on a
 * data-saving or 2G connection, so 55 small files never compete with a first board.
 */
export function loadSamples(a: AudioContext) {
  if (loading || typeof fetch === "undefined" || constrainedNetwork()) return;
  loading = true;
  void whenQuiet().then(() => fetchAll(a));
}

function fetchAll(a: AudioContext) {
  const first: SfxName[] = ["tick", "nav", "pop", "tile", "buzz", "success", "toggle", "sheet_open", "sheet_close"];
  const queue = [...first, ...[...SAMPLED].filter((n) => !first.includes(n))];
  const worker = async () => {
    for (let n = queue.shift(); n; n = queue.shift()) {
      try {
        const r = await fetch(`/sfx/${n}.mp3`, { priority: "low" } as RequestInit);
        if (!r.ok) continue;
        buffers.set(n, await a.decodeAudioData(await r.arrayBuffer()));
      } catch {
        /* this voice keeps its synth recipe */
      }
    }
  };
  void Promise.all([worker(), worker()]);
}

export const sampleFor = (name: SfxName) => buffers.get(name) ?? null;

/** Pentatonic steps for tuned voices that climb (letters, chimes): stays musical however far it goes. */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const semis = (n: number) => Math.pow(2, n / 12);

/**
 * Playback rate for a sample: the per-play pitch variation, times what `step` means for that voice (the same
 * meanings the synth recipes use), or a stretch to fit `duration` for the motion-matched swooshes.
 */
export function sampleRate(name: SfxName, buf: { duration: number }, vary: number, o: PlayOptions): number {
  const s = o.step ?? 0;
  let r = 1;
  switch (name) {
    case "pop":
    case "tile":
      r = semis(Math.max(0, Math.min(7, s)));
      break;
    case "chime":
    case "letter":
      r = semis(PENTA[Math.max(0, s) % PENTA.length]);
      break;
    case "synth":
      r = semis(Math.max(0, Math.min(12, s)));
      break;
    case "toggle":
      r = s === 1 ? semis(2) : semis(-2);
      break;
    case "count":
      r = s === 0 ? semis(7) : 1;
      break;
    case "rush":
    case "swoosh":
    case "whoosh":
      if (o.duration) r = Math.max(0.6, Math.min(1.8, buf.duration / o.duration));
      break;
  }
  return r * vary;
}
