import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { drawStrokes, guess, isAdultRoom, reportContent, requireAdult, vote, writeStatements } from "@/lib/multiplayer/server/adult";
import { roomMatch } from "@/lib/multiplayer/server/lobby";
import { codeParam } from "@/lib/multiplayer/server/params";
import { StrokeBatch } from "@/lib/party-adult/strokes";

const round = z.number().int().min(1).max(8);
// The party text filter checks lengths again with a friendly message; these caps only stop huge bodies.
const Draw = z.object({ round, op: z.enum(["add", "undo", "clear"]), strokes: StrokeBatch.optional() });
const Guess = z.object({ round, text: z.string().max(200) });
const Statements = z.object({ round, statements: z.array(z.string().max(400)).length(3), lie: z.number().int().min(0).max(2) });
const Vote = z.object({ round, pick: z.number().int().min(0).max(2) });
const Report = z.object({
  round,
  kind: z.enum(["drawing", "statements", "guess"]),
  guessId: z.number().int().positive().optional(),
  reason: z.enum(["harassment", "spam", "other"]),
});

/** Requests allowed per window (seconds), per player and action. */
const LIMITS: Record<string, [number, number]> = {
  draw: [240, 60],
  guess: [40, 60],
  statements: [10, 60],
  vote: [20, 60],
  report: [20, 3600],
};

/**
 * POST /api/v1/rooms/:code/party/:action: Draw It and Two Truths (18+ rooms only). Every action runs the age
 * gate first.
 *   draw        the drawer adds strokes, undoes or clears (vector strokes only, capped)
 *   guess       a guess (30 characters, filtered)
 *   statements  the writer's three statements (80 characters each, filtered) and which one is the lie
 *   vote        pick the lie
 *   report      report a drawing, statements or a guess; the server snapshots it for moderators
 */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/party/[action]">) => {
  const { code: raw, action } = await ctx.params;
  const code = codeParam(raw);
  const limit = LIMITS[action];
  if (!limit) throw new ApiError(404, "not_found");
  const { admin, user, player } = await requirePlayer();
  await requireAdult(admin, user, player);
  await rateLimit(admin, `party-${action}:${player.id}`, limit[0], limit[1]);
  const m = await roomMatch(admin, code);
  if (!isAdultRoom(m)) throw new ApiError(409, "not_adult_room");
  switch (action) {
    case "draw":
      return ok(await drawStrokes(admin, m.id, player.id, await body(req, Draw)));
    case "guess":
      return ok(await guess(admin, m.id, player.id, await body(req, Guess)));
    case "statements":
      return ok(await writeStatements(admin, m.id, player.id, await body(req, Statements)));
    case "vote":
      return ok(await vote(admin, m.id, player.id, await body(req, Vote)));
    default:
      return ok(await reportContent(admin, m.id, player.id, await body(req, Report)));
  }
});
