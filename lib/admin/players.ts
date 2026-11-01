import "server-only";
import { randomInt } from "node:crypto";
import { ApiError } from "@/lib/api/server";
import { nicknameProblem } from "@/lib/validation/nickname";
import type { AdminCtx } from "./auth";
import { rangeOf, type PageParams } from "./pagination";
import { accountTypeOf, maskEmail, type AccountType, type PlayerRow, type PlayerSqlFilters } from "./player-filters";
import { can } from "./roles";
import { shortRef } from "./moderation";
import type { SortState } from "./sorting";

/** One page of the player list from `svc_admin_players`; the email is masked unless the role holds players.pii. */
export async function listPlayers(
  ctx: AdminCtx,
  filters: PlayerSqlFilters,
  sort: SortState,
  page: PageParams,
): Promise<{ rows: PlayerRow[]; total: number }> {
  if (filters.q_kind === "email" && !can(ctx.role, "players.pii"))
    throw new ApiError(403, "forbidden", "Your role cannot search by email. Search by nickname or player id.");
  const { from } = rangeOf(page);
  return queryPlayers(ctx, filters, sort, page.pageSize, from);
}

export async function queryPlayers(
  ctx: AdminCtx,
  filters: PlayerSqlFilters,
  sort: SortState,
  limit: number,
  offset: number,
): Promise<{ rows: PlayerRow[]; total: number }> {
  const { data, error } = await ctx.db.rpc("svc_admin_players", {
    p_filters: filters,
    p_sort: sort.sort,
    p_dir: sort.dir,
    p_limit: limit,
    p_offset: offset,
    p_with_email: can(ctx.role, "players.pii"),
  });
  if (error) {
    if (error.code === "22023") throw new ApiError(400, "bad_query", error.message);
    throw error;
  }
  const r = data as { total: number; rows: PlayerRow[] };
  return { rows: r.rows ?? [], total: Number(r.total ?? 0) };
}

/** A neutral name ("Puzzler1234") that passes the nickname filter; leet digits can spell a blocked word, so it draws again. */
export function safeNickname(): string {
  for (let i = 0; i < 50; i++) {
    const n = `Puzzler${randomInt(1000, 10000)}`;
    if (!nicknameProblem(n)) return n;
  }
  throw new ApiError(500, "no_nickname");
}

/** Is this user also on the admin team? Deleting or signing out a player must never touch an admin account. */
export async function isAdminAccount(ctx: AdminCtx, id: string): Promise<boolean> {
  const { data } = await ctx.db.from("admins").select("user_id").eq("user_id", id).maybeSingle();
  return !!data;
}

/** Audit actions that count as moderation history on the detail page. */
const MODERATION_ACTIONS = /^(player\.(ban|ban_void|unban|revoke_ranking|restore_ranking|reset|rename|signout)|flagged\.)/;

/**
 * Everything the player detail page shows. Location (city, country) and school are never read: under-16s keep them
 * private everywhere, and the console doesn't need them for anyone. The email is masked unless the role holds
 * players.pii; identity provider data (names, avatars, provider emails) is never returned.
 */
export async function playerDetail(ctx: AdminCtx, id: string) {
  const db = ctx.db;
  const pii = can(ctx.role, "players.pii");
  const { data: p, error } = await db
    .from("players")
    .select(
      "id, nickname, age_band, avatar_color, title, level, xp, sparks, created_at, last_seen_at, banned_at, banned_until, ban_reason, ranking_revoked, is_test",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!p) throw new ApiError(404, "player_not_found");

  const [
    { data: auth },
    { data: streak },
    { data: attempts },
    { count: attemptCount },
    { count: clears },
    { count: dailyClears },
    { count: flagged },
    { count: badges },
    { data: received },
    { data: made },
    { data: auditRows },
    { data: leagues },
    { data: inventory },
    { data: ledger },
    adminRow,
  ] = await Promise.all([
    db.auth.admin.getUserById(id),
    db.from("streaks").select("current, best, freezes_held, last_clear_date").eq("player_id", id).maybeSingle(),
    db
      .from("attempts")
      .select("id, game_id, mode, status, time_ms, hints, mistakes, started_at, finished_at, flag_reason")
      .eq("player_id", id)
      .order("started_at", { ascending: false })
      .limit(20),
    db.from("attempts").select("id", { count: "exact", head: true }).eq("player_id", id),
    db.from("attempts").select("id", { count: "exact", head: true }).eq("player_id", id).eq("status", "cleared"),
    db.from("daily_results").select("date", { count: "exact", head: true }).eq("player_id", id),
    db.from("attempts").select("id", { count: "exact", head: true }).eq("player_id", id).eq("status", "flagged"),
    db.from("player_badges").select("badge_id", { count: "exact", head: true }).eq("player_id", id),
    db
      .from("reports")
      .select("id, reason, status, created_at, resolution, target_type")
      .in("target_type", ["player", "nickname"])
      .eq("target_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("reports")
      .select("id, reason, status, created_at, target_type")
      .eq("reporter_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("audit_log")
      .select("id, actor_id, action, target, detail, created_at")
      .or(`target.eq."player:${id}",detail->>player.eq.${id}`)
      .order("id", { ascending: false })
      .limit(100),
    db.from("league_members").select("points, final_rank, result, leagues(tier, week_start, finalised_at)").eq("player_id", id),
    db
      .from("inventory")
      .select("cosmetic_id, equipped, acquired_at, cosmetics(name, type, rarity)")
      .eq("player_id", id)
      .order("acquired_at", { ascending: false })
      .limit(100),
    db.from("sparks_ledger").select("id, source, amount, created_at").eq("player_id", id).order("id", { ascending: false }).limit(25),
    db.from("admins").select("user_id").eq("user_id", id).maybeSingle(),
  ]);

  const user = auth?.user ?? null;
  const identities = (user?.identities ?? []).map((i) => ({
    provider: i.provider,
    created_at: i.created_at ?? null,
    last_sign_in_at: i.last_sign_in_at ?? null,
  }));
  const providers = identities.map((i) => i.provider);
  const account: AccountType = accountTypeOf(providers, !!user?.is_anonymous, user?.email);
  const email = user?.email ? (pii ? user.email : maskEmail(user.email)) : null;

  const actorIds = [...new Set((auditRows ?? []).map((a) => a.actor_id).filter(Boolean))] as string[];
  const { data: admins } = actorIds.length ? await db.from("admins").select("user_id, email").in("user_id", actorIds) : { data: [] };
  const actor = Object.fromEntries((admins ?? []).map((a) => [a.user_id, a.email as string | null]));
  const audit = (auditRows ?? []).map((a) => ({ ...a, actor: a.actor_id ? (actor[a.actor_id] ?? a.actor_id.slice(0, 8)) : null }));

  type League = { tier: number; week_start: string; finalised_at: string | null };
  const league = (leagues ?? [])
    .map((m) => {
      const l = (Array.isArray(m.leagues) ? m.leagues[0] : m.leagues) as League | null;
      return l
        ? { tier: l.tier, week_start: l.week_start, finalised: !!l.finalised_at, points: m.points, rank: m.final_rank, result: m.result }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.week_start.localeCompare(a.week_start))
    .slice(0, 6);

  return {
    profile: { ...p, nickname: String(p.nickname) },
    account: {
      type: account,
      email,
      emailVisible: pii,
      identities,
      lastSignInAt: user?.last_sign_in_at ?? null,
      isAdmin: !!adminRow.data,
    },
    stats: {
      streak: streak?.current ?? 0,
      bestStreak: streak?.best ?? 0,
      freezes: streak?.freezes_held ?? 0,
      lastClearDate: streak?.last_clear_date ?? null,
      attempts: attemptCount ?? 0,
      clears: clears ?? 0,
      dailyClears: dailyClears ?? 0,
      flagged: flagged ?? 0,
      badges: badges ?? 0,
    },
    attempts: attempts ?? [],
    reportsReceived: (received ?? []).map((r) => ({ ...r, ref: shortRef("R", r.id) })),
    reportsMade: (made ?? []).map((r) => ({ ...r, ref: shortRef("R", r.id) })),
    moderation: audit.filter((a) => MODERATION_ACTIONS.test(a.action)),
    audit,
    league,
    inventory: (inventory ?? []).map((i) => {
      const c = (Array.isArray(i.cosmetics) ? i.cosmetics[0] : i.cosmetics) as { name: string; type: string; rarity: string } | null;
      return {
        id: i.cosmetic_id,
        equipped: i.equipped,
        acquired_at: i.acquired_at,
        name: c?.name ?? i.cosmetic_id,
        type: c?.type ?? null,
        rarity: c?.rarity ?? null,
      };
    }),
    sparks: ledger ?? [],
  };
}

export type PlayerDetail = Awaited<ReturnType<typeof playerDetail>>;
