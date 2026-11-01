import { z } from "zod";
import { getGameSettings } from "@/lib/game-settings/server";
import { ApiError, handle, ok, requirePlayer, todayGmt } from "@/lib/api/server";
import { GAME_BY_ID } from "@/lib/catalog";
import { LAUNCH_DATE } from "@/lib/format";
import { SCOPES, topPercent } from "@/lib/meta";
import { isUnder16 } from "@/lib/social";

export const dynamic = "force-dynamic";

const Query = z.object({
  scope: z.enum(SCOPES).default("friends"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

interface Row {
  pos: number;
  player_id: string;
  nickname: string;
  avatar_color: string;
  skin: string | null;
  hat: string | null;
  title: string | null;
  level: number;
  age_band: string;
  value: number;
  time_ms: number;
  hints: number;
  clears: number;
  total: number;
  is_me: boolean;
}

/**
 * GET /api/v1/leaderboards/:game?scope=&date= (game = a game id or "overall").
 * Scopes: friends, crew, school, city, country, global. Verified Daily results only; flagged results,
 * banned players and test accounts never show. "You" is always returned for pinning.
 */
export const GET = handle(async (req: Request, ctx: RouteContext<"/api/v1/leaderboards/[game]">) => {
  if (!(await getGameSettings())["features.dailies"]) throw new ApiError(404, "dailies_off");
  const { game } = await ctx.params;
  const overall = game === "overall";
  if (!overall && !GAME_BY_ID[game]) throw new ApiError(404, "unknown_game");
  const sp = new URL(req.url).searchParams;
  const q = Query.parse({ scope: sp.get("scope") ?? undefined, date: sp.get("date") ?? undefined });
  const today = todayGmt();
  const date = q.date ?? today;
  if (date > today || date < LAUNCH_DATE) throw new ApiError(400, "invalid_date");
  const { admin, player } = await requirePlayer();

  // Scopes that need something about you first: say what, so the screen can show the right empty state.
  const { data: me } = await admin.from("players").select("school_id, city, country").eq("id", player.id).single();
  let context: string | null = null;
  let needs: "crew" | "school" | "city" | "country" | null = null;
  if (q.scope === "crew") {
    const { data: cm } = await admin.from("crew_members").select("crews(name)").eq("player_id", player.id).maybeSingle();
    const crew = (cm?.crews as unknown as { name: string } | null)?.name;
    if (!crew) needs = "crew";
    else context = crew;
  } else if (q.scope === "school") {
    const { data: s } = me?.school_id
      ? await admin.from("schools").select("name, verified_by").eq("id", me.school_id).maybeSingle()
      : { data: null };
    if (!s?.verified_by) needs = "school";
    else context = s.name;
  } else if (q.scope === "city") {
    if (!me?.city) needs = "city";
    else context = me.city;
  } else if (q.scope === "country") {
    if (!me?.country) needs = "country";
    else context = me.country;
  }
  if (needs) return ok({ game, date, scope: q.scope, needs, context, rows: [], me: null, total: 0 });

  const { data, error } = await admin.rpc("svc_leaderboard", {
    p_viewer: player.id,
    p_game: overall ? null : game,
    p_date: date,
    p_scope: q.scope,
    p_limit: 50,
  });
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const scoring = overall ? "overall" : GAME_BY_ID[game].scoring === "score" ? "score" : "time";
  const shape = (r: Row) => {
    const minor = isUnder16(r.age_band);
    return {
      pos: r.pos,
      id: r.player_id,
      nickname: r.nickname,
      color: r.avatar_color,
      skin: r.skin,
      hat: r.hat,
      sub: minor ? null : (r.title ?? `Level ${r.level}`),
      value: r.value,
      timeMs: r.time_ms,
      hints: r.hints,
      clears: r.clears,
      me: r.is_me,
    };
  };
  const mine = rows.find((r) => r.is_me);
  const total = rows[0]?.total ?? 0;
  return ok({
    game,
    date,
    scope: q.scope,
    scoring,
    needs: null,
    context,
    rows: rows.filter((r) => r.pos <= 50).map(shape),
    me: mine ? { ...shape(mine), top: topPercent(mine.pos, total) } : null,
    total,
  });
});
