import { z } from "zod";
import { handle, ok, requirePlayer, todayGmt } from "@/lib/api/server";
import { badgeOverview, gameStats, worldRanks } from "@/lib/meta/server";

export const dynamic = "force-dynamic";

const Month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .optional();

/**
 * GET /api/v1/me/profile?month=YYYY-MM: everything the Me screen needs beyond /me:
 * clears, duel rating, rank per world, streak calendar (played, Full Spuzl, frozen), badges and per-game stats.
 */
export const GET = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  const today = todayGmt();
  const month = Month.parse(new URL(req.url).searchParams.get("month") ?? undefined) ?? today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  const games = await gameStats(admin, player.id);
  const [badges, ranks, played, full, frozen, place] = await Promise.all([
    badgeOverview(admin, player.id, games),
    worldRanks(admin, player.id),
    admin.from("daily_results").select("date").eq("player_id", player.id).gte("date", first).lte("date", last),
    admin.from("xp_ledger").select("ref_id").eq("player_id", player.id).eq("source", "full_spuzl").gte("ref_id", first).lte("ref_id", last),
    admin.from("streak_frozen_days").select("day").eq("player_id", player.id).gte("day", first).lte("day", last),
    admin.from("players").select("city, country, schools(name, verified_by)").eq("id", player.id).single(),
  ]);
  const playedSet = new Set((played.data ?? []).map((r) => r.date as string));
  const fullSet = new Set((full.data ?? []).map((r) => r.ref_id as string));
  const frozenSet = new Set((frozen.data ?? []).map((r) => r.day as string));
  const days = Array.from({ length: Number(last.slice(8)) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const state = fullSet.has(date)
      ? "full"
      : playedSet.has(date)
        ? "played"
        : frozenSet.has(date)
          ? "frozen"
          : date > today
            ? "future"
            : "missed";
    return { date, state };
  });
  const school = place.data?.schools as unknown as { name: string; verified_by: string | null } | null;
  const pinned = badges.families
    .flatMap((f) => f.badges)
    .filter((b) => b.earned)
    .sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""))
    .slice(0, 4);

  return ok({
    clears: badges.stats.clears,
    duelRating: ranks.duel,
    worlds: ranks.worlds,
    place: { city: place.data?.city ?? null, country: place.data?.country ?? null, school: school?.verified_by ? school.name : null },
    calendar: { month, days },
    games,
    badges: { families: badges.families, earned: badges.earned, total: badges.total, secretsLeft: badges.secretsLeft },
    pinned,
  });
});
