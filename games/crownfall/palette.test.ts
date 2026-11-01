/**
 * Crownfall region palette contrast (docs/qa/CROWNFALL_PALETTE.md).
 *
 * Metric: CIEDE2000 colour difference (ΔE00) between region colours, computed on the colours as seen
 * with normal vision and under Machado 2009 full-severity protanopia, deuteranopia and tritanopia.
 * Thresholds:
 *   - normal vision: ΔE00 >= 18 for EVERY pair of palette colours
 *   - each dichromacy simulation: ΔE00 >= 9 for EVERY pair
 *   - every region colour >= 4.5:1 WCAG contrast against var(--text), which draws crowns and region edges
 *   - the X mark (var(--mark-x)) >= 3:1 on every region colour (a non-text graphic, WCAG 1.4.11)
 *   - colour-blind pattern textures visible on every patterned region (>= 1.2:1 between texture and region)
 * Both themes are read straight from app/globals.css, so the test checks what ships.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseHex, visibleDifference, VISIONS, type Rgb, type Vision } from "@/lib/a11y/colour";
import { createRng } from "@/lib/rng";
import { CROWNFALL_COPY } from "@/lib/copy/crownfall";
import type { Difficulty } from "@/games/types";
import { generate } from "./logic";

const MIN_DELTA_E: Record<Vision, number> = { normal: 18, protanopia: 9, deuteranopia: 9, tritanopia: 9 };
const MIN_TEXT_CONTRAST = 4.5;
const MIN_MARK_CONTRAST = 3;
const MIN_PATTERN_CONTRAST = 1.2;

const root = join(__dirname, "..", "..");
const globals = readFileSync(join(root, "app/globals.css"), "utf8");
const tokens = readFileSync(join(root, "styles/spuzl-tokens.css"), "utf8");

/** Reads `--name: #hex` declarations from every top-level block whose selector is exactly `selector`. */
function block(css: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/(?:^|\n)([^\n{}]+?)\s*\{([^}]*)\}/g)) {
    if (m[1].trim() !== selector) continue;
    for (const d of m[2].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) out[d[1]] = d[2];
  }
  if (!Object.keys(out).length) throw new Error(`no ${selector} block`);
  return out;
}

const THEMES = {
  dark: { regions: block(globals, ":root"), text: block(tokens, ":root").text },
  light: { regions: block(globals, '[data-theme="light"]'), text: block(tokens, '[data-theme="light"]').text },
};

/** `--name: <raw value>;` from the first top-level block whose selector is exactly `selector`. */
function rawVar(css: string, selector: string, name: string): string {
  for (const m of css.matchAll(/(?:^|\n)([^\n{}]+?)\s*\{([^}]*)\}/g)) {
    if (m[1].trim() !== selector) continue;
    const d = m[2].match(new RegExp(`--${name}:\\s*([^;]+);`));
    if (d) return d[1].trim();
  }
  throw new Error(`no --${name} in ${selector}`);
}
const SELECTOR = { dark: ":root", light: '[data-theme="light"]' } as const;

/** Pattern alpha per region, as written in the [data-cb] [data-region="N"] rules (the faintest layer). */
const PATTERN_ALPHA = new Map<number, number>();
for (const m of globals.matchAll(/\[data-cb\] \[data-region="(\d)"\]\s*\{([^}]*)\}/g)) {
  const alphas = [...m[2].matchAll(/calc\(([\d.]+) \* var\(--pattern-boost\)\)/g)].map((a) => Number(a[1]));
  if (alphas.length) PATTERN_ALPHA.set(Number(m[1]), Math.min(...alphas));
}

const over = (bg: Rgb, ink: Rgb, a: number): Rgb => [0, 1, 2].map((k) => ink[k] * a + bg[k] * (1 - a)) as unknown as Rgb;

function palette(theme: keyof typeof THEMES): Rgb[] {
  const regs = THEMES[theme].regions;
  return Array.from({ length: 10 }, (_, i) => parseHex(regs[`reg-${i}`]));
}

function failures(cols: Rgb[], pairs: [number, number][]): string[] {
  const out: string[] = [];
  for (const v of VISIONS) {
    for (const [i, j] of pairs) {
      const d = visibleDifference(cols[i], cols[j], v);
      if (d < MIN_DELTA_E[v]) out.push(`${v} ${CROWNFALL_COPY.regionName(i)}/${CROWNFALL_COPY.regionName(j)} ΔE ${d.toFixed(2)}`);
    }
  }
  return out;
}

const allPairs: [number, number][] = [];
for (let i = 0; i < 10; i++) for (let j = i + 1; j < 10; j++) allPairs.push([i, j]);

describe("crownfall region palette", () => {
  it("names one colour per palette slot", () => {
    expect(CROWNFALL_COPY.regionNames).toHaveLength(10);
    expect(new Set(CROWNFALL_COPY.regionNames).size).toBe(10);
  });

  for (const theme of ["dark", "light"] as const) {
    it(`${theme}: every pair of colours passes ΔE00 under normal vision and all three dichromacies`, () => {
      expect(failures(palette(theme), allPairs)).toEqual([]);
    });

    it(`${theme}: every colour keeps ${MIN_TEXT_CONTRAST}:1 against the crown and edge colour`, () => {
      const text = parseHex(THEMES[theme].text);
      for (const c of palette(theme)) expect(contrastRatio(c, text)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    });

    it(`${theme}: the X mark keeps ${MIN_MARK_CONTRAST}:1 on every region colour`, () => {
      const mark = parseHex(rawVar(globals, SELECTOR[theme], "mark-x"));
      const low = palette(theme)
        .map((c, i) => ({ region: CROWNFALL_COPY.regionName(i), ratio: contrastRatio(c, mark) }))
        .filter((x) => x.ratio < MIN_MARK_CONTRAST);
      expect(low).toEqual([]);
    });

    it(`${theme}: colour-blind pattern textures show on every patterned region`, () => {
      const ink = rawVar(globals, SELECTOR[theme], "pattern-ink").split(/\s+/).map(Number) as unknown as Rgb;
      const boost = Number(rawVar(globals, SELECTOR[theme], "pattern-boost"));
      expect(PATTERN_ALPHA.size).toBe(9);
      const cols = palette(theme);
      for (const [region, alpha] of PATTERN_ALPHA) {
        const ratio = contrastRatio(cols[region], over(cols[region], ink, Math.min(1, alpha * boost)));
        expect(ratio, `${theme} ${CROWNFALL_COPY.regionName(region)}`).toBeGreaterThanOrEqual(MIN_PATTERN_CONTRAST);
      }
    });

    it(`${theme}: adjacent regions on 10 seeded boards pass`, () => {
      const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
      for (let k = 0; k < 10; k++) {
        const { puzzle } = generate(createRng(`palette:${k}`), diffs[k % diffs.length]);
        const n = puzzle.size;
        const adj = new Set<string>();
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++) {
            const g = puzzle.regions[r * n + c];
            for (const [rr, cc] of [
              [r + 1, c],
              [r, c + 1],
              [r + 1, c + 1],
              [r + 1, c - 1],
            ]) {
              if (rr >= n || cc < 0 || cc >= n) continue;
              const h = puzzle.regions[rr * n + cc];
              if (h !== g) adj.add([Math.min(g, h), Math.max(g, h)].join(","));
            }
          }
        expect(adj.size).toBeGreaterThan(0);
        const pairs = [...adj].map((s) => s.split(",").map(Number) as [number, number]);
        expect(failures(palette(theme), pairs)).toEqual([]);
      }
    }, 30_000);
  }
});
