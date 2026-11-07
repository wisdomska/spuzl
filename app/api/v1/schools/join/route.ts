import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { joinSchool, leaveSchool } from "@/lib/schools/server";

const Join = z.object({ schoolId: z.string().uuid() }).strict();

/** POST /api/v1/schools/join { schoolId }: a player 16 or over picks their verified school (once a week). */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `school-join:${player.id}`, 20, 3600);
  const { schoolId } = await body(req, Join);
  return ok(await joinSchool(admin, player, schoolId));
});

/** DELETE /api/v1/schools/join: leaves the school. */
export const DELETE = handle(async () => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `school-join:${player.id}`, 20, 3600);
  return ok(await leaveSchool(admin, player));
});
