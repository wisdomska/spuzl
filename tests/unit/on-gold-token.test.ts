import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const tokens = readFileSync(path.join(root, "styles/spuzl-tokens.css"), "utf8");

/** The declarations of the first block whose selector starts with `selector`. */
function block(selector: string): Record<string, string> {
  const at = tokens.indexOf(`${selector} {`);
  const body = tokens.slice(at, tokens.indexOf("}", at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
};

describe("--on-gold (UX pass)", () => {
  const dark = block(":root");
  const light = { ...dark, ...block('[data-theme="light"]') };

  it("reads at 4.5:1 or more on gold in both themes", () => {
    expect(contrast(dark["--gold"], dark["--on-gold"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light["--gold"], light["--on-gold"])).toBeGreaterThanOrEqual(4.5);
  });

  it("follows every colour-blind mode that changes gold, in either theme", () => {
    for (const mode of ['[data-cb="protan"]', '[data-cb="tritan"]']) {
      const cb = block(mode);
      expect(cb["--gold"]).toBeDefined();
      expect(cb["--on-gold"]).toBeDefined();
      expect(contrast(cb["--gold"], cb["--on-gold"])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
