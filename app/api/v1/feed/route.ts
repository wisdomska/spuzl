import { handle, ok, requirePlayer } from "@/lib/api/server";
import { blockedIds, cards, friendIds } from "@/lib/social/server";
import { REACTIONS, type Reaction } from "@/lib/social";

export const dynamic = "force-dynamic";

/** GET /api/v1/feed: your and your friends' recent activity with preset reaction counts. */
export const GET = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  const before = new URL(req.url).searchParams.get("before");
  const [friends, blocked] = await Promise.all([friendIds(admin, player.id), blockedIds(admin, player.id)]);
  const people = await cards(admin, [player.id, ...friends]);
  // Friends who hide activity, and anyone in a block, never appear.
  const visible = [...people.values()].filter((c) => c.id === player.id || (!c.raw.hide_activity && !blocked.has(c.id))).map((c) => c.id);
  let q = admin
    .from("feed_events")
    .select("id, player_id, kind, game_id, payload, created_at")
    .in("player_id", visible)
    .order("created_at", { ascending: false })
    .limit(30);
  if (before && /^\d+$/.test(before)) q = q.lt("id", Number(before));
  const { data: events, error } = await q;
  if (error) throw error;
  const ids = (events ?? []).map((e) => e.id);
  const { data: rx } = ids.length
    ? await admin.from("reactions").select("event_id, player_id, reaction").in("event_id", ids)
    : { data: [] as { event_id: number; player_id: string; reaction: Reaction }[] };
  const items = (events ?? []).map((e) => {
    const mine = (rx ?? []).filter((r) => r.event_id === e.id);
    const counts = Object.fromEntries(REACTIONS.map((k) => [k, mine.filter((r) => r.reaction === k).length])) as Record<Reaction, number>;
    const c = people.get(e.player_id)!;
    return {
      id: e.id,
      kind: e.kind,
      game: e.game_id,
      payload: e.payload ?? {},
      at: e.created_at,
      player: { id: c.id, nickname: c.nickname, color: c.color, me: c.id === player.id },
      counts,
      mine: (mine.find((r) => r.player_id === player.id)?.reaction as Reaction | undefined) ?? null,
    };
  });
  return ok({ items, next: items.length === 30 ? items[items.length - 1].id : null });
});
