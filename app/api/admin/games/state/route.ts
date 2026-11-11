import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { GAME_STATES, gameState } from "@/lib/catalog";
import { STATUS_OF, closedNow, stateChangeProblem } from "@/lib/game-state";
import { hasLogic } from "@/games/logic-ids";
import { isVersusEligible } from "@/lib/multiplayer/games";
import { getGameSettings, invalidateGameSettings } from "@/lib/game-settings/server";
import { invalidateGamesMeta } from "@/lib/games-meta/server";
import { revalidatePublicCopy } from "@/lib/seo/revalidate";
import { repickClosedGames } from "@/lib/daily-five/server";

const Patch = z
  .object({
    id: z.string().min(2).max(24),
    /** On, In testing or Off (stored in games.status as 'live', 'testing', 'off') */
    state: z.enum(GAME_STATES as [string, ...string[]]).optional(),
    /** "Can be played in Duels and Parties" (games.versus); only for games that can be raced */
    versus: z.boolean().optional(),
    /** the game's practice round on (true) or skipped (false); stored in the setting "practice.disabled" */
    practice: z.boolean().optional(),
  })
  .refine((p) => p.state !== undefined || p.versus !== undefined || p.practice !== undefined, { message: "nothing_to_change" });

/**
 * PATCH /api/admin/games/state: one game's switches on the Games page. Owner only (the same permission as the game
 * settings these replace: the old Lab games and practice round switches).
 * - `state`: On, In testing (only signed-in admins can open it) or Off (nobody). Switching a game to In testing or
 *   Off re-picks today's and upcoming unlocked Daily Five days that hold it at once (R4-06 re-pick, audited), and the
 *   public pages that list games are rebuilt on their next visit.
 * - `versus`: whether players may pick it in Duels and Parties (time and score races only).
 * - `practice`: whether it keeps its practice round (the setting "practice.disabled" stays the storage).
 * Every change is audited ("game_state.update") with the before and after.
 */
export const PATCH = handle(async (req: Request) => {
  const ctx = await requireAdmin("settings.write");
  const p = await body(req, Patch);
  const problem = stateChangeProblem(p.id, p.state ?? "on");
  if (problem === "unknown_game") throw new ApiError(404, "unknown_game", p.id);
  if (problem === "game_retired") throw new ApiError(409, "game_retired", p.id);
  if (problem) throw new ApiError(422, problem);
  if (p.versus !== undefined && !isVersusEligible(p.id)) throw new ApiError(422, "not_versus_game", `${p.id} can't be raced.`);
  if (p.practice !== undefined && !hasLogic(p.id)) throw new ApiError(422, "no_practice_round", `${p.id} has no practice round.`);

  // Fresh, not this instance's cached copy: the change and its Daily Five re-pick compare against what is stored.
  invalidateGameSettings();
  const before = await getGameSettings();
  const detail: Record<string, unknown> = {};

  if (p.state !== undefined || p.versus !== undefined) {
    const patch: Record<string, unknown> = {};
    if (p.state !== undefined) patch.status = STATUS_OF[p.state as keyof typeof STATUS_OF];
    if (p.versus !== undefined) patch.versus = p.versus;
    const { data, error } = await ctx.db.from("games").update(patch).eq("id", p.id).select("id");
    if (error) throw error;
    if (!data?.length) throw new ApiError(404, "unknown_game", p.id);
    if (p.state !== undefined) detail.state = { before: gameState(p.id, before) ?? "on", after: p.state };
    if (p.versus !== undefined) detail.versus = { before: !before["games.noVersus"].includes(p.id), after: p.versus };
  }

  if (p.practice !== undefined) {
    const { data: row } = await ctx.db.from("game_settings").select("value").eq("key", "practice.disabled").maybeSingle();
    const was = Array.isArray(row?.value) ? (row.value as string[]) : [...before["practice.disabled"]];
    const next = p.practice ? was.filter((g) => g !== p.id) : [...new Set([...was, p.id])];
    const { error } = await ctx.db
      .from("game_settings")
      .upsert(
        { key: "practice.disabled", value: next, updated_by: ctx.user.id, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw error;
    detail.practice = { before: !was.includes(p.id), after: p.practice };
  }

  invalidateGameSettings();
  invalidateGamesMeta();
  const after = await getGameSettings();
  // Lists of games on the public pages (game pages, games index, How to play, llms.txt, sitemap) follow at once.
  if (p.state !== undefined || p.versus !== undefined) revalidatePublicCopy();

  // R4-06: a game players lose leaves today's and upcoming unlocked Daily Five days at once (locked days keep it).
  let dailyFive: Awaited<ReturnType<typeof repickClosedGames>> | undefined;
  const closed = closedNow(before, after);
  if (closed.length) {
    dailyFive = await repickClosedGames(ctx.db, after, ctx.user.id);
    if (dailyFive.days.length || dailyFive.kept.length) await audit(ctx, "daily_five.lab_repick", null, { off: closed, ...dailyFive });
  }
  await audit(ctx, "game_state.update", `game:${p.id}`, detail);
  return ok({
    id: p.id,
    state: gameState(p.id, after) ?? "on",
    versus: !after["games.noVersus"].includes(p.id),
    practiceOff: after["practice.disabled"].includes(p.id),
    ...(dailyFive ? { dailyFive } : {}),
  });
});
