import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { normaliseCode } from "@/lib/social";

const Join = z.object({ code: z.string().trim().min(4).max(12) });

/** POST /api/v1/school-cup/join: a student joins their class challenge with the code the teacher shared. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `cup-join:${player.id}`, 20, 3600);
  const { code } = await body(req, Join);
  const { data: cup } = await admin.from("school_cups").select("id, school_id").eq("join_code", normaliseCode(code)).maybeSingle();
  if (!cup) throw new ApiError(404, "not_found", "No class challenge with that code.");
  const { error } = await admin.from("school_cup_members").upsert({ cup_id: cup.id, player_id: player.id }, { onConflict: "cup_id,player_id", ignoreDuplicates: true });
  if (error) throw error;
  // Joining through a teacher's code links you to that verified school (FR-AC-06), unless you already have one.
  await admin.from("players").update({ school_id: cup.school_id }).eq("id", player.id).is("school_id", null);
  return ok({ id: cup.id });
});
