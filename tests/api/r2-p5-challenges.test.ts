import { describe, expect, it } from "vitest";
import crownfall from "@/games/crownfall/logic";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { admin, BASE, guest, uniq } from "./helpers";
import { setSetting } from "./setup";

/**
 * R2-P5 friend challenges: the link preview image and page metadata, the short link, the 7-day expiry and the
 * admin switch "features.challenges" (server enforced).
 */

async function png(path: string) {
  const res = await fetch(BASE + path);
  const buf = Buffer.from(await res.arrayBuffer());
  const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return {
    status: res.status,
    type: res.headers.get("content-type"),
    width: isPng ? buf.readUInt32BE(16) : 0,
    height: isPng ? buf.readUInt32BE(20) : 0,
  };
}

/** A guest with a verified free Crownfall clear and a challenge made from it. */
export async function clearAndChallenge(prefix = "ch_") {
  const g = await guest(uniq(prefix));
  const start = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "free", difficulty: "easy" } });
  const { data: att } = await admin().from("attempts").select("free_seed").eq("id", start.data.attemptId).single();
  const [seed, diff] = att!.free_seed!.split("|");
  const gen = crownfall.generate(createRng(seed), diff as Difficulty);
  const n = gen.puzzle.size;
  const state = new Array(n * n).fill(0);
  gen.solution.forEach((c, r) => (state[r * n + c] = 2));
  await new Promise((r) => setTimeout(r, 6500));
  const fin = await g.api(`/api/v1/attempts/${start.data.attemptId}/finish`, { json: { state, activeMs: 6400, mistakes: 0 } });
  expect(fin.data.status).toBe("cleared");
  const ch = await g.api("/api/v1/challenges", { json: { attemptId: start.data.attemptId } });
  expect(ch.status).toBe(200);
  return { g, attemptId: start.data.attemptId as string, code: ch.data.code as string };
}

describe("api: friend challenge previews", () => {
  it("renders the 1200 × 630 preview and the 9:16 story from the challenge row", async () => {
    const { code } = await clearAndChallenge();
    expect(await png(`/api/og/challenge/${code}`)).toMatchObject({ status: 200, type: "image/png", width: 1200, height: 630 });
    expect(await png(`/api/og/challenge/${code}?format=story`)).toMatchObject({ status: 200, width: 1080, height: 1920 });
    expect(await png(`/api/og/challenge/${code.toLowerCase()}?size=small`)).toMatchObject({ width: 600, height: 315 });
    expect((await png("/api/og/challenge/NOPE00")).status).toBe(404);
    expect((await png("/api/og/challenge/ZZZZZZ")).status).toBe(404);
  });

  it("gives the challenge page a title, description and og:image for WhatsApp and Instagram", async () => {
    const { code } = await clearAndChallenge();
    const html = await (await fetch(`${BASE}/challenge/${code}`, { headers: { "user-agent": "WhatsApp/2.23.20.0" } })).text();
    expect(html).toMatch(/<title>Beat ch_\d+'s 0:06 on Crownfall · SPUZL<\/title>/);
    expect(html).toContain(`property="og:image" content="`);
    expect(html).toContain(`/api/og/challenge/${code}`);
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toMatch(/name="description" content="ch_\d+ played this exact puzzle on SPUZL/);
  });

  it("redirects the short link to the challenge page", async () => {
    const { code } = await clearAndChallenge();
    const res = await fetch(`${BASE}/c/${code.toLowerCase()}`, { redirect: "manual" });
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get("location")!).pathname).toBe(`/challenge/${code}`);
    const bad = await fetch(`${BASE}/c/not-a-code`, { redirect: "manual" });
    expect(new URL(bad.headers.get("location")!).pathname).toBe("/");
  });

  it("lasts 7 days, then answers 410 and drops its preview", async () => {
    const { code } = await clearAndChallenge();
    const { data } = await admin().from("challenges").select("created_at, expires_at").eq("code", code).single();
    expect(Date.parse(data!.expires_at) - Date.parse(data!.created_at)).toBe(7 * 86_400_000);
    await admin()
      .from("challenges")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("code", code);
    const b = await guest(uniq("cx_"));
    const r = await b.api(`/api/v1/challenges/${code}`);
    expect(r.status).toBe(410);
    expect(r.data.message).toBe("This challenge ran out. Ask for a fresh link.");
    expect((await png(`/api/og/challenge/${code}`)).status).toBe(404);
  });

  it("refuses every challenge route and preview while features.challenges is off", async () => {
    const { g, attemptId, code } = await clearAndChallenge();
    await setSetting("features.challenges", false);
    try {
      const b = await guest(uniq("co_"));
      expect((await g.api("/api/v1/challenges", { json: { attemptId } })).data.error).toBe("challenges_off");
      expect((await b.api(`/api/v1/challenges/${code}`)).status).toBe(404);
      expect((await b.api(`/api/v1/challenges/${code}/accept`, { json: {} })).status).toBe(404);
      expect((await png(`/api/og/challenge/${code}`)).status).toBe(404);
    } finally {
      await setSetting("features.challenges", true);
    }
  });

  it("sends a beaten challenge back as a fresh link on the same puzzle", async () => {
    const { code } = await clearAndChallenge();
    const b = await guest(uniq("cb_"));
    const acc = await b.api(`/api/v1/challenges/${code}/accept`, { json: {} });
    expect(acc.status).toBe(200);
    const { data: src } = await admin().from("challenges").select("free_seed, game_id").eq("code", code).single();
    const [seed, diff] = src!.free_seed!.split("|");
    const gen = crownfall.generate(createRng(seed), diff as Difficulty);
    const n = gen.puzzle.size;
    const state = new Array(n * n).fill(0);
    gen.solution.forEach((c, r) => (state[r * n + c] = 2));
    await new Promise((r) => setTimeout(r, 6500));
    await b.api(`/api/v1/attempts/${acc.data.attemptId}/finish`, { json: { state, activeMs: 6200, mistakes: 0 } });
    const res = await b.api(`/api/v1/challenges/${code}/result`, { json: { attemptId: acc.data.attemptId } });
    expect(res.data.result.attemptId).toBe(acc.data.attemptId);
    const back = await b.api("/api/v1/challenges", { json: { attemptId: acc.data.attemptId } });
    expect(back.status).toBe(200);
    expect(back.data.code).not.toBe(code);
    const { data: again } = await admin().from("challenges").select("free_seed, game_id, sender_ms").eq("code", back.data.code).single();
    expect(again).toMatchObject({ free_seed: src!.free_seed, game_id: "crownfall", sender_ms: 6200 });
  });
});
