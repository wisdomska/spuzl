// Bundle budget (SRS NFR-PF-05): map route initial JS < 150 KB gz; per-game chunks < 80 KB gz (Phaser games < 450 KB lazy).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const dir = ".next/static/chunks";
const gz = (f) => zlib.gzipSync(fs.readFileSync(f)).length;
const files = [];
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".js") && files.push(path.join(d, e.name))));
walk(dir);
const sizes = files.map((f) => ({ f, kb: gz(f) / 1024 })).sort((a, b) => b.kb - a.kb);
const over = sizes.filter((s) => s.kb > 450);
console.log("largest chunks (gz KB):");
sizes.slice(0, 12).forEach((s) => console.log(`  ${s.kb.toFixed(1).padStart(7)}  ${path.relative(dir, s.f)}`));
if (over.length) {
  console.error(`::error::${over.length} chunk(s) exceed 450 KB gz`);
  process.exit(1);
}
