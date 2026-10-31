import { describe, expect, it } from "vitest";
import { MAX_CONFETTI, confettiCount, makeConfetti } from "./confetti";
import { scrub } from "@/lib/monitoring/sentry";
import { gameIconSrc, smallCardSrc } from "@/lib/lowdata/images";
import { cardUrl } from "@/lib/share/urls";

describe("low-data mode", () => {
  it("caps confetti at 30 pieces", () => {
    expect(MAX_CONFETTI).toBe(30);
    expect(confettiCount(48)).toBe(48);
    expect(confettiCount(48, { lowData: true })).toBe(30);
    expect(confettiCount(12, { lowData: true })).toBe(12);
    expect(confettiCount(-3)).toBe(0);
  });

  it("lays out deterministic pieces inside the frame", () => {
    const a = makeConfetti(30, "seed");
    expect(a).toEqual(makeConfetti(30, "seed"));
    expect(a).not.toEqual(makeConfetti(30, "other"));
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(4);
      expect(p.x).toBeLessThanOrEqual(96);
      expect(p.duration).toBeGreaterThanOrEqual(1600);
    }
  });

  it("serves smaller images", () => {
    expect(gameIconSrc("crownfall", false)).toBe("/3d/icons/crownfall.webp");
    expect(gameIconSrc("crownfall", true)).toBe("/3d/icons-sm/crownfall.webp");
    expect(smallCardSrc("/api/og/daily/x", true)).toBe("/api/og/daily/x?size=small");
    expect(smallCardSrc("/api/og/daily/x?format=square", true)).toBe("/api/og/daily/x?format=square&size=small");
    expect(smallCardSrc("/api/og/daily/x", false)).toBe("/api/og/daily/x");
  });
});

describe("share card urls", () => {
  it("only carries layout in the query string", () => {
    expect(cardUrl("daily", "a1")).toBe("/api/og/daily/a1");
    expect(cardUrl("full", "a1", { format: "square", small: true })).toBe("/api/og/full/a1?format=square&size=small");
    expect(cardUrl("duel", "m1", { player: "p" })).toBe("/api/og/match/m1");
    expect(cardUrl("party", "m1", { player: "p", origin: "https://spuzl.gg" })).toBe("https://spuzl.gg/api/og/match/m1?p=p");
  });
});

describe("sentry scrubbing", () => {
  it("drops user, cookies, auth headers and query strings", () => {
    const e = scrub({
      type: undefined,
      user: { id: "u1", ip_address: "1.2.3.4" },
      request: {
        url: "https://spuzl.gg/play/crownfall?seed=x",
        cookies: { sb: "t" },
        headers: { Authorization: "Bearer t", cookie: "c", "user-agent": "ua" },
        query_string: "seed=x",
        data: { state: [1] },
      },
    });
    expect(e.user).toBeUndefined();
    expect(e.request).toEqual({ url: "https://spuzl.gg/play/crownfall", headers: { "user-agent": "ua" } });
  });
});
