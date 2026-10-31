import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { update as glicko, DEFAULT_RATING, type Rating } from "@/lib/rating/glicko2";
import { DUEL } from "@/lib/rewards";
import { BADGES } from "@/lib/gamification/badges";
import { questsForDate, WEEKLY_CHAIN, type QuestDef } from "@/lib/gamification/quests";
import { weekStart } from "@/lib/gamification/progress";
import type { Loaded } from "./match";
import type { Placed } from "../race";

/** Party Race XP: the winner 30, everyone who finished the set 10 (SRS lists no Party XP; see DECISIONS). */
export const PARTY = { winXp: 30, playXp: 10 };
/** Practice bot: nothing on the line, a small practice XP either way. */
export const PRACTICE_XP = 10;

export async function readRating(admin: SupabaseClient, player: string, track: string): Promise<Rating & { games: number }> {
  const { data } = await admin.from("ratings").select("rating, rd, vol, games").eq("player_id", player).eq("track", track).maybeSingle();
  return data
    ? { rating: Number(data.rating), rd: Number(data.rd), vol: Number(data.vol), games: data.games }
    : { ...DEFAULT_RATING, games: 0 };
}

/** Glicko-2 update for a two-player result. score: 1 = a won, 0 = b won, 0.5 = draw. */
export async function rateTwo(admin: SupabaseClient, a: string, b: string, scoreA: number, track: string) {
  const [ra, rb] = await Promise.all([readRating(admin, a, track), readRating(admin, b, track)]);
  const na = glicko(ra, [{ opponent: rb, score: scoreA }]);
  const nb = glicko(rb, [{ opponent: ra, score: 1 - scoreA }]);
  const now = new Date().toISOString();
  await admin.from("ratings").upsert([
    {
      player_id: a,
      track,
      rating: na.rating.toFixed(2),
      rd: na.rd.toFixed(2),
      vol: na.vol.toFixed(6),
      games: ra.games + 1,
      updated_at: now,
    },
    {
      player_id: b,
      track,
      rating: nb.rating.toFixed(2),
      rd: nb.rd.toFixed(2),
      vol: nb.vol.toFixed(6),
      games: rb.games + 1,
      updated_at: now,
    },
  ]);
  return { a: { before: ra.rating, after: na.rating }, b: { before: rb.rating, after: nb.rating } };
}

async function grant(admin: SupabaseClient, player: string, source: string, ref: string, xp: number, sparks = 0) {
  await admin.rpc("svc_grant_reward", { p_player: player, p_source: source, p_ref: ref, p_xp: xp, p_sparks: sparks });
}

async function badge(admin: SupabaseClient, player: string, id: string) {
  const b = BADGES.find((x) => x.id === id);
  if (!b) return;
  const { error } = await admin.from("player_badges").insert({ player_id: player, badge_id: id });
  if (!error) await grant(admin, player, "badge", id, 0, b.sparks);
}

/** Advances "Play a Duel" and "Win 2 Duels or Races" style quests (evaluated where those events happen). */
export async function bumpQuests(admin: SupabaseClient, player: string, kinds: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const week = weekStart();
  const list: [QuestDef, string][] = [
    ...questsForDate(today).map((q) => [q, today] as [QuestDef, string]),
    ...WEEKLY_CHAIN.map((q) => [q, week] as [QuestDef, string]),
  ];
  for (const [q, period] of list) {
    if (!kinds.includes(q.goal.kind)) continue;
    if (q.kind === "weekly" && q.step && q.step > 1) {
      const prev = WEEKLY_CHAIN[q.step - 2];
      const { data: p } = await admin
        .from("player_quests")
        .select("completed_at")
        .eq("player_id", player)
        .eq("quest_id", prev.id)
        .eq("period", period)
        .maybeSingle();
      if (!p?.completed_at) continue;
    }
    const { data: row } = await admin
      .from("player_quests")
      .select("progress, completed_at")
      .eq("player_id", player)
      .eq("quest_id", q.id)
      .eq("period", period)
      .maybeSingle();
    if (row?.completed_at) continue;
    const progress = Math.min(q.goal.n, (row?.progress ?? 0) + 1);
    await admin.from("player_quests").upsert({
      player_id: player,
      quest_id: q.id,
      period,
      progress,
      target: q.goal.n,
      completed_at: progress >= q.goal.n ? new Date().toISOString() : null,
    });
  }
}

/** After a Duel ends: ratings (ranked only), XP, feed, badges and quests. Idempotent by match id. */
export async function finalizeDuel(admin: SupabaseClient, l: Loaded) {
  const { m } = l;
  if (m.status !== "finished") return;
  const humans = l.players.filter((p) => !p.spectator);
  const winner = m.winner_id;
  // Ledger refs make XP idempotent; ratings are guarded by rating_after being unset.
  if (m.rated && humans.length === 2 && humans.every((p) => p.rating_after === null)) {
    const [a, b] = humans;
    const scoreA = winner === a.player_id ? 1 : winner === b.player_id ? 0 : 0.5;
    const r = await rateTwo(admin, a.player_id, b.player_id, scoreA, "duel");
    await admin
      .from("match_players")
      .update({ rating_before: r.a.before.toFixed(2), rating_after: r.a.after.toFixed(2) })
      .eq("match_id", m.id)
      .eq("player_id", a.player_id);
    await admin
      .from("match_players")
      .update({ rating_before: r.b.before.toFixed(2), rating_after: r.b.after.toFixed(2) })
      .eq("match_id", m.id)
      .eq("player_id", b.player_id);
  }
  for (const p of humans) {
    const won = winner === p.player_id;
    const xp = m.is_bot ? PRACTICE_XP : won ? DUEL.winXp : DUEL.lossXp;
    await grant(admin, p.player_id, "duel", m.id, xp);
    await bumpQuests(admin, p.player_id, won && !m.is_bot ? ["duels", "mp_wins"] : ["duels"]);
    if (!won || m.is_bot) continue;
    await admin
      .from("feed_events")
      .insert({ player_id: p.player_id, kind: "duel_win", game_id: m.games[0] ?? null, payload: { matchId: m.id } });
    const { count } = await admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("kind", "duel")
      .eq("winner_id", p.player_id)
      .eq("is_bot", false);
    if ((count ?? 0) >= 10) await badge(admin, p.player_id, "duel-10");
    const r1 = l.rounds.find((r) => r.round === 1 && r.player_id === p.player_id);
    if (r1 && !r1.won && l.rounds.some((r) => r.round === 1 && r.won)) await badge(admin, p.player_id, "secret-comeback");
  }
}

/** After the last game of a Party set: XP, feed, badges and quests for everyone who played. */
export async function finalizeRace(admin: SupabaseClient, l: Loaded, lastGame: Placed[]) {
  const { m } = l;
  const ref = `${m.id}:${m.set_no}`;
  for (const p of l.players.filter((x) => !x.spectator && !x.left_at)) {
    const won = m.winner_id === p.player_id;
    await grant(admin, p.player_id, "party", ref, won ? PARTY.winXp : PARTY.playXp);
    if (!won) continue;
    await bumpQuests(admin, p.player_id, ["mp_wins"]);
    await admin
      .from("feed_events")
      .insert({ player_id: p.player_id, kind: "party_win", game_id: m.games[0] ?? null, payload: { matchId: m.id } });
    await badge(admin, p.player_id, "party-1");
  }
  // Photo finish: won a Party game by under a second.
  const [a, b] = lastGame;
  if (a?.timeMs != null && b?.timeMs != null && b.timeMs - a.timeMs < 1000) await badge(admin, a.id, "secret-photo");
}
