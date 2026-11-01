import { SAMPLE_CARDS, SAMPLE_STATUS, type CardKind } from "@/lib/share/card-model";
import { notFoundImage, parseCardQuery, renderCard, renderStatusCard } from "@/lib/og/render";

/** GET /api/og/sample/:kind: the design's sample cards, for visual parity checks. Hidden in production. */
export async function GET(req: Request, ctx: RouteContext<"/api/og/sample/[kind]">) {
  if (process.env.VERCEL_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "1") return notFoundImage();
  const { kind } = await ctx.params;
  const { format, scale } = parseCardQuery(req.url);
  if (kind === "status") return renderStatusCard(SAMPLE_STATUS, scale, 60);
  const card = SAMPLE_CARDS[kind as CardKind];
  if (!card) return notFoundImage();
  return renderCard(card, format, scale, 60);
}
