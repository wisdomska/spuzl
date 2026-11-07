import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { myLeague } from "@/lib/schools/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/schools/league: this week's school-vs-school table (school names, active players and the average
 * clears or Sparks; never a player), the player's own school and its rank, and whether they may search for a
 * school (16 and over). 404 while "features.schoolLeagues" is off.
 */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `school-league:${player.id}`, 60, 60);
  return ok(await myLeague(admin, player));
});
