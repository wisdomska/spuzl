import { ApiError, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";

/** POST /api/v1/crews/leave: leave your crew. A leaving captain hands over to the longest-standing member. */
export const POST = handle(async () => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `crew-leave:${player.id}`, 20, 3600);
  const { data: me } = await admin.from("crew_members").select("crew_id, role").eq("player_id", player.id).maybeSingle();
  if (!me) throw new ApiError(404, "no_crew");
  const { error } = await admin.from("crew_members").delete().eq("player_id", player.id);
  if (error) throw error;
  const { data: rest } = await admin.from("crew_members").select("player_id").eq("crew_id", me.crew_id).order("joined_at").limit(1);
  if (!rest?.length) {
    await admin.from("crews").delete().eq("id", me.crew_id);
  } else if (me.role === "captain") {
    await admin.from("crew_members").update({ role: "captain" }).eq("crew_id", me.crew_id).eq("player_id", rest[0].player_id);
    await admin.from("crews").update({ owner_id: rest[0].player_id }).eq("id", me.crew_id);
  }
  return ok({ ok: true });
});
