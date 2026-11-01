import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";
import { getGameSettings } from "@/lib/game-settings/server";
import { notFoundImage, parseCardQuery, renderStatusCard } from "@/lib/og/render";
import { verifyStatusToken } from "@/lib/share/status-token";
import { loadStatusCard } from "@/lib/share/status";

/**
 * GET /api/og/status/:token: a player's status card (1080 × 1350 PNG; `?size=small` for half size).
 * Public like the other cards (link previews carry no session), but keyed by a signed token that only the
 * player gets from /api/v1/me/status-card. 404 while the admin setting "features.statusCards" is off.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/og/status/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  if (!hasSupabase()) return notFoundImage();
  try {
    if (!(await getGameSettings())["features.statusCards"]) return notFoundImage();
    const playerId = verifyStatusToken(id);
    if (!playerId) return notFoundImage();
    const card = await loadStatusCard(supabaseAdmin(), playerId);
    if (!card) return notFoundImage();
    return await renderStatusCard(card, parseCardQuery(req.url).scale);
  } catch (e) {
    console.error("[og]", e);
    return new Response("Card unavailable", { status: 500, headers: { "cache-control": "no-store" } });
  }
}
