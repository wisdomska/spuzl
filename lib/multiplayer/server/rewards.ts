import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { update as glicko, DEFAULT_RATING, type Rating } from "@/lib/rating/glicko2";
import { DUEL } from "@/lib/rewards";
import { BADGES } from "@/lib/gamification/badges";
import { questsForDate, WEEKLY_CHAIN, type QuestDef } from "@/lib/gamification/quests";
import { weekStart } from "@/lib/gamification/progress";
import { getGameSettings } from "@/lib/game-settings/server";
import { ADULT_REWARD_SOURCE, adultRewardRef, adultRewards } from "@/lib/party-adult/rewards";
import { isAdultMode } from "@/lib/party-adult/modes";
import { TIMING } from "../constants";
import type { Loaded, MatchRow, RoundRow } from "./match";
import { GAME_BY_ID, isLiveWorld } from "@/lib/catalog";
import { updateRating } from "@/lib/game/service";
import type { Placed } from "../race";

/** The ledger source of Party Race XP; its daily cap counts this source only. */
export const PARTY_REWARD_SOURCE = "party";

/**
 * Party Race XP for one player at the end of a set (R4-25: admin settings, see DECISIONS for the defaults): the
 * winner `party.winXp`, everyone else still in the room `party.playXp`. The daily cap (`party.xpDailyCap`) is
 * applied by svc_grant_capped_reward on the server, against what the player already earned from Parties today.
 */
export function partyXp(won: boolean, s: { "party.winXp": number; "party.playXp": number }): number {
  return Math.max(0, won ? s["party.winXp"] : s["party.playXp"]);
}
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

/**
 * A badge earned in an 18+ party room (owner decision Q): awarded and paid like any other, but with no friends feed
 * event (svc_award_badge_quiet), since friends of any age read the feed.
 */
async function quietBadge(admin: SupabaseClient, player: string, id: string) {
  const b = BADGES.find((x) => x.id === id);
  if (!b) return;
  const { data: added, error } = await admin.rpc("svc_award_badge_quiet", { p_player: player, p_badge: id });
  if (error) console.error("[party] badge failed", player, id, error.message);
  else if (added) await grant(admin, player, "badge", id, 0, b.sparks);
}

/**
 * Owner decision Q: what an 18+ party room counts toward besides its XP and Sparks. The winners (first place, a tie
 * shares it) of a room that paid (enough players, lib/party-adult/rewards.ts) advance "Win 2 Duels or Races" and earn
 * the Party win badge, as a Party Race winner does. Never a feed event: no party_win line, and the badge goes in
 * quietly. The decision covers the 18+ rooms only: Family Draw (16+) rooms keep paying XP and Sparks alone.
 */
export const adultRoomCredit = (won: boolean, mode: unknown): { quests: string[]; badges: string[] } =>
  won && isAdultMode(mode) ? { quests: ["mp_wins"], badges: ["party-1"] } : { quests: [], badges: [] };

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
  await countRounds(admin, l);
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

/** How much a round against people moves a category rating, against a solo game's 1 (lib/game/service.ts). */
export const ROUND_RANK_WEIGHT = 0.5;

/**
 * Duels and Parties count towards the rank: every round each person played moves the rating of that round's game
 * category, like a solo result at half weight. Duels: the round's winner counts as a top result, the loser as a
 * bottom one, a tie as the middle. Parties: the place sets the result (first is the top; a skipped round is the
 * bottom). Never against the Practice bot. rank_contributions makes it count once per player and round.
 */
async function countRounds(admin: SupabaseClient, l: Loaded) {
  const { m } = l;
  if (m.is_bot) return;
  const humans = new Set(l.players.filter((p) => !p.spectator).map((p) => p.player_id));
  const byRound = new Map<number, RoundRow[]>();
  for (const r of l.rounds) if (humans.has(r.player_id)) byRound.set(r.round, [...(byRound.get(r.round) ?? []), r]);
  for (const [round, rows] of byRound) {
    if (rows.length < 2) continue;
    const world = GAME_BY_ID[rows[0].game_id ?? ""]?.world;
    if (!isLiveWorld(world)) continue;
    const anyWon = rows.some((r) => r.won);
    for (const r of rows) {
      const pct =
        m.kind === "duel"
          ? anyWon
            ? r.won
              ? 100
              : 0
            : 50
          : r.place
            ? Math.round((100 * (rows.length - r.place)) / (rows.length - 1))
            : 0;
      const { error } = await admin.from("rank_contributions").insert({ player_id: r.player_id, ref: `${m.id}:${m.set_no}:${round}` });
      if (error) continue; // already counted (or the table is missing): never twice
      const ref = `${m.id}:${m.set_no}:${round}`;
      try {
        const d = await updateRating(admin, r.player_id, world!, pct, 0, r.mistakes, ROUND_RANK_WEIGHT);
        // kept so the end screen can say "Logic +6"
        await admin
          .from("rank_contributions")
          .update({ track: world, delta: (d.after - d.before).toFixed(2) })
          .eq("player_id", r.player_id)
          .eq("ref", ref);
      } catch (e) {
        console.error("[rank] round not counted", m.id, round, e);
      }
    }
  }
}

/**
 * After the last game of a Party set: XP (capped per GMT day, R4-25), feed, badges and quests for everyone who
 * played. The capped grant pays each player once per set, so running this twice changes nothing.
 */
export async function finalizeRace(admin: SupabaseClient, l: Loaded, lastGame: Placed[]) {
  const { m } = l;
  await countRounds(admin, l);
  const ref = `${m.id}:${m.set_no}`;
  const s = await getGameSettings();
  for (const p of l.players.filter((x) => !x.spectator && !x.left_at)) {
    const won = m.winner_id === p.player_id;
    const { error } = await admin.rpc("svc_grant_capped_reward", {
      p_player: p.player_id,
      p_source: PARTY_REWARD_SOURCE,
      p_ref: ref,
      p_xp: partyXp(won, s),
      p_sparks: 0,
      p_cap: s["party.xpDailyCap"],
    });
    if (error) console.error("[party] reward failed", m.id, p.player_id, error.message);
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

/**
 * After the last round of an 18+ party room (Draw It, Two Truths): XP and Sparks per round played and a bonus
 * for first place (rules in lib/party-adult/rewards.ts). Only players still in the room at the end count, and
 * a room where fewer than three did pays nothing. svc_grant_capped_reward applies the daily cap and pays each
 * player once per room set. Owner decision Q: the room's winners also advance quests and earn badges
 * (`adultRoomCredit`, once per set: this runs only when the final commit applies), but nothing ever goes to the
 * friends feed, which friends of any age read.
 */
export async function finalizeAdult(admin: SupabaseClient, l: Loaded) {
  const { m, now } = l;
  if (m.status !== "finished" || !m.party_mode || m.party_mode === "race") return;
  const finishers = l.players.filter(
    (p) =>
      !p.spectator &&
      !p.left_at &&
      !p.kicked_at &&
      m.party_leads.includes(p.player_id) &&
      now - Date.parse(p.last_seen_at) <= TIMING.reconnectMs,
  );
  const { data: rounds, error } = await admin.from("party_rounds").select("played").eq("match_id", m.id).eq("set_no", m.set_no);
  if (error) {
    // Before the 20261120000001 migration there is no `played`: pay nothing rather than guess.
    console.error("[party] rewards skipped", m.id, error.message);
    return;
  }
  const played = new Map<string, number>();
  for (const r of rounds ?? []) for (const id of (r.played as string[] | null) ?? []) played.set(id, (played.get(id) ?? 0) + 1);
  const s = await getGameSettings();
  const owed = adultRewards(
    finishers.map((p) => ({ id: p.player_id, rounds: played.get(p.player_id) ?? 0, place: p.place })),
    {
      xpPerRound: s["adultParty.xpPerRound"],
      sparksPerRound: s["adultParty.sparksPerRound"],
      winXp: s["adultParty.winXp"],
      winSparks: s["adultParty.winSparks"],
      xpDailyCap: s["adultParty.xpDailyCap"],
    },
  );
  const ref = adultRewardRef(m.id, m.set_no);
  for (const o of owed) {
    const { error: e } = await admin.rpc("svc_grant_capped_reward", {
      p_player: o.id,
      p_source: ADULT_REWARD_SOURCE,
      p_ref: ref,
      p_xp: o.xp,
      p_sparks: o.sparks,
      p_cap: s["adultParty.xpDailyCap"],
    });
    if (e) console.error("[party] reward failed", m.id, o.id, e.message);
    const credit = adultRoomCredit(o.won, m.party_mode);
    if (credit.quests.length) await bumpQuests(admin, o.id, credit.quests);
    for (const b of credit.badges) await quietBadge(admin, o.id, b);
  }
}

/** What this player was paid for a finished 18+ party room, from the ledgers (null when nothing was paid). */
export async function adultRewardFor(
  admin: SupabaseClient,
  m: Pick<MatchRow, "id" | "set_no">,
  me: string,
): Promise<{ xp: number; sparks: number } | null> {
  const ref = adultRewardRef(m.id, m.set_no);
  const read = (table: "xp_ledger" | "sparks_ledger") =>
    admin.from(table).select("amount").eq("player_id", me).eq("source", ADULT_REWARD_SOURCE).eq("ref_id", ref).maybeSingle();
  const [{ data: x }, { data: sp }] = await Promise.all([read("xp_ledger"), read("sparks_ledger")]);
  if (!x && !sp) return null;
  return { xp: Number(x?.amount ?? 0), sparks: Number(sp?.amount ?? 0) };
}
