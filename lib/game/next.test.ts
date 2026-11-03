import { describe, expect, it } from "vitest";
import { GAMES, LAUNCH_IDS } from "@/lib/catalog";
import { continueGame, continueHref, nextInPath, nextLabel } from "./next";

describe("nextInPath", () => {
  const all = () => true;
  it("goes to the next game in the same category, skipping cleared ones", () => {
    const puzzles = GAMES.filter((g) => g.world === "logic").map((g) => g.id);
    expect(nextInPath(puzzles[0], {}, all)).toBe(puzzles[1]);
    expect(nextInPath(puzzles[0], { [puzzles[1]]: 1 }, all)).toBe(puzzles[2]);
  });
  it("never jumps back to the start of the Dailies list (a non-Daily game no longer leads to Crownfall)", () => {
    const puzzles = GAMES.filter((g) => g.world === "logic").map((g) => g.id);
    const trotro = puzzles.indexOf("trotro");
    expect(trotro).toBeGreaterThanOrEqual(0);
    expect(nextInPath("trotro", {}, all)).toBe(puzzles[(trotro + 1) % puzzles.length]);
    expect(GAMES.find((g) => g.id === nextInPath("trotro", {}, all))?.world).toBe("logic");
  });
  it("never returns the game just played", () => {
    const cleared = Object.fromEntries(GAMES.map((g) => [g.id, 1]));
    for (const id of LAUNCH_IDS) expect(nextInPath(id, cleared, all)).not.toBe(id);
  });
  it("names the destination", () => {
    expect(nextLabel("dusk")).toBe("Next in Puzzles: Dusk");
    expect(nextLabel("gotcha")).toBe("Next in Arcade: Gotcha");
  });
});

describe("continueGame", () => {
  it("picks the most recently played game, else the fallback", () => {
    expect(continueGame(["trotro", "crownfall"], "crownfall")).toBe("trotro");
    expect(continueGame([], "crownfall")).toBe("crownfall");
    expect(continueGame(undefined, null)).toBeNull();
  });
  it("opens games with levels at the next level, others as a fresh puzzle", () => {
    expect(continueHref("gotcha", { dailiesOn: false, clearedToday: false })).toBe("/play/gotcha?mode=level");
    expect(continueHref("trotro", { dailiesOn: false, clearedToday: false })).toBe("/play/trotro?mode=level");
    expect(continueHref("coil", { dailiesOn: false, clearedToday: false })).toBe("/play/coil?mode=free");
  });
});
