// Pre-renders the design's three.js assets to static WebP so production never runs three.js on the client.
//   - 12 Staunton chess sprites (spuzl3d.js pieces()) at 2x into public/3d/pieces/<w|b><K|Q|R|B|N|P>.webp
//   - 51 game icons (spuzl3d.js icon(name, worldColour)) into public/3d/icons/<gameId>.webp
// Usage: pnpm prerender:3d   (needs network for three@0.160.0 from esm.sh and Phosphor SVGs from unpkg,
// both pinned in design/design_handoff_spuzl/design/spuzl3d.js)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DESIGN = path.join(ROOT, "design/design_handoff_spuzl/design");
const OUT_PIECES = path.join(ROOT, "public/3d/pieces");
const OUT_ICONS = path.join(ROOT, "public/3d/icons");
/** Board squares are 40 to 48 CSS px and sprites draw at 190% of a square, so 192 px covers 2x. */
const PIECE_PX = Number(process.env.PIECE_PX || 192);
/** Icons display up to 76 CSS px with a 142% overflow box, so 216 px covers 2x. */
const ICON_PX = Number(process.env.ICON_PX || 216);
const QUALITY = 0.9;

/** World fills from styles/spuzl-tokens.css (dark theme values the design renders with). */
const WORLD_HEX = {
  logic: "#8B7CFF", line: "#2FD3E0", shape: "#FF8A3D", number: "#FFD23F", word: "#3DDC84",
  clue: "#FF6B6B", reflex: "#4D8BFF", rage: "#FF3B3B", board: "#F27ADB",
};

/** Reads id, world and icon for every game from lib/catalog.ts (plain node, no TS loader needed). */
function catalogue() {
  const src = fs.readFileSync(path.join(ROOT, "lib/catalog.ts"), "utf8");
  const re = /\bg\(\s*"([a-z0-9-]+)",\s*"[^"]*",\s*"([a-z]+)",\s*"([a-z0-9-]+)"/g;
  const out = [];
  for (const m of src.matchAll(re)) out.push({ id: m[1], world: m[2], icon: m[3] });
  return out;
}

function serve(dir) {
  const types = { ".js": "text/javascript", ".html": "text/html" };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    if (url === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><meta charset=utf-8><title>prerender</title>");
      return;
    }
    const file = path.join(dir, path.normalize(url));
    if (!file.startsWith(dir) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function writeDataUrl(file, dataUrl) {
  const [, b64] = dataUrl.split(",");
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
}

const games = catalogue();
if (games.length !== 51) throw new Error(`expected 51 games in lib/catalog.ts, found ${games.length}`);
fs.mkdirSync(OUT_PIECES, { recursive: true });
fs.mkdirSync(OUT_ICONS, { recursive: true });

const server = await serve(DESIGN);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(base + "/");

// Converts the blob/data URL the renderer returns into a WebP data URL inside the page.
await page.evaluate(() => {
  window.toWebp = async (src, q) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    return c.toDataURL("image/webp", q);
  };
});

const pieces = await page.evaluate(
  async ({ size, q }) => {
    const m = await import("/spuzl3d.js");
    const map = await m.pieces(size);
    const out = {};
    for (const [k, v] of Object.entries(map)) out[k] = await window.toWebp(v, q);
    return out;
  },
  { size: PIECE_PX, q: QUALITY },
);
for (const [k, v] of Object.entries(pieces)) writeDataUrl(path.join(OUT_PIECES, `${k}.webp`), v);
console.log(`pieces: ${Object.keys(pieces).length} sprites at ${PIECE_PX}px`);
if (Object.keys(pieces).length !== 12) throw new Error("expected 12 chess sprites");

let n = 0;
for (const g of games) {
  const color = WORLD_HEX[g.world];
  const url = await page.evaluate(
    async ({ icon, color, size, q }) => {
      const m = await import("/spuzl3d.js");
      return window.toWebp(await m.icon(icon, color, size), q);
    },
    { icon: g.icon, color, size: ICON_PX, q: QUALITY },
  );
  writeDataUrl(path.join(OUT_ICONS, `${g.id}.webp`), url);
  n++;
}
console.log(`icons: ${n} at ${ICON_PX}px`);

fs.writeFileSync(
  path.join(ROOT, "public/3d/manifest.json"),
  JSON.stringify(
    {
      source: "design/design_handoff_spuzl/design/spuzl3d.js (three@0.160.0)",
      pieces: { size: PIECE_PX, files: Object.keys(pieces).sort().map((k) => `pieces/${k}.webp`) },
      icons: { size: ICON_PX, files: games.map((g) => ({ id: g.id, icon: g.icon, world: g.world, file: `icons/${g.id}.webp` })) },
    },
    null,
    2,
  ) + "\n",
);

await browser.close();
server.close();
