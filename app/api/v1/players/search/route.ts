import { ApiError, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { blockedIds } from "@/lib/social/server";
import { canRequestByUsername, isUnder16 } from "@/lib/social";
import { effectiveBand } from "@/lib/age";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  nickname: string;
  avatar_color: string | null;
  hat: string | null;
  level: number | null;
  title: string | null;
  age_band: string | null;
  birth_year: number | null;
  birth_month: number | null;
};

/**
 * GET /api/v1/players/search?q=ama: players to add as friends, as you type. Names starting with the text come
 * first, then names containing it; at most 10. Never lists you, anyone you blocked or who blocked you, banned or
 * test accounts, or under-16s (they add friends by invite link or QR only). Each row says where you stand.
 */
export const GET = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `player-search:${player.id}`, 90, 60);
  if (isUnder16(player.age_band)) throw new ApiError(403, "invite_only", "Under-16 players add friends by invite link or QR.");
  const q = (new URL(req.url).searchParams.get("q") ?? "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
  if (q.length < 2) return ok({ players: [] });
  const esc = q.replace(/[%_\\]/g, "\\$&");
  const cols = "id, nickname, avatar_color, hat:owned_hat, level, title, age_band, birth_year, birth_month";
  const base = () => admin.from("players").select(cols).is("banned_at", null).eq("is_test", false).neq("id", player.id);
  const [{ data: starts }, { data: contains }, blocked] = await Promise.all([
    base().ilike("nickname", `${esc}%`).order("nickname").limit(20),
    base().ilike("nickname", `%${esc}%`).order("nickname").limit(30),
    blockedIds(admin, player.id),
  ]);
  const seen = new Set<string>();
  const rows = [...((starts ?? []) as Row[]), ...((contains ?? []) as Row[])].filter((r) => {
    if (seen.has(r.id) || blocked.has(r.id)) return false;
    seen.add(r.id);
    return canRequestByUsername(player.age_band, effectiveBand(r));
  });
  const top = rows.slice(0, 10);
  const ids = top.map((r) => r.id);
  const { data: links } = ids.length
    ? await admin
        .from("friendships")
        .select("player_id, friend_id, status")
        .or(`and(player_id.eq.${player.id},friend_id.in.(${ids.join(",")})),and(friend_id.eq.${player.id},player_id.in.(${ids.join(",")}))`)
    : { data: [] };
  const statusOf = (id: string): "friends" | "requested" | "incoming" | "none" => {
    const l = (links ?? []).find((x) => x.player_id === id || x.friend_id === id);
    if (!l) return "none";
    if (l.status === "accepted") return "friends";
    return l.player_id === player.id ? "requested" : "incoming";
  };
  return ok({
    players: top.map((r) => ({
      id: r.id,
      nickname: r.nickname,
      color: r.avatar_color ?? "#B8F23A",
      hat: r.hat ?? null,
      level: r.level ?? 1,
      title: r.title,
      status: statusOf(r.id),
    })),
  });
});
