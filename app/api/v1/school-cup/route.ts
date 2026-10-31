import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer, todayGmt } from "@/lib/api/server";
import { GAME_BY_ID } from "@/lib/catalog";
import { MAX_CUP_GAMES, classroomAllowed, validRun } from "@/lib/meta";
import { makeCode, normaliseCode } from "@/lib/social";

export const dynamic = "force-dynamic";

type CupRow = {
  id: string;
  class_name: string;
  games: string[];
  week_start: string;
  ends_on: string | null;
  join_code: string;
  relaxed: boolean;
  schools: { name: string } | null;
};

const shape = (c: CupRow, teacher: boolean) => ({
  id: c.id,
  className: c.class_name,
  school: c.schools?.name ?? null,
  games: c.games,
  weekStart: c.week_start,
  endsOn: c.ends_on,
  relaxed: c.relaxed,
  code: teacher ? c.join_code : null,
});

/** GET /api/v1/school-cup: cups you teach and cups you've joined, and whether you can set one up. */
export const GET = handle(async () => {
  const { admin, player, user } = await requirePlayer();
  const cols = "id, class_name, games, week_start, ends_on, join_code, relaxed, schools(name)";
  const [{ data: teaching }, { data: joined }] = await Promise.all([
    admin.from("school_cups").select(cols).eq("teacher_id", player.id).order("week_start", { ascending: false }).limit(20),
    admin.from("school_cup_members").select(`school_cups(${cols})`).eq("player_id", player.id).limit(20),
  ]);
  return ok({
    canTeach: player.age_band === "18+" && !player.is_guest && !user.is_anonymous,
    teaching: ((teaching ?? []) as unknown as CupRow[]).map((c) => shape(c, true)),
    joined: (joined ?? []).map((j) => shape(j.school_cups as unknown as CupRow, false)),
  });
});

const Create = z.object({
  schoolCode: z.string().trim().min(4).max(16),
  className: z.string().trim().min(1).max(24),
  games: z.array(z.string()).min(1).max(MAX_CUP_GAMES),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  relaxed: z.boolean().default(false),
});

/**
 * POST /api/v1/school-cup: a teacher sets up a class challenge for a verified school.
 * Teachers are signed-in adults (not guests). Classroom mode hides Rage Ridge and photosensitive games.
 */
export const POST = handle(async (req: Request) => {
  const { admin, player, user } = await requirePlayer();
  await rateLimit(admin, `cup-create:${player.id}`, 10, 86400);
  if (player.age_band !== "18+" || player.is_guest || user.is_anonymous)
    throw new ApiError(403, "teacher_only", "Sign in with an adult account to run a School Cup.");
  const input = await body(req, Create);
  if (!/^[A-Za-z0-9 ]+$/.test(input.className)) throw new ApiError(422, "class_name", "Letters, numbers and spaces only.");
  const games = [...new Set(input.games)];
  if (games.some((g) => !GAME_BY_ID[g] || !classroomAllowed(GAME_BY_ID[g])))
    throw new ApiError(422, "games", "Pick games that are allowed in classroom mode.");
  const runProblem = validRun(input.weekStart, input.endsOn, todayGmt());
  if (runProblem) throw new ApiError(422, "run", runProblem);
  const { data: school } = await admin.from("schools").select("id, verified_by").eq("code", normaliseCode(input.schoolCode)).maybeSingle();
  if (!school?.verified_by) throw new ApiError(404, "school", "That school code isn't verified yet.");

  for (let i = 0; i < 5; i++) {
    const { data, error } = await admin
      .from("school_cups")
      .insert({
        school_id: school.id,
        teacher_id: player.id,
        class_name: input.className,
        games,
        week_start: input.weekStart,
        ends_on: input.endsOn,
        relaxed: input.relaxed,
        join_code: makeCode(6),
      })
      .select("id, join_code")
      .single();
    if (error?.code === "23505") continue;
    if (error) throw error;
    await admin.from("players").update({ school_id: school.id }).eq("id", player.id).is("school_id", null);
    return ok({ id: data.id, code: data.join_code });
  }
  throw new Error("cup code");
});
