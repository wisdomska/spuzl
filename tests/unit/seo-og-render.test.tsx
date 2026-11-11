import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** Satori smoke test: the site's and every game's 1200 × 630 link previews lay out without errors. */
describe("SEO link previews render", () => {
  const png = async (res: Response) => {
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(1, 4).toString()).toBe("PNG");
    expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([1200, 630]);
    return buf;
  };

  it("draws the site card", async () => {
    const { default: Image } = await import("@/app/opengraph-image");
    const buf = await png(await Image());
    // Visual check: OG_OUT=<dir> writes the PNGs for a look.
    if (process.env.OG_OUT) (await import("node:fs")).writeFileSync(`${process.env.OG_OUT}/seo-site.png`, buf);
  });

  it("draws a card for each live game, and 404s any other id", async () => {
    const { GAMES } = await import("@/lib/catalog");
    const { default: Image } = await import("@/app/games/[id]/opengraph-image");
    for (const g of GAMES) {
      const buf = await png(await Image({ params: Promise.resolve({ id: g.id }) }));
      if (process.env.OG_OUT) (await import("node:fs")).writeFileSync(`${process.env.OG_OUT}/seo-${g.id}.png`, buf);
    }
    expect((await Image({ params: Promise.resolve({ id: "blackout" }) })).status).toBe(404);
  }, 120_000);
});
