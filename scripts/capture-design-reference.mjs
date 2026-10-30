// Captures every data-screen-label frame from the design handoff into tests/visual/reference/.
// Usage: serve design/design_handoff_spuzl on :5055, then `node scripts/capture-design-reference.mjs`.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.DESIGN_URL || "http://localhost:5055/design/";
const OUT = path.resolve("tests/visual/reference");
const dir = path.resolve("design/design_handoff_spuzl/design");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".dc.html"));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const browser = await chromium.launch();
const index = [];
for (const file of files) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(BASE + encodeURIComponent(file), { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const fslug = slug(file.replace(".dc.html", ""));
  await page.screenshot({ path: `${OUT}/${fslug}__full.png`, fullPage: true });
  const labels = await page.$$("[data-screen-label]");
  for (const el of labels) {
    const label = await el.getAttribute("data-screen-label");
    const box = await el.boundingBox();
    if (!box || box.width < 10) continue;
    const name = `${fslug}__${slug(label)}.png`;
    await el.screenshot({ path: `${OUT}/${name}` });
    index.push({ file, label, name, w: Math.round(box.width), h: Math.round(box.height) });
  }
  await page.close();
}
fs.writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 2));
await browser.close();
console.log(`captured ${index.length} frames`);
