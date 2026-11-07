import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";
import { notFoundImage, parseCardQuery, renderChallengeCard } from "@/lib/og/render";
import { loadChallengeCard } from "@/lib/share/challenge";
import { getGameSettings } from "@/lib/game-settings/server";

/**
 * GET /api/og/challenge/:code: a friend challenge's link preview (1200 × 630 PNG; `?format=story` for the
 * 1080 × 1920 story card, `?size=small` for half size). Public like the other cards (link previews carry no
 * session); everything on it comes from the challenge row and the sender's nickname, colour and hat. 404 for an
 * unknown or expired code, and while the admin setting "features.challenges" is off.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/og/challenge/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  if (!hasSupabase()) return notFoundImage();
  try {
    const card = await loadChallengeCard(supabaseAdmin(), id);
    if (!card) return notFoundImage();
    const story = new URL(req.url).searchParams.get("format") === "story";
    // The 9:16 story is its own switch ("features.storyCards"); the link preview only needs challenges on.
    if (story && !(await getGameSettings())["features.storyCards"]) return notFoundImage();
    return await renderChallengeCard(card, story ? "story" : "og", parseCardQuery(req.url).scale);
  } catch (e) {
    console.error("[og]", e);
    return new Response("Card unavailable", { status: 500, headers: { "cache-control": "no-store" } });
  }
}
