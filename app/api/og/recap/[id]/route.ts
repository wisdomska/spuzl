import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";
import { getGameSettings } from "@/lib/game-settings/server";
import { notFoundImage, parseCardQuery, renderRecapCard } from "@/lib/og/render";
import { verifyRecapToken } from "@/lib/share/recap-token";
import { loadRecapCard } from "@/lib/recap/weekly.server";

/**
 * GET /api/og/recap/:token: a player's weekly recap card (1080 × 1920 PNG; `?size=small` for half size, R3-10).
 * Public like the other cards (link previews carry no session), but keyed by a signed token that only the player
 * gets from /api/v1/me/weekly-recap. 404 while the admin setting "weeklyRecap.enabled" is off.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/og/recap/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  if (!hasSupabase()) return notFoundImage();
  try {
    if (!(await getGameSettings())["weeklyRecap.enabled"]) return notFoundImage();
    const t = verifyRecapToken(id);
    if (!t) return notFoundImage();
    const card = await loadRecapCard(supabaseAdmin(), t.playerId, t.week);
    if (!card) return notFoundImage();
    return await renderRecapCard(card, parseCardQuery(req.url).scale);
  } catch (e) {
    console.error("[og]", e);
    return new Response("Card unavailable", { status: 500, headers: { "cache-control": "no-store" } });
  }
}
