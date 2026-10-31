/**
 * Renders the PWA app icons (public/icons) from the designed app icon, with the same Satori pipeline
 * as the share cards. Optional: `--samples <dir>` also writes the design-sample share cards for review.
 *
 *   pnpm tsx scripts/render-brand-images.tsx
 *   pnpm tsx scripts/render-brand-images.tsx --samples /tmp/cards
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/og/AppIcon";
import { renderCard } from "@/lib/og/render";
import { SAMPLE_CARDS, type CardKind } from "@/lib/share/card-model";

async function png(res: Response, file: string) {
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log("wrote", file);
}

const ICONS: { file: string; size: number; purpose: "any" | "maskable" }[] = [
  { file: "icon-192.png", size: 192, purpose: "any" },
  { file: "icon-512.png", size: 512, purpose: "any" },
  { file: "maskable-192.png", size: 192, purpose: "maskable" },
  { file: "maskable-512.png", size: 512, purpose: "maskable" },
  // iOS ignores transparency (it fills black), so the touch icon is the full-bleed variant.
  { file: "apple-touch-icon.png", size: 180, purpose: "maskable" },
];

async function main() {
  const dir = join(process.cwd(), "public", "icons");
  mkdirSync(dir, { recursive: true });
  for (const i of ICONS) {
    await png(new ImageResponse(<AppIcon size={i.size} purpose={i.purpose} />, { width: i.size, height: i.size }), join(dir, i.file));
  }

  const at = process.argv.indexOf("--samples");
  if (at > 0 && process.argv[at + 1]) {
    const out = process.argv[at + 1];
    mkdirSync(out, { recursive: true });
    for (const k of Object.keys(SAMPLE_CARDS) as CardKind[]) {
      for (const f of ["story", "square"] as const) await png(await renderCard(SAMPLE_CARDS[k], f), join(out, `${k}-${f}.png`));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
