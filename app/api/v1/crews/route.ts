import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { makeCode } from "@/lib/social";
import { crewNameProblem } from "@/lib/social/crews";

export const dynamic = "force-dynamic";

/** GET /api/v1/crews: your crew, if any. */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  const { data } = await admin
    .from("crew_members")
    .select("role, crews(id, name, color, join_code)")
    .eq("player_id", player.id)
    .maybeSingle();
  const crew = data?.crews as unknown as { id: string; name: string; color: string; join_code: string } | null;
  return ok({ crew: crew ? { id: crew.id, name: crew.name, color: crew.color, code: crew.join_code, role: data!.role } : null });
});

const Create = z.object({
  name: z.string().trim().min(3).max(24),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

/** POST /api/v1/crews: create a crew. You become its captain. One crew per player. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `crew-create:${player.id}`, 5, 86400);
  const input = await body(req, Create);
  const name = input.name.replace(/\s+/g, " ");
  const problem = crewNameProblem(name);
  if (problem) throw new ApiError(422, "name_rejected", problem);
  const { data: mine } = await admin.from("crew_members").select("crew_id").eq("player_id", player.id).maybeSingle();
  if (mine) throw new ApiError(409, "in_crew", "Leave your crew first.");
  for (let i = 0; i < 5; i++) {
    const { data: crew, error } = await admin
      .from("crews")
      .insert({ name, color: input.color ?? "#B8F23A", owner_id: player.id, join_code: makeCode(6) })
      .select("id, join_code")
      .single();
    if (error?.code === "23505" && error.message.includes("name")) throw new ApiError(409, "name_taken", "That crew name is taken.");
    if (error?.code === "23505") continue; // join code collision
    if (error) throw error;
    const { error: e2 } = await admin.from("crew_members").insert({ crew_id: crew.id, player_id: player.id, role: "captain" });
    if (e2) {
      await admin.from("crews").delete().eq("id", crew.id);
      if (e2.code === "23505") throw new ApiError(409, "in_crew", "Leave your crew first.");
      throw e2;
    }
    return ok({ id: crew.id, code: crew.join_code });
  }
  throw new Error("crew code");
});
