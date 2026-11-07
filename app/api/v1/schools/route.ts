import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { searchSchools } from "@/lib/schools/server";

/**
 * GET /api/v1/schools?q=: verified schools and campuses by name, for a player 16 or over picking theirs (R2-P5).
 * 403 use_class_code for under-16s (a teacher's class code is their only way in); 404 while
 * "features.schoolLeagues" is off.
 */
export const GET = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `school-search:${player.id}`, 60, 60);
  return ok(await searchSchools(admin, player, new URL(req.url).searchParams.get("q") ?? ""));
});
