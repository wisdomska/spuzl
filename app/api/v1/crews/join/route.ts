import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { normaliseCode } from "@/lib/social";
import { CREW_MAX } from "@/lib/social/crews";

const Join = z.object({ code: z.string().trim().min(4).max(12) });

/** POST /api/v1/crews/join: join a crew by its code (up to 20 members). */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `crew-join:${player.id}`, 20, 3600);
  const { code } = await body(req, Join);
  const { data: crew } = await admin.from("crews").select("id").eq("join_code", normaliseCode(code)).maybeSingle();
  if (!crew) throw new ApiError(404, "not_found", "No crew with that code.");
  const { count } = await admin.from("crew_members").select("player_id", { count: "exact", head: true }).eq("crew_id", crew.id);
  if ((count ?? 0) >= CREW_MAX) throw new ApiError(409, "crew_full", "That crew is full.");
  const { error } = await admin.from("crew_members").insert({ crew_id: crew.id, player_id: player.id });
  if (error?.code === "23505") {
    const { data: mine } = await admin.from("crew_members").select("crew_id").eq("player_id", player.id).maybeSingle();
    if (mine?.crew_id === crew.id) return ok({ id: crew.id });
    throw new ApiError(409, "in_crew", "Leave your crew first.");
  }
  if (error) throw error;
  return ok({ id: crew.id });
});
