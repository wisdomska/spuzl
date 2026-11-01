import { ImageResponse } from "next/og";
import { CARD_SIZES, STATUS_CARD_SIZE, type CardFormat, type CardModel, type StatusCardModel } from "@/lib/share/card-model";
import { ogFonts } from "./fonts";
import { ShareCard } from "./ShareCard";
import { StatusCard } from "./StatusCard";

/** Only layout comes from the query string: which frame, and full or half size (low-data mode). */
export function parseCardQuery(url: string): { format: CardFormat; scale: 1 | 0.5 } {
  const sp = new URL(url).searchParams;
  return {
    format: sp.get("format") === "square" ? "square" : "story",
    scale: sp.get("size") === "small" ? 0.5 : 1,
  };
}

export async function renderCard(card: CardModel, format: CardFormat, scale: 1 | 0.5 = 1, cacheSeconds = 300): Promise<ImageResponse> {
  const { width, height } = CARD_SIZES[format];
  return new ImageResponse(<ShareCard card={card} format={format} scale={scale} />, {
    width: width * scale,
    height: height * scale,
    fonts: await ogFonts(),
    headers: {
      "cache-control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds * 12}, stale-while-revalidate=86400`,
      "x-robots-tag": "noindex",
    },
  });
}

/** Status card (1080 × 1350, or half size). Drawn from live rows, so the cache is short. */
export async function renderStatusCard(card: StatusCardModel, scale: 1 | 0.5 = 1, cacheSeconds = 60): Promise<ImageResponse> {
  return new ImageResponse(<StatusCard card={card} scale={scale} />, {
    width: STATUS_CARD_SIZE.width * scale,
    height: STATUS_CARD_SIZE.height * scale,
    fonts: await ogFonts(),
    headers: {
      "cache-control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds * 5}, stale-while-revalidate=3600`,
      "x-robots-tag": "noindex",
    },
  });
}

export function notFoundImage(): Response {
  return new Response("Not found", { status: 404, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
}
