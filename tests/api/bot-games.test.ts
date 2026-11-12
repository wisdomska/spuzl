import { describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";

/** Owner, 12 Nov 2026: a finished game against the bot goes on the player's record (no reward), and in their export. */
describe("api: games against the bot", () => {
  it("records a finished game for the signed-in player, with no XP or Sparks", async () => {
    const g = await guest(uniq("botgame"));
    const before = (await admin().from("players").select("xp, sparks").eq("id", g.userId).single()).data!;
    const r = await g.api("/api/v1/bot-games", { json: { game: "chess", level: "hard", outcome: "won", durationMs: 420_000 } });
    expect(r.status, JSON.stringify(r.data)).toBe(201);
    const { data: rows } = await admin().from("bot_games").select("game_id, level, outcome, duration_ms").eq("player_id", g.userId);
    expect(rows).toEqual([{ game_id: "chess", level: "hard", outcome: "won", duration_ms: 420_000 }]);
    const after = (await admin().from("players").select("xp, sparks").eq("id", g.userId).single()).data!;
    expect(after).toEqual(before);
    const exp = await g.api("/api/v1/account/export");
    expect(JSON.stringify(exp.data)).toContain('"bot_games"');
  });

  it("refuses games that aren't bot games, bad levels and outcomes, and visitors", async () => {
    const g = await guest(uniq("botgame"));
    for (const json of [
      { game: "crownfall", level: "easy", outcome: "won" },
      { game: "chess", level: "impossible", outcome: "won" },
      { game: "chess", level: "easy", outcome: "resigned" },
      { game: "chess", level: "easy", outcome: "won", durationMs: -5 },
    ])
      expect((await g.api("/api/v1/bot-games", { json })).status).toBe(400);
    const res = await fetch(`${process.env.API_BASE ?? "http://localhost:3000"}/api/v1/bot-games`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game: "chess", level: "easy", outcome: "won" }),
    });
    expect(res.status).toBe(401);
  });
});
