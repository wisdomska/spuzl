import { describe, expect, it } from "vitest";
import { canHostTv, spectatorView, tvDefault, tvPath } from "./tv";
import type { MatchPlayerView, MatchView } from "./types";

const player = (id: string, o: Partial<MatchPlayerView> = {}): MatchPlayerView => ({
  id,
  nickname: `Nick_${id}`,
  color: "#2FD3E0",
  level: 14,
  country: "GH",
  city: "Kumasi",
  rating: 1320,
  seat: 0,
  ready: true,
  roundsWon: 1,
  points: 250,
  progress: 0.5,
  mistakes: 1,
  finishedMs: null,
  place: null,
  host: false,
  spectator: false,
  left: false,
  stale: false,
  passed: false,
  rematch: false,
  ratingBefore: 1300,
  ratingAfter: 1320,
  ...o,
});

const view = {
  id: "m1",
  kind: "race",
  status: "playing",
  code: "K7QX",
  hostId: "t",
  round: 1,
  games: ["crownfall", "dusk", "sixer"],
  me: "p1",
  players: [player("t", { host: true, spectator: true }), player("p1"), player("p2", { seat: 2 }), player("s", { spectator: true })],
  rounds: [],
  puzzle: { round: 1, game: "crownfall", data: { size: 6 } },
  myState: [1, 2, 3],
  reward: { xp: 10, sparks: 5 },
  h2h: { me: 1, them: 2, draws: 0, played: 3 },
  rulesFor: ["p2"],
  party: null,
  bot: null,
  classroom: true,
  tvOpen: true,
} as unknown as MatchView;

describe("spectatorView", () => {
  it("keeps nicknames, progress, places and points only", () => {
    const v = spectatorView(view);
    expect(v.me).toBe("");
    expect(v.players.map((p) => p.id)).toEqual(["t", "p1", "p2"]);
    for (const p of v.players) {
      expect(p).toMatchObject({ city: null, country: null, level: 0, rating: 0, ratingBefore: null, ratingAfter: null });
      expect(p.nickname).toMatch(/^Nick_/);
    }
    expect(v.players[1]).toMatchObject({ points: 250, progress: 0.5, roundsWon: 1 });
  });

  it("drops the puzzle, saved board, rewards, head-to-head and rules list", () => {
    const v = spectatorView(view);
    expect(v).toMatchObject({ puzzle: null, myState: null, reward: null, h2h: null, rulesFor: null, party: null, bot: null });
    expect(JSON.stringify(v)).not.toMatch(/Kumasi|"GH"|1320/);
  });
});

describe("big-screen rules", () => {
  const year = new Date().getUTCFullYear();
  it("opens for hosts 16 and over only", () => {
    expect(canHostTv({ age_band: "18+" })).toBe(true);
    expect(canHostTv({ age_band: "16-17" })).toBe(true);
    expect(canHostTv({ age_band: "13-15" })).toBe(false);
    expect(canHostTv({ age_band: "18+", birth_year: year - 14, birth_month: 1 })).toBe(false);
    expect(canHostTv(null)).toBe(false);
  });

  it("is on by default for classroom rooms only, at /party/<code>/tv", () => {
    expect(tvDefault(true)).toBe(true);
    expect(tvDefault(false)).toBe(false);
    expect(tvPath("k7qx")).toBe("/party/K7QX/tv");
  });
});
