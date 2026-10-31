import { z } from "zod";
import { ApiError, handle, ok, requirePlayer } from "@/lib/api/server";
import { cards } from "@/lib/social/server";
import { CREW_MAX, memberWeekXp } from "@/lib/social/crews";
import { isoWeek, msToLeagueReset, weekStartOf } from "@/lib/leagues";

export const dynamic = "force-dynamic";

/** GET /api/v1/crews/:id: crew page, this week's crew clash and the members' carry (week XP). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/crews/[id]">) => {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) throw new ApiError(404, "not_found");
  const { admin, player } = await requirePlayer();
  const { data: crew } = await admin.from("crews").select("id, name, color, join_code, owner_id").eq("id", id).maybeSingle();
  if (!crew) throw new ApiError(404, "not_found", "That crew is gone.");
  const { data: members } = await admin.from("crew_members").select("player_id, role").eq("crew_id", id);
  const ids = (members ?? []).map((m) => m.player_id);
  const member = ids.includes(player.id);
  const week = weekStartOf();
  const [people, xp, { data: owner }] = await Promise.all([
    cards(admin, ids),
    memberWeekXp(admin, ids, week),
    admin.from("players").select("city, age_band").eq("id", crew.owner_id).maybeSingle(),
  ]);

  let clash = null;
  const { data: clashId } = await admin.rpc("svc_ensure_crew_clash", { p_crew: id, p_week: week });
  if (clashId) {
    const { data: k } = await admin.from("crew_clashes").select("crew_a, crew_b").eq("id", clashId).single();
    const otherId = k!.crew_a === id ? k!.crew_b : k!.crew_a;
    const [{ data: other }, { data: us }, { data: them }] = await Promise.all([
      admin.from("crews").select("name, color").eq("id", otherId).single(),
      admin.rpc("svc_crew_week_xp", { p_crew: id, p_week: week }),
      admin.rpc("svc_crew_week_xp", { p_crew: otherId, p_week: week }),
    ]);
    clash = { week: isoWeek(week), endsInMs: msToLeagueReset(), us: Number(us ?? 0), them: Number(them ?? 0), opponent: other?.name ?? "Another crew" };
  }
  const carry = [...people.values()]
    .map((c) => ({ id: c.id, nickname: c.nickname, color: c.color, xp: xp.get(c.id) ?? 0, me: c.id === player.id }))
    .sort((a, b) => b.xp - a.xp || a.nickname.localeCompare(b.nickname))
    .map((r, i) => ({ ...r, pos: i + 1 }));

  return ok({
    id: crew.id,
    name: crew.name,
    color: crew.color,
    code: member ? crew.join_code : null,
    member,
    captain: (members ?? []).find((m) => m.player_id === player.id)?.role === "captain",
    size: ids.length,
    max: CREW_MAX,
    // the owner's city, unless they're under 16
    city: owner && owner.age_band !== "13-15" ? owner.city : null,
    clash,
    carry,
  });
});
