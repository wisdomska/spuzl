import { z } from "zod";
import { ApiError, handle, ok, requirePlayer } from "@/lib/api/server";

export const dynamic = "force-dynamic";

const Q = z.object({ match: z.string().uuid(), set: z.coerce.number().int().min(0).max(10_000) });

/**
 * GET /api/v1/me/rank-changes?match=<id>&set=<n>: how that Duel or Party set moved my category ranks, summed per
 * category, e.g. [{ track: "logic", delta: 6.2, rounds: 2 }]. Empty for games against the bot or not counted yet.
 */
export const GET = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  const u = new URL(req.url).searchParams;
  const q = Q.safeParse({ match: u.get("match"), set: u.get("set") });
  if (!q.success) throw new ApiError(400, "bad_request");
  const { data } = await admin
    .from("rank_contributions")
    .select("track, delta")
    .eq("player_id", player.id)
    .like("ref", `${q.data.match}:${q.data.set}:%`)
    .not("track", "is", null);
  const by = new Map<string, { track: string; delta: number; rounds: number }>();
  for (const r of data ?? []) {
    const t = r.track as string;
    const cur = by.get(t) ?? { track: t, delta: 0, rounds: 0 };
    cur.delta += Number(r.delta ?? 0);
    cur.rounds++;
    by.set(t, cur);
  }
  return ok({ changes: [...by.values()] });
});
