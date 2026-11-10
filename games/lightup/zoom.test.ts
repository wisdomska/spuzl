import { describe, expect, it } from "vitest";
import { fitCell } from "@/components/game/useBoardSize";
import { centreOn, clampPan, panToShow, shows, ZOOM_AT, ZOOM_CELL, zoomedSide, type ZoomGeo } from "./zoom";

/** The 10 × 10 board's geometry at a phone width (Board.tsx: gap 1, pad 3, `fitCell` with a 44 px floor). */
function geoAt(vw: number): { fit: number; g: ZoomGeo } {
  const n = 10,
    gap = 1,
    pad = 3;
  const fit = fitCell(vw, n, gap * (n - 1) + pad * 2, 44, 56);
  return { fit, g: { n, cell: ZOOM_CELL, gap, pad, view: n * fit + (n - 1) * gap + pad * 2 } };
}

describe("Light Up tap-to-zoom (R4-22)", () => {
  it("zooms 10 × 10 on phones (cells under 44 px), not on a laptop", () => {
    expect(geoAt(320).fit).toBeLessThan(ZOOM_AT);
    expect(geoAt(375).fit).toBeLessThan(ZOOM_AT);
    expect(geoAt(1280).fit).toBeGreaterThanOrEqual(ZOOM_AT);
    expect(ZOOM_CELL).toBeGreaterThanOrEqual(44);
  });

  for (const vw of [320, 360, 375, 390, 414]) {
    const { g } = geoAt(vw);
    if (g.view >= zoomedSide(g)) continue;
    it(`at ${vw} px every cell, tapped on the whole board, is wholly in view once zoomed`, () => {
      for (let r = 0; r < g.n; r++)
        for (let c = 0; c < g.n; c++) {
          const p = centreOn(r, c, g);
          expect(shows(p, r, c, g), `${r},${c}`).toBe(true);
          expect(p).toEqual(clampPan(p, g));
        }
    });
    it(`at ${vw} px focus moves bring any cell into view from any pan`, () => {
      for (const start of [{ x: 0, y: 0 }, { x: 9999, y: 9999 }, centreOn(4, 5, g)]) {
        const from = clampPan(start, g);
        for (let r = 0; r < g.n; r++)
          for (let c = 0; c < g.n; c++) expect(shows(panToShow(from, r, c, g), r, c, g), `${r},${c}`).toBe(true);
      }
    });
  }

  it("keeps the zoomed grid filling the frame (no empty edge)", () => {
    const { g } = geoAt(375);
    const max = zoomedSide(g) - g.view;
    expect(clampPan({ x: -50, y: max + 50 }, g)).toEqual({ x: 0, y: max });
  });

  it("only moves as far as it needs to show a cell", () => {
    const { g } = geoAt(375);
    const p = centreOn(5, 5, g);
    expect(panToShow(p, 5, 5, g)).toEqual(p);
    expect(panToShow(p, 5, 6, g)).toEqual(p);
  });
});
