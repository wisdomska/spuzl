"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hasSupabase } from "@/lib/supabase/env";
import type { Hint } from "@/games/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** Fetch wrapper for /api/v1. Cookies carry the Supabase session. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    credentials: "same-origin",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new HttpError(res.status, data?.error ?? "error", data?.message);
  return data as T;
}

/** Ensures a Supabase session exists (anonymous guest on first need, FR-AC-01). */
export async function ensureSession(): Promise<string | null> {
  if (!hasSupabase()) return null;
  // Loaded on demand: the Supabase client stays out of the first-screen bundle.
  const { supabaseBrowser } = await import("@/lib/supabase/browser");
  const sb = supabaseBrowser();
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return anon.user?.id ?? null;
}

export interface Me {
  id: string;
  guest: boolean;
  email: string | null;
  nickname: string;
  avatar_color: string;
  skin: string | null;
  hat: string | null;
  title: string | null;
  hide_activity: boolean;
  country: string | null;
  city: string | null;
  age_band: string;
  settings: Record<string, unknown>;
  level: number;
  xp: number;
  xpInto: number;
  xpNeed: number;
  sparks: number;
  streak: {
    current: number;
    best: number;
    freezes_held: number;
    last_clear_date: string | null;
    lost_value?: number;
    lost_on?: string | null;
    flame: "orange" | "blue" | "purple" | "prism";
  };
  rank: { rating: number; name: string; division: string; emblem: string };
  ratings: Record<string, number>;
  /** equipped Shop board theme (backdrop and frame around boards) */
  boardTheme?: string | null;
  played?: string[];
  /** games learned in a guided first play, on any device (the practice round is skipped for these) */
  learned?: string[];
  /** lifetime clears, sent for guests only (the "Save your streak" prompt counts from this) */
  clears?: number;
  today: { date: string; cleared: Record<string, number>; featured: number; featuredCleared: number; counted: number };
}

export interface Today {
  signedIn?: boolean;
  /** the "features.dailies" switch: false means no Daily attempts (and no offline Daily pack) */
  dailies?: boolean;
  date: string;
  number: number;
  resetsInMs: number;
  games: { id: string; world: string; ready: boolean; state: "new" | "in_progress" | "cleared"; timeMs?: number }[];
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ["me"],
    enabled,
    retry: false,
    queryFn: async () => {
      try {
        // optional=1: no session or no profile yet answers null (first run) without a 401 in the console
        return await api<Me | null>("/api/v1/me?optional=1");
      } catch (e) {
        if (e instanceof HttpError && (e.status === 401 || e.status === 409)) return null; // no session or no profile yet
        throw e;
      }
    },
  });
}

export function useToday() {
  return useQuery({ queryKey: ["today"], queryFn: () => api<Today>("/api/v1/today"), staleTime: 15_000 });
}

export interface StartRes {
  attemptId: string;
  puzzle: unknown;
  state: unknown;
  startedAt: string;
  resumed: boolean;
  activeMs: number;
  hints: number;
  /** Shop hint packs usable after the 3 free hints (free play and archive only) */
  hintsBanked?: number;
  date: string | null;
  difficulty: string;
}

export function startAttempt(input: { game: string; mode: string; date?: string; difficulty?: string }) {
  return api<StartRes>("/api/v1/attempts", { json: input });
}
export function saveAttempt(id: string, state: unknown, activeMs: number) {
  return api<{ ok: true }>(`/api/v1/attempts/${id}`, { method: "PATCH", json: { state, activeMs } });
}
export function requestHint(id: string, state: unknown) {
  // `null`, not undefined: "no moves yet" must still send the key
  return api<{ hint: Hint | null }>(`/api/v1/attempts/${id}/hint`, { json: { state: state ?? null } });
}

export interface FinishRes {
  ok: boolean;
  status: "cleared" | "failed" | "flagged";
  timeMs: number;
  score?: number;
  reward: { xp: number; sparks: number; lines: { label: string; xp: number; sparks?: number }[] };
  percentile: number | null;
  level: { before: number; after: number; into: number; need: number };
  streak: { current: number; extended: boolean; milestone: number | null; freezeEarned: boolean } | null;
  fullSpuzl: boolean;
  unlocks: (
    | { type: "badge"; id: string; name: string; tier: string; icon: string; sparks: number; secret: boolean }
    | { type: "quest"; id: string; title: string }
  )[];
  rank: { track: string; before: number; after: number } | null;
}
export function finishAttempt(
  id: string,
  body: { state: unknown; activeMs: number; mistakes: number; deaths?: number; relaxed?: boolean; offline?: boolean; finishedAt?: string },
) {
  return api<FinishRes>(`/api/v1/attempts/${id}/finish`, { json: { ...body, localHour: new Date().getHours() } });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nickname: string; ageBand: string; color: string; turnstile?: string }) => {
      await ensureSession();
      return api<{ ok: true }>("/api/v1/profile", { json: input });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}
