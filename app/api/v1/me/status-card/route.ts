import { ApiError, handle, ok, requirePlayer } from "@/lib/api/server";
import { getGameSettings } from "@/lib/game-settings/server";
import { signStatusToken } from "@/lib/share/status-token";
import { loadStatusCard } from "@/lib/share/status";
import { statusShareText } from "@/lib/share/text";
import { STATUS_CARD_SIZE } from "@/lib/share/card-model";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/status-card: the signed-in player's status card link and share text (Me, "Share my status").
 * 404 while the admin setting "features.statusCards" is off. The text comes from the same model as the image,
 * so both follow the same privacy rules (no level or rank under 16, no streak or world while activity is hidden).
 */
export const GET = handle(async () => {
  if (!(await getGameSettings())["features.statusCards"]) throw new ApiError(404, "not_found");
  const { admin, player } = await requirePlayer();
  const card = await loadStatusCard(admin, player.id);
  if (!card) throw new ApiError(404, "not_found");
  return ok({
    image: `/api/og/status/${signStatusToken(player.id)}`,
    width: STATUS_CARD_SIZE.width,
    height: STATUS_CARD_SIZE.height,
    text: statusShareText(card),
    alt: card.alt,
  });
});
