import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { blockedIds, friendIds } from "@/lib/social/server";
import { REACTIONS } from "@/lib/social";

const React_ = z.object({ reaction: z.enum(REACTIONS).nullable() });

/** POST /api/v1/feed/:id/react: set or clear your preset reaction on a visible event (no free text, FR-SO-04). */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/feed/[id]/react">) => {
  const { id } = await ctx.params;
  if (!/^\d{1,18}$/.test(id)) throw new ApiError(400, "invalid_id");
  const { admin, player } = await requirePlayer();
  // Max 1 emote per 3 s per player (Components file), as a per-minute window.
  await rateLimit(admin, `react:${player.id}`, 20, 60);
  const { reaction } = await body(req, React_);
  const { data: ev } = await admin.from("feed_events").select("id, player_id").eq("id", Number(id)).maybeSingle();
  if (!ev) throw new ApiError(404, "not_found");
  if (ev.player_id !== player.id) {
    const [friends, blocked] = await Promise.all([friendIds(admin, player.id), blockedIds(admin, player.id)]);
    if (!friends.includes(ev.player_id) || blocked.has(ev.player_id)) throw new ApiError(404, "not_found");
    const { data: owner } = await admin.from("players").select("hide_activity").eq("id", ev.player_id).maybeSingle();
    if (owner?.hide_activity) throw new ApiError(404, "not_found");
  }
  if (reaction === null) {
    const { error } = await admin.from("reactions").delete().eq("event_id", ev.id).eq("player_id", player.id);
    if (error) throw error;
  } else {
    const { error } = await admin
      .from("reactions")
      .upsert(
        { event_id: ev.id, player_id: player.id, reaction, created_at: new Date().toISOString() },
        { onConflict: "event_id,player_id" },
      );
    if (error) throw error;
  }
  return ok({ ok: true });
});
