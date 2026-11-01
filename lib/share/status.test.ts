import { describe, expect, it } from "vitest";
import { favouriteWorld, RANK_HEX, SAMPLE_STATUS, statusCard, worldCardColours, type StatusCardInput } from "./card-model";
import { statusShareText, SHARE_DOMAIN } from "./text";
import { signStatusToken, verifyStatusToken } from "./status-token";

const base: StatusCardInput = {
  nickname: "Ama_K",
  color: "#ff8a3d",
  hat: "crown",
  level: 15,
  streak: 12,
  favouriteWorld: "word",
  gamesTried: 23,
  totalGames: 51,
  rank: { name: "Solver", division: "II", emblem: "gear" },
  minor: false,
  hideActivity: false,
};
const ids = (i: StatusCardInput) => statusCard(i).stats.map((s) => s.id);

describe("statusCard", () => {
  it("shows Spuz in the player's colour and hat, nickname, level, streak, games tried, world and rank", () => {
    const c = statusCard(base);
    expect(c).toMatchObject({ kind: "status", nickname: "Ama_K", spuz: "#FF8A3D", hat: "crown", mood: "wave" });
    expect(statusCard({ ...base, hat: null }).mood).toBe("fire");
    expect(c.stats).toEqual([
      { id: "level", label: "Level", value: "Lv 15" },
      { id: "streak", label: "Streak", value: "🔥 12 days" },
      { id: "tried", label: "Games tried", value: "23 of 51" },
      { id: "world", label: "Favourite world", value: "Word Woods" },
    ]);
    expect(c.rank).toEqual({ label: "Solver II", color: RANK_HEX.gear });
    expect(c.bg).toBe(worldCardColours("word").bg);
    expect(c.alt).toContain("Rank Solver II");
    expect(c.alt).toContain("Streak 12 days");
  });

  it("hides level and rank for under-16s (public cards are nickname and avatar only)", () => {
    const c = statusCard({ ...base, minor: true });
    expect(ids({ ...base, minor: true })).toEqual(["streak", "tried", "world"]);
    expect(c.rank).toBeNull();
    expect(JSON.stringify(c)).not.toMatch(/Lv |Solver/);
  });

  it("hides streak and favourite world while activity is hidden", () => {
    const c = statusCard({ ...base, hideActivity: true });
    expect(ids({ ...base, hideActivity: true })).toEqual(["level", "tried"]);
    expect(c.worldHex).toBeNull();
    expect(statusCard({ ...base, hat: null, hideActivity: true }).mood).toBe("proud");
    expect(JSON.stringify(c)).not.toMatch(/Word Woods|12 days/);
  });

  it("never carries anything personal beyond the nickname", () => {
    const withExtras = { ...base, city: "Accra", email: "a@b.c", school: "Achimota", ageBand: "16-17" } as StatusCardInput;
    expect(JSON.stringify(statusCard(withExtras))).not.toMatch(/Accra|a@b\.c|Achimota|16-17/);
  });

  it("cleans bad inputs: unknown hats and colours, out-of-range counts, no rank, no clears", () => {
    const c = statusCard({ ...base, hat: "tophat", color: "red", gamesTried: 99, streak: 0, rank: null, favouriteWorld: null });
    expect(c.hat).toBeNull();
    expect(c.spuz).toBe("#B8F23A");
    expect(c.rank).toBeNull();
    expect(c.stats.find((s) => s.id === "tried")!.value).toBe("51 of 51");
    expect(c.stats.find((s) => s.id === "streak")!.value).toBe("Fresh start");
    expect(c.stats.some((s) => s.id === "world")).toBe(false);
    expect(c.bg).toBe("#0E0F1A");
  });

  it("has a valid design sample", () => {
    expect(SAMPLE_STATUS.stats).toHaveLength(4);
    expect(SAMPLE_STATUS.hat).toBe("kente");
  });
});

describe("favouriteWorld", () => {
  it("picks the world with the most clears, ties by world order, null with none", () => {
    expect(favouriteWorld([])).toBeNull();
    expect(favouriteWorld([{ game: "crownfall", clears: 0 }])).toBeNull();
    expect(
      favouriteWorld([
        { game: "crownfall", clears: 3 },
        { game: "nope", clears: 50 },
      ]),
    ).toBe("logic");
  });
});

describe("statusShareText", () => {
  it("says what the card shows and nothing else", () => {
    expect(statusShareText(statusCard(base))).toBe(
      ["SPUZL · Ama_K · Solver II", "Lv 15 · 🔥 12 days · 23 of 51 games tried", "Favourite world: Word Woods", SHARE_DOMAIN].join("\n"),
    );
    expect(statusShareText(statusCard({ ...base, minor: true, hideActivity: true }))).toBe(
      ["SPUZL · Ama_K", "23 of 51 games tried", SHARE_DOMAIN].join("\n"),
    );
    expect(statusShareText(statusCard({ ...base, streak: 0 }))).not.toContain("Fresh start");
  });
});

describe("status card token", () => {
  const id = "3f2b8c1e-4a5d-4e6f-8a7b-9c0d1e2f3a4b";
  it("round-trips and refuses forged, swapped or malformed tokens", () => {
    const t = signStatusToken(id, "s3cret");
    expect(verifyStatusToken(t, "s3cret")).toBe(id);
    expect(verifyStatusToken(t, "other")).toBeNull();
    expect(verifyStatusToken(t.replace(id, "00000000-0000-4000-8000-000000000000"), "s3cret")).toBeNull();
    expect(verifyStatusToken(id, "s3cret")).toBeNull();
    expect(verifyStatusToken(`${t}.x`, "s3cret")).toBeNull();
    expect(verifyStatusToken("not-a-token", "s3cret")).toBeNull();
    expect(verifyStatusToken(t, "")).toBeNull();
    expect(() => signStatusToken("nope", "s3cret")).toThrow();
  });
});
