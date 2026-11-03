import { cardRoute } from "@/lib/og/route";
import { notFoundImage, parseCardQuery, renderDuelCard } from "@/lib/og/render";
import { duelShare, matchCard } from "@/lib/share/cards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";

/**
 * GET /api/og/match/:matchId: a finished Duel (the SPIL-style card, from `?p=<playerId>`'s side; `?anon=1` hides
 * both names) or a Party podium (`?p` picks whose place it shows). Numbers always come from the database.
 */
const party = cardRoute((admin, id, url) => matchCard(admin, id, url.searchParams.get("p")));

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!hasSupabase()) return notFoundImage();
  try {
    const sp = new URL(req.url).searchParams;
    const duel = await duelShare(supabaseAdmin(), id, sp.get("p"), sp.get("anon") === "1");
    if (duel) {
      const { format, scale } = parseCardQuery(req.url);
      return await renderDuelCard(duel, format, scale);
    }
  } catch (e) {
    console.error("[og duel]", e);
  }
  return party(req, ctx);
}
