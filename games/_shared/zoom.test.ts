import { describe, expect, it } from "vitest";
import { centreOn, clampPan, panToShow, shows, zoomedHeight, zoomedSide, type ZoomGeo } from "./zoom";

/** Tripwire mega (9 × 14) on a 320 × 568 phone: 19 px overview tiles, 44 px zoomed (games/tripwire/Board.tsx). */
const fit = 19;
const g: ZoomGeo = { n: 9, rows: 14, cell: 44, gap: 3, pad: 6, view: 9 * fit + 8 * 3 + 12, viewH: 14 * fit + 13 * 3 + 12 };

describe("tap-to-zoom on a grid that is not square", () => {
  it("measures both sides of the zoomed grid", () => {
    expect(zoomedSide(g)).toBe(9 * 44 + 8 * 3 + 12);
    expect(zoomedHeight(g)).toBe(14 * 44 + 13 * 3 + 12);
  });

  it("keeps a pan inside the grid on each axis", () => {
    expect(clampPan({ x: -5, y: 9999 }, g)).toEqual({ x: 0, y: zoomedHeight(g) - g.viewH! });
    expect(clampPan({ x: 9999, y: -1 }, g)).toEqual({ x: zoomedSide(g) - g.view, y: 0 });
  });

  it("brings every tile, tapped on the whole board, wholly into view", () => {
    for (let r = 0; r < 14; r++)
      for (let c = 0; c < 9; c++) {
        const p = centreOn(r, c, g);
        expect(shows(p, r, c, g), `${r},${c}`).toBe(true);
        expect(p).toEqual(clampPan(p, g));
      }
  });

  it("moves just enough to show a far tile (keyboard focus, a hint)", () => {
    const p = panToShow({ x: 0, y: 0 }, 13, 8, g);
    expect(shows(p, 13, 8, g)).toBe(true);
    expect(panToShow(p, 13, 8, g)).toEqual(p);
  });

  it("stays square when rows and viewH are left out (Light Up)", () => {
    const sq: ZoomGeo = { n: 10, cell: 48, gap: 1, pad: 3, view: 300 };
    expect(zoomedHeight(sq)).toBe(zoomedSide(sq));
    expect(clampPan({ x: 9999, y: 9999 }, sq)).toEqual({ x: zoomedSide(sq) - 300, y: zoomedSide(sq) - 300 });
  });
});
