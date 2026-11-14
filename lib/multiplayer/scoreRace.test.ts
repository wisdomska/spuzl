import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import twotruths from "@/games/twotruths/logic";
import type { TruthsGuess, TruthsState } from "@/games/twotruths/rules";
import { checkGuessWith } from "@/lib/game/guess-check";
import { placeScoreRace, scoreOrder, scoreRaceOver, scoreRun } from "./scoreRace";
import { isPartyGame, isRaceGame, isScoreRaceGame, partyGames, pickGames, SCORE_RACE_GAMES } from "./games";

const settings = (o: { off?: string[]; testing?: string[]; noVersus?: string[]; on?: boolean } = {}) => ({
  "games.testing": o.testing ?? [],
  "games.off": o.off ?? [],
  "games.noVersus": o.noVersus ?? [],
  "party.scoreRaces": o.on ?? true,
});

describe("score race games (R3-08)", () => {
  it("takes the all-ages score games, never photosensitive ones, and never in Duels", () => {
    const ids = SCORE_RACE_GAMES.map((g) => g.id);
    expect(ids).toEqual(expect.arrayContaining(["quickfire", "emojihits", "twotruths"]));
    for (const g of SCORE_RACE_GAMES) {
      expect(g.scoring).toBe("score");
      expect(g.photosensitive).toBeFalsy();
      expect(isRaceGame(g.id)).toBe(false); // Duels stay time races
    }
    expect(isScoreRaceGame("echo")).toBe(false); // photosensitive
    expect(isScoreRaceGame("crownfall")).toBe(false); // a time race
  });

  it("follows the setting: score games race only while score races are on", () => {
    expect(isPartyGame("quickfire", settings())).toBe(true);
    expect(isPartyGame("quickfire", settings({ on: false }))).toBe(false);
    expect(isPartyGame("crownfall", settings({ on: false }))).toBe(true);
    // Two Truths and a Lie graduated from the lab (11 Nov 2026): no Lab games switch needed any more.
    expect(isPartyGame("twotruths", settings())).toBe(true);
    expect(partyGames(settings()).some((g) => g.id === "twotruths")).toBe(true);
    expect(partyGames(settings({ on: false })).some((g) => g.scoring === "score")).toBe(false);
  });

  it("races the score games that graduated from the lab, and never Dara or a photosensitive game", () => {
    const ids = SCORE_RACE_GAMES.map((g) => g.id);
    for (const id of ["flagged", "twotruths"]) {
      expect(ids, id).toContain(id);
      expect(isPartyGame(id, settings()), id).toBe(true);
      expect(isRaceGame(id), id).toBe(false);
    }
    expect(isScoreRaceGame("dara")).toBe(false);
    expect(isPartyGame("dara", settings())).toBe(false);
  });

  it("puts a picked score game in every round of a Party, and keeps Random mix and Duels to time races", () => {
    const party = (id: string) => isPartyGame(id, settings());
    expect(pickGames(createRng("x"), "quickfire", 3, undefined, party)).toEqual(["quickfire", "quickfire", "quickfire"]);
    const picked = pickGames(createRng("x"), null, 3, ["quickfire", "crownfall"], party);
    expect(new Set(picked)).toEqual(new Set(["quickfire", "crownfall"]));
    for (const g of pickGames(createRng("y"), null, 3, undefined, party)) expect(isRaceGame(g)).toBe(true);
    // Without the Party rule (a Duel) a score game is never used, nor in a Party while score races are off.
    for (const g of pickGames(createRng("x"), "quickfire", 3, undefined, isRaceGame)) expect(isRaceGame(g)).toBe(true);
    for (const g of pickGames(createRng("z"), null, 3, ["twotruths", "crownfall"], (id) => isPartyGame(id, settings({ on: false }))))
      expect(g).toBe("crownfall");
  });
});

describe("score races follow the Games page", () => {
  it("drops a score game that is Off, In testing or kept out of Duels and Parties", () => {
    expect(isPartyGame("quickfire", settings({ off: ["quickfire"] }))).toBe(false);
    expect(isPartyGame("quickfire", settings({ testing: ["quickfire"] }))).toBe(false);
    expect(isPartyGame("quickfire", settings({ noVersus: ["quickfire"] }))).toBe(false);
    expect(partyGames(settings({ noVersus: ["quickfire"] })).some((g) => g.id === "quickfire")).toBe(false);
    expect(isPartyGame("emojihits", settings({ noVersus: ["quickfire"] }))).toBe(true);
  });
});

describe("scoring a run on the server (R3-08)", () => {
  const g = twotruths.generate(createRng("party:race"), "easy");

  /** Plays the board through the server's guess checks (attempt-style log), like the race route does. */
  function play(picks: (s: { lie: number[] }, q: number) => number) {
    let log: unknown[] = [];
    const state: TruthsState = { answers: [] };
    let t = 1_000_000;
    for (let q = 0; q < g.puzzle.rounds.length; q++) {
      const ask = (guess: TruthsGuess) => {
        const out = checkGuessWith(twotruths, g.puzzle, g.solution, guess, { kind: "attempt", state, log }, t);
        if (out.entry) log = [...log, out.entry];
        return out.result as { verdict?: { pick: number | null; ms: number } };
      };
      ask({ q, open: true });
      t += 6000;
      const v = ask({ q, pick: picks(g.solution, q), ms: 5000 }).verdict!;
      state.answers.push({ pick: v.pick, ms: v.ms } as TruthsState["answers"][number]);
      t += 4000;
    }
    return { state, log };
  }

  it("scores an honest run from the state and the server's answer log", () => {
    const right = play((s, q) => s.lie[q]);
    const r = scoreRun(twotruths, g.puzzle, g.solution, right.state, right.log);
    expect(r.ok).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(500);
    const wrong = play((s, q) => (s.lie[q] + 1) % 3);
    expect(scoreRun(twotruths, g.puzzle, g.solution, wrong.state, wrong.log).score).toBeLessThan(r.score);
  });

  it("gives nothing for a forged state the server never judged", () => {
    const forged: TruthsState = { answers: g.solution.lie.map((pick) => ({ pick, ms: 3000 })) as TruthsState["answers"] };
    expect(scoreRun(twotruths, g.puzzle, g.solution, forged, [])).toMatchObject({ ok: false, score: 0 });
    expect(scoreRun(twotruths, g.puzzle, g.solution, null, [])).toMatchObject({ ok: false, score: 0 });
  });

  it("refuses a run that isn't over yet (a quiz needs every question judged)", () => {
    const right = play((s, q) => s.lie[q]);
    const half = { answers: right.state.answers.slice(0, 2) };
    expect(scoreRun(twotruths, g.puzzle, g.solution, half, right.log.slice(0, 4)).ok).toBe(false);
  });
});

describe("placing a score round (R3-08)", () => {
  const r = (id: string, score: number, timeMs: number | null, o: { progress?: number; passed?: boolean; gone?: boolean } = {}) => ({
    id,
    score,
    timeMs,
    progress: o.progress ?? (timeMs === null ? 0.5 : 1),
    mistakes: 0,
    passed: o.passed,
    gone: o.gone,
  });

  it("ranks by score, then the faster finish, then progress", () => {
    const order = scoreOrder([r("slow-high", 700, 90_000), r("fast-low", 400, 30_000), r("tie-fast", 700, 60_000), r("none", 0, null)]);
    expect(order.map((x) => x.id)).toEqual(["tie-fast", "slow-high", "fast-low", "none"]);
  });

  it("puts a skipper last with 0 points and pays the rest on the race scale", () => {
    const placed = placeScoreRace([r("a", 300, 50_000), r("b", 0, null, { progress: 0.4 }), r("skip", 900, null, { passed: true })]);
    expect(placed.map((x) => [x.id, x.place, x.points])).toEqual([
      ["a", 1, 700],
      ["b", 2, 120],
      ["skip", 3, 0],
    ]);
  });

  it("ends when everyone here has finished, or at the time limit, never early after the first finish", () => {
    expect(scoreRaceOver([r("a", 1, 10), r("b", 0, null)], 0, 100_000, 180_000)).toBe(false);
    expect(scoreRaceOver([r("a", 1, 10), r("b", 0, null)], 0, 180_000, 180_000)).toBe(true);
    expect(scoreRaceOver([r("a", 1, 10), r("b", 0, null, { gone: true })], 0, 1_000, 180_000)).toBe(true);
    expect(scoreRaceOver([r("a", 1, 10), r("b", 2, 20)], 0, 1_000, 180_000)).toBe(true);
  });
});
