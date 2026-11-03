import { describe, expect, it } from "vitest";
import { musicFor } from "@/components/shell/MusicDirector";
import { STYLES, chordTones, trackFor } from "@/lib/audio/music";

describe("music director", () => {
  it("picks a track for every area", () => {
    expect(musicFor("/")).toEqual({ id: "home", style: "home" });
    expect(musicFor("/world/logic")).toEqual({ id: "home", style: "home" });
    expect(musicFor("/play/crownfall")).toEqual({ id: "crownfall", style: "logic" });
    expect(musicFor("/play/rungs")).toEqual({ id: "rungs", style: "word" });
    expect(musicFor("/play/gotcha")).toEqual({ id: "gotcha", style: "reflex" });
    expect(musicFor("/play/chess/bot")).toEqual({ id: "chess", style: "board" });
    expect(musicFor("/duel")).toEqual({ id: "versus", style: "versus" });
    expect(musicFor("/bay/abc")).toEqual({ id: "bay", style: "board" });
  });
  it("stays quiet where sound is the game, and on the intro", () => {
    expect(musicFor("/play/beattap")).toBeNull();
    expect(musicFor("/play/echo")).toBeNull();
    expect(musicFor("/intro")).toBeNull();
    expect(musicFor("/about")).toBeNull();
    expect(musicFor("/privacy")).toBeNull();
  });
  it("gives each game its own tune, the same every time", () => {
    const a = trackFor("crownfall", "logic");
    expect(trackFor("crownfall", "logic")).toEqual(a);
    const b = trackFor("dusk", "logic");
    expect([a.bpm, a.root, a.motif.join()]).not.toEqual([b.bpm, b.root, b.motif.join()]);
    expect(a.bpm).toBeGreaterThanOrEqual(STYLES.logic.bpm[0]);
    expect(a.bpm).toBeLessThanOrEqual(STYLES.logic.bpm[1]);
  });
  it("builds every chord inside its key", () => {
    for (const s of Object.values(STYLES))
      for (const prog of s.progressions)
        for (const d of prog) for (const iv of chordTones(s, d)) expect(s.harmony).toContain(((iv % 12) + 12) % 12);
  });
});
