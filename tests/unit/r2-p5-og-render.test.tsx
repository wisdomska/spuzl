import { describe, expect, it, vi } from "vitest";
import { SAMPLE_CHALLENGE } from "@/lib/share/challenge-card";

vi.mock("server-only", () => ({}));

/** Satori smoke test: the challenge frames lay out without errors (every div flex, no unsupported CSS). */
describe("challenge card frames render", () => {
  it.each([
    ["og", 1200, 630],
    ["story", 1080, 1920],
  ] as const)("%s renders a %ix%i PNG", async (format, w, h) => {
    const { renderChallengeCard } = await import("@/lib/og/render");
    const res = await renderChallengeCard(SAMPLE_CHALLENGE, format, 0.5);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(1, 4).toString()).toBe("PNG");
    expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([w / 2, h / 2]);
    // Visual check: OG_OUT=<dir> writes the PNGs for a look.
    if (process.env.OG_OUT) (await import("node:fs")).writeFileSync(`${process.env.OG_OUT}/challenge-${format}.png`, buf);
  });
});
