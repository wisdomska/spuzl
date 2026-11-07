import { describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";
import { setSetting } from "./setup";
import { clearCrownfall, png } from "./r2-p5-helpers";

/**
 * R2-P5 story cards: sharing a clear makes (or reuses) a challenge on the same puzzle server side and returns the
 * 9:16 card, whose image renders at 1080 × 1920. The admin switch "features.storyCards" is enforced.
 */
describe("api: story cards", () => {
  it("makes a challenge on the same puzzle and returns the story card and share text", async () => {
    const { g, attemptId } = await clearCrownfall("st_");
    const r = await g.api("/api/v1/share/story", { json: { attemptId } });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect(r.data).toMatchObject({ width: 1080, height: 1920, path: `/c/${r.data.code}` });
    expect(r.data.image).toBe(`/api/og/challenge/${r.data.code}?format=story`);
    expect(r.data.text).toMatch(new RegExp(`^I cleared Crownfall in 0:06 on SPUZL\\. Beat me: .+/c/${r.data.code}$`));
    const { data: ch } = await admin().from("challenges").select("attempt_id, game_id, sender_ms").eq("code", r.data.code).single();
    expect(ch).toMatchObject({ attempt_id: attemptId, game_id: "crownfall", sender_ms: 6400 });
    // Sharing again reuses the same challenge.
    const again = await g.api("/api/v1/share/story", { json: { attemptId } });
    expect(again.data.code).toBe(r.data.code);
    expect(await png(r.data.image)).toMatchObject({ status: 200, type: "image/png", width: 1080, height: 1920 });
    expect(await png(`${r.data.image}&size=small`)).toMatchObject({ width: 540, height: 960 });
  });

  it("draws the player's equipped hat from their row, never from the query string", async () => {
    const { g, attemptId } = await clearCrownfall("sh_");
    await admin().from("players").update({ hat: "crown" }).eq("id", g.userId);
    const r = await g.api("/api/v1/share/story", { json: { attemptId } });
    const withHat = await png(r.data.image);
    expect(withHat.status).toBe(200);
    expect(await png(`${r.data.image}&hat=chef&nickname=hacked`)).toMatchObject({ status: 200, width: 1080 });
  });

  it("refuses someone else's attempt and an unfinished one", async () => {
    const { attemptId } = await clearCrownfall("so_");
    const other = await guest(uniq("sx_"));
    expect((await other.api("/api/v1/share/story", { json: { attemptId } })).status).toBe(404);
    const start = await other.api("/api/v1/attempts", { json: { game: "crownfall", mode: "free", difficulty: "easy" } });
    expect((await other.api("/api/v1/share/story", { json: { attemptId: start.data.attemptId } })).status).toBe(409);
  });

  it("is off with features.storyCards off: the route and the story image 404, the link preview stays", async () => {
    const { g, attemptId } = await clearCrownfall("sf_");
    const r = await g.api("/api/v1/share/story", { json: { attemptId } });
    await setSetting("features.storyCards", false);
    try {
      expect((await g.api("/api/v1/share/story", { json: { attemptId } })).data.error).toBe("story_cards_off");
      expect((await png(r.data.image)).status).toBe(404);
      expect((await png(`/api/og/challenge/${r.data.code}`)).status).toBe(200);
    } finally {
      await setSetting("features.storyCards", true);
    }
  });

  it("keeps the existing square and 4:5 frames", async () => {
    expect(await png("/api/og/sample/daily?format=square")).toMatchObject({ status: 200, width: 1080, height: 1080 });
    expect(await png("/api/og/sample/status")).toMatchObject({ status: 200, width: 1080, height: 1350 });
    expect(await png("/api/og/sample/challenge?format=story")).toMatchObject({ status: 200, width: 1080, height: 1920 });
  });
});
