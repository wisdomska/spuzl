import { describe, expect, it } from "vitest";
import { wideZoom, WIDE_ZOOM_MAX } from "@/components/game/WideZoom";
import { wideColumn, WIDE_COL_MIN } from "@/components/game/useBoardSize";

describe("wide screens use their room (owner, 14 Nov 2026)", () => {
  it("scales a small board up to fill its room, never down and never past the cap", () => {
    expect(wideZoom({ w: 400, h: 300 }, { w: 800, h: 900 })).toBe(WIDE_ZOOM_MAX);
    expect(wideZoom({ w: 500, h: 400 }, { w: 600, h: 900 })).toBe(1.2);
    expect(wideZoom({ w: 900, h: 400 }, { w: 600, h: 900 })).toBe(1);
    expect(wideZoom({ w: 590, h: 400 }, { w: 600, h: 900 })).toBe(1);
  });

  it("shapes the board column to the game, so board and panel sit together", () => {
    // A square board on a 1554 × 732 laptop: the height decides, the column follows it.
    expect(wideColumn(1554, 732, "crownfall")).toBeLessThan(wideColumn(1554, 732, "oware"));
    expect(wideColumn(1554, 732, "quickfire")).toBeGreaterThanOrEqual(WIDE_COL_MIN);
  });
});
