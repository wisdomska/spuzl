import { z } from "zod";
import { ApiError, handle, ok, requirePlayer } from "@/lib/api/server";

export const dynamic = "force-dynamic";

/** GET /api/v1/school-cup/:id: the class board (teacher and class members only). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/school-cup/[id]">) => {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "not_found");
  const { admin, player } = await requirePlayer();
  const { data: cup } = await admin
    .from("school_cups")
    .select("id, teacher_id, class_name, games, week_start, ends_on, join_code, relaxed, schools(name), players!school_cups_teacher_id_fkey(nickname)")
    .eq("id", id)
    .maybeSingle();
  if (!cup) throw new ApiError(404, "not_found");
  const teacher = cup.teacher_id === player.id;
  if (!teacher) {
    const { data: m } = await admin.from("school_cup_members").select("player_id").eq("cup_id", id).eq("player_id", player.id).maybeSingle();
    if (!m) throw new ApiError(404, "not_found");
  }
  const { data: rows, error } = await admin.rpc("svc_school_cup_board", { p_cup: id });
  if (error) throw error;
  const ends = cup.ends_on ?? cup.week_start;
  const endsAt = Date.parse(ends + "T00:00:00Z") + 86_400_000;
  return ok({
    id: cup.id,
    className: cup.class_name,
    school: (cup.schools as unknown as { name: string } | null)?.name ?? null,
    teacher: (cup.players as unknown as { nickname: string } | null)?.nickname ?? null,
    games: cup.games,
    weekStart: cup.week_start,
    endsOn: ends,
    endsInMs: Math.max(0, endsAt - Date.now()),
    startsInMs: Math.max(0, Date.parse(cup.week_start + "T00:00:00Z") - Date.now()),
    relaxed: cup.relaxed,
    code: teacher ? cup.join_code : null,
    isTeacher: teacher,
    rows: ((rows ?? []) as { pos: number; player_id: string; nickname: string; avatar_color: string; clears: number; time_ms: number }[]).map(
      (r) => ({ pos: r.pos, id: r.player_id, nickname: r.nickname, color: r.avatar_color, clears: r.clears, timeMs: r.time_ms, me: r.player_id === player.id }),
    ),
  });
});
