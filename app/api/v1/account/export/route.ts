import { handle, rateLimit, requireUser } from "@/lib/api/server";

export const dynamic = "force-dynamic";

/** Tables keyed by player and the column that holds the player's id. */
const OWNED: [string, string][] = [
  ["streaks", "player_id"],
  ["streak_frozen_days", "player_id"],
  ["ratings", "player_id"],
  ["xp_ledger", "player_id"],
  ["sparks_ledger", "player_id"],
  ["attempts", "player_id"],
  ["daily_results", "player_id"],
  ["player_badges", "player_id"],
  ["player_quests", "player_id"],
  ["inventory", "player_id"],
  ["league_members", "player_id"],
  ["invites", "player_id"],
  ["blocks", "player_id"],
  ["crew_members", "player_id"],
  ["feed_events", "player_id"],
  ["reactions", "player_id"],
  ["reports", "reporter_id"],
  ["match_players", "player_id"],
  ["challenges", "sender_id"],
  ["challenge_results", "player_id"],
  ["ghost_runs", "player_id"],
  ["school_cups", "teacher_id"],
  ["school_cup_members", "player_id"],
];

/**
 * Server-only puzzle columns left out of the export: a free-play seed rebuilds that board's solution, so it
 * never reaches the player (an open attempt could otherwise be solved from it). It says nothing about them.
 */
const HIDDEN: Record<string, string[]> = { attempts: ["free_seed"], challenges: ["free_seed"] };
const withoutHidden = (t: string, rows: unknown[]) =>
  HIDDEN[t] ? rows.map((r) => Object.fromEntries(Object.entries(r as object).filter(([k]) => !HIDDEN[t].includes(k)))) : rows;

/** GET /api/v1/account/export: a JSON download of everything stored about the player (FR-AC-05). */
export const GET = handle(async () => {
  const { user, admin } = await requireUser();
  await rateLimit(admin, `export:${user.id}`, 10, 3600);
  const { data: player } = await admin.from("players").select("*").eq("id", user.id).maybeSingle();
  const tables: Record<string, unknown[]> = {};
  await Promise.all(
    OWNED.map(async ([t, col]) => {
      const { data, error } = await admin.from(t).select("*").eq(col, user.id).limit(50_000);
      tables[t] = error ? [] : withoutHidden(t, data ?? []);
    }),
  );
  const { data: friends } = await admin.from("friendships").select("*").or(`player_id.eq.${user.id},friend_id.eq.${user.id}`);
  tables.friendships = friends ?? [];
  // The request identity carries only JWT claims: read the full auth record for the export.
  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  const doc = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: authUser.user?.email ?? user.email ?? null,
      anonymous: !!(authUser.user?.is_anonymous ?? user.is_anonymous),
      created_at: authUser.user?.created_at ?? null,
    },
    player,
    ...tables,
  };
  return new Response(JSON.stringify(doc, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="spuzl-${player?.nickname ?? "account"}-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
});
