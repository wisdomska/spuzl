import { SAMPLE_CARDS, SAMPLE_STATUS, type CardKind } from "@/lib/share/card-model";
import { SAMPLE_CHALLENGE } from "@/lib/share/challenge-card";
import { notFoundImage, parseCardQuery, renderCard, renderChallengeCard, renderStatusCard } from "@/lib/og/render";

/** GET /api/og/sample/:kind: the design's sample cards, for visual parity checks. Hidden in production. */
export async function GET(req: Request, ctx: RouteContext<"/api/og/sample/[kind]">) {
  if (process.env.VERCEL_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "1") return notFoundImage();
  const { kind } = await ctx.params;
  const { format, scale } = parseCardQuery(req.url);
  if (kind === "status") return renderStatusCard(SAMPLE_STATUS, scale, 60);
  // Friend challenge: the 1200 × 630 link preview, or ?format=story for the 9:16 story card.
  if (kind === "challenge")
    return renderChallengeCard(SAMPLE_CHALLENGE, new URL(req.url).searchParams.get("format") === "story" ? "story" : "og", scale, 60);
  const card = SAMPLE_CARDS[kind as CardKind];
  if (!card) return notFoundImage();
  return renderCard(card, format, scale, 60);
}
