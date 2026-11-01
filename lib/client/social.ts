"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api } from "./api";
import type { Reaction } from "@/lib/social";
import type { Scope } from "@/lib/meta";
import type { Zone } from "@/lib/leagues";

// ---------- types (mirror the route responses) ----------
/** /api/v1/me also returns these profile fields (see app/api/v1/me/route.ts). */
export type MeExtra = { hide_activity: boolean; country: string | null; city: string | null };

export interface CardDTO {
  id: string;
  nickname: string;
  color: string;
  skin: string | null;
  hat: string | null;
  title: string | null;
  level: number | null;
  minor: boolean;
}
export interface Presence {
  online: boolean;
  label: string;
}
export interface FriendsRes {
  friends: (CardDTO & { presence: Presence })[];
  incoming: (CardDTO & { mutual: number })[];
  outgoing: CardDTO[];
  online: number;
}
export interface FeedItem {
  id: number;
  kind: string;
  game: string | null;
  payload: Record<string, unknown>;
  at: string;
  player: { id: string; nickname: string; color: string; me: boolean };
  counts: Record<Reaction, number>;
  mine: Reaction | null;
}
export interface BoardRow {
  pos: number;
  id: string;
  nickname: string;
  color: string;
  skin: string | null;
  hat: string | null;
  sub: string | null;
  value: number;
  timeMs: number;
  hints: number;
  clears: number;
  me: boolean;
}
export interface BoardRes {
  game: string;
  date: string;
  scope: Scope;
  scoring?: "time" | "score" | "overall";
  needs: "crew" | "school" | "city" | "country" | null;
  context: string | null;
  rows: BoardRow[];
  me: (BoardRow & { top: number }) | null;
  total: number;
}
export interface LeagueMember {
  pos: number;
  id: string;
  nickname: string;
  color: string;
  points: number;
  zone: Zone;
  me: boolean;
}
export interface TierDTO {
  name: string;
  color: string;
  icon: string;
}
export interface LeagueRes {
  league: {
    id: string;
    tier: number;
    name: string;
    icon: string;
    color: string;
    next: string | null;
    prev: string | null;
    weekStart: string;
    endsInMs: number;
    members: LeagueMember[];
  } | null;
  ceremony: {
    leagueId: string;
    week: number;
    result: "promoted" | "stayed" | "demoted";
    rank: number;
    n: number;
    points: number;
    from: TierDTO;
    to: TierDTO;
    toTier: number;
    reward: number;
    around: LeagueMember[];
  } | null;
}
export interface QuestDTO {
  id: string;
  kind: "daily" | "weekly" | "event";
  step: number | null;
  title: string;
  icon: string;
  xp: number;
  sparks: number;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}
/** A seasonal event's bonus quest (features.seasonal). */
export interface EventQuestDTO extends QuestDTO {
  kind: "event";
  event: { id: string; name: string; endsAt: string; accent: string };
}
export interface QuestsRes {
  /** null when no event is live or seasonal events are off */
  event?: EventQuestDTO | null;
  daily: QuestDTO[];
  weekly: QuestDTO[];
  resetsInMs: number;
  weekResetsInMs: number;
}
export interface BadgeDTO {
  id: string;
  name: string;
  description: string;
  tier: "bronze" | "silver" | "gold" | "prism";
  icon: string;
  secret: boolean;
  earned: boolean;
  earnedAt: string | null;
  progress: { have: number; need: number } | null;
}
export interface BadgesRes {
  families: { family: string; label: string; badges: BadgeDTO[] }[];
  earned: number;
  total: number;
  secretsLeft: number;
}
export interface ShopItem {
  id: string;
  type: "skin" | "hat" | "board_theme" | "title" | "frame" | "freeze" | "hint_pack";
  name: string;
  price: number;
  rarity: string;
  payload: Record<string, string | number>;
  unlockLevel: number | null;
  owned: boolean;
  equipped: boolean;
  /** Starter item: listed first, priced by the shop.starterPrice game setting. */
  starter?: boolean;
}
export interface ShopRes {
  sparks: number;
  level: number;
  freezesHeld: number;
  practiceHints: number;
  wearing: { color: string; skin: string | null; hat: string | null; title: string | null };
  items: ShopItem[];
}
export interface GameStatDTO {
  game: string;
  clears: number;
  bestMs: number | null;
  avgMs: number | null;
  bestScore: number | null;
}
export interface ProfileRes {
  clears: number;
  duelRating: number | null;
  worlds: { world: string; rating: number | null; rank: { name: string; division: string; emblem: string } | null }[];
  place: { city: string | null; country: string | null; school: string | null };
  calendar: { month: string; days: { date: string; state: "full" | "played" | "frozen" | "missed" | "future" }[] };
  games: GameStatDTO[];
  badges: BadgesRes;
  pinned: BadgeDTO[];
}
export interface PublicProfile extends CardDTO {
  relation: "self" | "friend" | "requested" | "incoming" | "none";
  public: boolean;
  presence?: Presence | null;
  streak?: number;
  clears?: number;
  league?: string | null;
  versus?: { me: number; them: number; myBest: string | null; theirBest: string | null } | null;
}
export interface CrewPage {
  id: string;
  name: string;
  color: string;
  code: string | null;
  member: boolean;
  captain: boolean;
  size: number;
  max: number;
  city: string | null;
  clash: { week: number; endsInMs: number; us: number; them: number; opponent: string } | null;
  carry: { pos: number; id: string; nickname: string; color: string; xp: number; me: boolean }[];
}
export interface CupDTO {
  id: string;
  className: string;
  school: string | null;
  games: string[];
  weekStart: string;
  endsOn: string | null;
  relaxed: boolean;
  code: string | null;
}
export interface CupBoard extends CupDTO {
  teacher: string | null;
  endsInMs: number;
  startsInMs: number;
  isTeacher: boolean;
  rows: { pos: number; id: string; nickname: string; color: string; clears: number; timeMs: number; me: boolean }[];
}
export interface ArchiveRes {
  game: string;
  month: string;
  today: string;
  days: {
    date: string;
    access: "free" | "locked" | "today" | "future" | "before";
    state: "cleared" | "started" | "missed" | "future";
    timeMs: number | null;
    late: boolean;
    available: boolean;
  }[];
}

// ---------- queries ----------
function useGet<T>(key: QueryKey, path: string, opts: { enabled?: boolean; staleTime?: number; refetchInterval?: number } = {}) {
  return useQuery({ queryKey: key, queryFn: () => api<T>(path), ...opts });
}

export const useFriends = (enabled = true) => useGet<FriendsRes>(["friends"], "/api/v1/friends", { enabled, refetchInterval: 60_000 });
export const useInvite = () =>
  useGet<{ code: string; url: string; nickname: string }>(["invite"], "/api/v1/friends/invite", { staleTime: Infinity });
export const useFeed = () => useGet<{ items: FeedItem[]; next: number | null }>(["feed"], "/api/v1/feed");
export const useBlocks = () => useGet<{ blocked: { id: string; nickname: string; color: string }[] }>(["blocks"], "/api/v1/blocks");
export const useBoard = (game: string, scope: Scope, date: string) =>
  useGet<BoardRes>(["board", game, scope, date], `/api/v1/leaderboards/${game}?scope=${scope}&date=${date}`, { staleTime: 30_000 });
export const useLeague = () => useGet<LeagueRes>(["league"], "/api/v1/leagues/current");
export const useQuests = () => useGet<QuestsRes>(["quests"], "/api/v1/quests");
export const useBadges = () => useGet<BadgesRes>(["badges"], "/api/v1/badges");
export const useShop = () => useGet<ShopRes>(["shop"], "/api/v1/shop");
export const useProfile = (month: string) => useGet<ProfileRes>(["profile", month], `/api/v1/me/profile?month=${month}`);
export const usePlayer = (nickname: string) =>
  useGet<PublicProfile>(["player", nickname.toLowerCase()], `/api/v1/players/${encodeURIComponent(nickname)}`);
export const useMyCrew = () =>
  useGet<{ crew: { id: string; name: string; color: string; code: string; role: string } | null }>(["crew", "mine"], "/api/v1/crews");
export const useCrew = (id: string) => useGet<CrewPage>(["crew", id], `/api/v1/crews/${id}`);
export const useCups = () => useGet<{ canTeach: boolean; teaching: CupDTO[]; joined: CupDTO[] }>(["cups"], "/api/v1/school-cup");
export const useCup = (id: string, refetchInterval?: number) =>
  useGet<CupBoard>(["cup", id], `/api/v1/school-cup/${id}`, { refetchInterval });
export const useArchive = (game: string, month: string) =>
  useGet<ArchiveRes>(["archive", game, month], `/api/v1/archive?game=${game}&month=${month}`);

// ---------- mutations ----------
function useAct<I, O>(fn: (input: I) => Promise<O>, invalidate: QueryKey[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k }))),
  });
}

export const useAddFriend = () =>
  useAct((nickname: string) => api<{ status: "requested" | "friends" }>("/api/v1/friends", { json: { nickname } }), [["friends"]]);
export const useAccept = () => useAct((id: string) => api(`/api/v1/friends/${id}/accept`, { method: "POST" }), [["friends"], ["feed"]]);
export const useRemoveFriend = () =>
  useAct((id: string) => api(`/api/v1/friends/${id}`, { method: "DELETE" }), [["friends"], ["feed"], ["player"]]);
export const useAcceptInvite = () =>
  useAct((code: string) => api<{ ok: true; nickname: string | null }>("/api/v1/friends/invite/accept", { json: { code } }), [["friends"]]);
export const useBlock = () =>
  useAct((playerId: string) => api("/api/v1/blocks", { json: { playerId } }), [["friends"], ["feed"], ["blocks"], ["player"]]);
export const useUnblock = () => useAct((id: string) => api(`/api/v1/blocks/${id}`, { method: "DELETE" }), [["blocks"], ["player"]]);
export const useReport = () =>
  useAct(
    (input: { playerId: string; reason: string; block: boolean }) => api("/api/v1/reports", { json: input }),
    [["friends"], ["feed"], ["blocks"], ["player"]],
  );

/** Optimistic reaction toggle: tapping your current reaction clears it. */
export function useReact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reaction }: { id: number; reaction: Reaction | null }) => api(`/api/v1/feed/${id}/react`, { json: { reaction } }),
    onMutate: async ({ id, reaction }) => {
      await qc.cancelQueries({ queryKey: ["feed"] });
      const prev = qc.getQueryData<{ items: FeedItem[] }>(["feed"]);
      if (prev)
        qc.setQueryData(["feed"], {
          ...prev,
          items: prev.items.map((it) => {
            if (it.id !== id) return it;
            const counts = { ...it.counts };
            if (it.mine) counts[it.mine] = Math.max(0, counts[it.mine] - 1);
            if (reaction) counts[reaction] += 1;
            return { ...it, counts, mine: reaction };
          }),
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["feed"], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });
}

export const useClaimQuest = () =>
  useAct(
    (id: string) =>
      api<{ xp: number; sparks: number; already: boolean; balance: number }>(`/api/v1/quests/${id}/claim`, { method: "POST" }),
    [["quests"], ["me"]],
  );
export const useClaimLeague = () =>
  useAct(
    (leagueId: string) => api<{ sparks: number; balance: number }>("/api/v1/leagues/ceremony", { json: { leagueId } }),
    [["league"], ["me"]],
  );
export const useBuy = () =>
  useAct(
    (input: { itemId: string; requestId: string }) =>
      api<{ status: "bought" | "duplicate"; balance: number }>("/api/v1/shop/buy", { json: input }),
    [["shop"], ["me"]],
  );
export const useEquip = () =>
  useAct((input: { itemId: string; equip: boolean }) => api("/api/v1/shop/equip", { json: input }), [["shop"], ["me"], ["profile"]]);
export const useCreateCrew = () =>
  useAct((name: string) => api<{ id: string; code: string }>("/api/v1/crews", { json: { name } }), [["crew"]]);
export const useJoinCrew = () => useAct((code: string) => api<{ id: string }>("/api/v1/crews/join", { json: { code } }), [["crew"]]);
export const useLeaveCrew = () => useAct(() => api("/api/v1/crews/leave", { method: "POST" }), [["crew"]]);
export const useCreateCup = () =>
  useAct(
    (input: { schoolCode: string; className: string; games: string[]; weekStart: string; endsOn: string; relaxed: boolean }) =>
      api<{ id: string; code: string }>("/api/v1/school-cup", { json: input }),
    [["cups"]],
  );
export const useJoinCup = () => useAct((code: string) => api<{ id: string }>("/api/v1/school-cup/join", { json: { code } }), [["cups"]]);
export const usePatchProfile = () =>
  useAct(
    (input: { settings?: Record<string, unknown>; hideActivity?: boolean; country?: string | null; city?: string | null }) =>
      api("/api/v1/profile", { method: "PATCH", json: input }),
    [["me"]],
  );

/** Heartbeat for friends' "Online" and "Playing X" while the page is visible. */
export function usePresence(enabled: boolean, playing: string | null = null) {
  useEffect(() => {
    if (!enabled) return;
    const beat = () => {
      if (document.visibilityState === "visible") api("/api/v1/presence", { json: { playing } }).catch(() => {});
    };
    beat();
    const t = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [enabled, playing]);
}
