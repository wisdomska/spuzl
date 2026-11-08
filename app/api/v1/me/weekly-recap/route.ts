import { ApiError, handle, ok, requirePlayer } from "@/lib/api/server";
import { getGameSettings } from "@/lib/game-settings/server";
import { hasRecap, recapWeeks } from "@/lib/recap/weekly";
import { loadWeeklyRecap, recapOptions } from "@/lib/recap/weekly.server";
import { recapCard, recapShareText, recapStats, RECAP_CARD_SIZE } from "@/lib/share/recap-card";
import { signRecapToken } from "@/lib/share/recap-token";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/weekly-recap: the signed-in player's recap of last GMT week (R3-10), computed from existing rows
 * (nothing is stored), with the signed share card link and spoiler-free share text. `recap` is null when the player
 * cleared nothing and earned no Sparks that week. 404 while the admin setting "weeklyRecap.enabled" is off.
 * The stats follow the card's privacy rules (no league under 16, no streak while activity is hidden).
 */
export const GET = handle(async () => {
  if (!(await getGameSettings())["weeklyRecap.enabled"]) throw new ApiError(404, "weekly_recap_off");
  const { admin, player } = await requirePlayer();
  const { thisWeek, recapWeek } = recapWeeks(new Date());
  const [recap, opts] = await Promise.all([loadWeeklyRecap(admin, player.id, recapWeek), recapOptions(admin, player.id)]);
  if (!opts || !hasRecap(recap)) return ok({ thisWeek, week: recapWeek, recap: null, stats: [], card: null });
  const card = recapCard(recap, opts);
  return ok({
    thisWeek,
    week: recapWeek,
    recap,
    stats: recapStats(recap, opts),
    card: {
      image: `/api/og/recap/${signRecapToken(player.id, recapWeek)}`,
      width: RECAP_CARD_SIZE.width,
      height: RECAP_CARD_SIZE.height,
      text: recapShareText(recap),
      alt: card.alt,
    },
  });
});
