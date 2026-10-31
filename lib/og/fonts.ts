import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Font data for `next/og`. Satori reads TTF/OTF/WOFF only (not WOFF2), so the OFL-licensed TTFs live
 * in assets/fonts (licences alongside). Loaded once per server instance.
 */
export interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal";
}

const FILES: { name: string; file: string; weight: OgFont["weight"] }[] = [
  { name: "Unbounded", file: "Unbounded-900.ttf", weight: 900 },
  { name: "Unbounded", file: "Unbounded-700.ttf", weight: 700 },
  { name: "Geist", file: "Geist-600.ttf", weight: 600 },
  { name: "Geist Mono", file: "GeistMono-600.ttf", weight: 600 },
];

let cache: Promise<OgFont[]> | null = null;

export function ogFonts(): Promise<OgFont[]> {
  cache ??= Promise.all(
    FILES.map(async (f) => {
      const buf = await readFile(join(process.cwd(), "assets", "fonts", f.file));
      const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      return { name: f.name, data, weight: f.weight, style: "normal" as const };
    }),
  ).catch((e) => {
    cache = null;
    throw e;
  });
  return cache;
}
