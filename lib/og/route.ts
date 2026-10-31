import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";
import type { CardModel } from "@/lib/share/card-model";
import { notFoundImage, parseCardQuery, renderCard } from "./render";

/**
 * GET handler factory for share card images. Public by design (link previews carry no session):
 * the service-role read is limited to the card's own fields, keyed by an unguessable id, and only
 * cleared, verified results render. Anything else is a plain 404.
 */
export function cardRoute(load: (admin: SupabaseClient, id: string, url: URL) => Promise<CardModel | null>) {
  return async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
    const { id } = await ctx.params;
    if (!hasSupabase()) return notFoundImage();
    try {
      const card = await load(supabaseAdmin(), id, new URL(req.url));
      if (!card) return notFoundImage();
      const { format, scale } = parseCardQuery(req.url);
      return await renderCard(card, format, scale);
    } catch (e) {
      console.error("[og]", e);
      return new Response("Card unavailable", { status: 500, headers: { "cache-control": "no-store" } });
    }
  };
}
