import type { MusicPlayer, StyleId } from "./music";

/**
 * Recorded background music (ElevenLabs loops picked by the owner), one loop per area in public/music. An area
 * without a file yet plays nothing. Each file is fetched and decoded once, then looped seamlessly.
 */
export const MUSIC_FILES: Partial<Record<StyleId, string>> = {
  home: "/music/home.mp3",
  logic: "/music/logic.mp3",
  versus: "/music/versus.mp3",
  word: "/music/word.mp3",
  reflex: "/music/reflex.mp3",
  board: "/music/board.mp3",
};

const buffers = new Map<string, Promise<AudioBuffer | null>>();

function load(a: AudioContext, url: string): Promise<AudioBuffer | null> {
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => a.decodeAudioData(b))
      .catch(() => {
        buffers.delete(url); // try again next time
        return null;
      });
    buffers.set(url, p);
  }
  return p;
}

/** Seconds a new track takes to fade in, and an old one to fade out: changing area crossfades between them. */
const FADE_IN = 1.2;
const FADE_OUT = 0.9;

/** Loops the area's recorded track on `out` until stopped (fading in, and out on stop); null when it has none. */
export function createRecordedPlayer(a: AudioContext, out: AudioNode, style: StyleId): MusicPlayer | null {
  const url = MUSIC_FILES[style];
  if (!url) return null;
  let stopped = false;
  let src: AudioBufferSourceNode | null = null;
  const g = a.createGain();
  g.gain.value = 0;
  g.connect(out);
  void load(a, url).then((buf) => {
    if (stopped || !buf) return;
    src = a.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(g);
    const t = a.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + FADE_IN);
    src.start(t);
  });
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const t = a.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + FADE_OUT);
      setTimeout(
        () => {
          try {
            src?.stop();
          } catch {
            /* never started */
          }
          src?.disconnect();
          g.disconnect();
        },
        FADE_OUT * 1000 + 100,
      );
    },
  };
}
