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

/** Loops the area's recorded track on `out` until stopped; null when the area has no track. */
export function createRecordedPlayer(a: AudioContext, out: AudioNode, style: StyleId): MusicPlayer | null {
  const url = MUSIC_FILES[style];
  if (!url) return null;
  let stopped = false;
  let src: AudioBufferSourceNode | null = null;
  void load(a, url).then((buf) => {
    if (stopped || !buf) return;
    src = a.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(out);
    src.start();
  });
  return {
    stop() {
      stopped = true;
      try {
        src?.stop();
      } catch {
        /* never started */
      }
      src?.disconnect();
    },
  };
}
