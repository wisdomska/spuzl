import { handle, ok, requirePlayer } from "@/lib/api/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadMe } from "@/lib/server/player-data";

export const dynamic = "force-dynamic";

/** GET /api/v1/me. With ?optional=1, "no session" and "no profile yet" answer 200 null instead of 401/409. */
export const GET = handle(async (req: Request) => {
  if (new URL(req.url).searchParams.get("optional") === "1") {
    const user = await currentUser();
    if (!user) return ok(null);
    const { data } = await supabaseAdmin().from("players").select("id").eq("id", user.id).maybeSingle();
    if (!data) return ok(null);
  }
  const { admin, player, user } = await requirePlayer();
  return ok(await loadMe(user, player, admin));
});
