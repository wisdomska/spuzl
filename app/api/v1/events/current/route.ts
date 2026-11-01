import { handle, ok } from "@/lib/api/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { activeEvent, publicEvent } from "@/lib/events/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/current: the seasonal event running now (name, window, accent token, banner copy and its
 * bonus quest summary), or `{ event: null }` when none is running or the admin setting "features.seasonal" is off.
 * Public: nothing here is per player.
 */
export const GET = handle(async () => {
  const e = await activeEvent(supabaseAdmin());
  return ok({ event: e ? publicEvent(e) : null }, { headers: { "cache-control": "public, max-age=30, s-maxage=30" } });
});
