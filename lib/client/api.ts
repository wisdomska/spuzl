"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/browser";
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
  today: { date: string; cleared: Record<string, number>; featured: number; featuredCleared: number };
}

export interface Today {
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
      if (hasSupabase()) {
        const { data } = await supabaseBrowser().auth.getSession();
        if (!data.session) return null; // first run: no guest yet
      }
      try {
        return await api<Me>("/api/v1/me");
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
  seed?: string | null;
  date: string | null;
  difficulty: string;
}

export function startAttempt(input: { game: string; mode: string; date?: string; difficulty?: string; seed?: string }) {
  return api<StartRes>("/api/v1/attempts", { json: input });
}
export function saveAttempt(id: string, state: unknown, activeMs: number) {
  return api<{ ok: true }>(`/api/v1/attempts/${id}`, { method: "PATCH", json: { state, activeMs } });
}
export function requestHint(id: string, state: unknown) {
  return api<{ hint: Hint | null }>(`/api/v1/attempts/${id}/hint`, { json: { state } });
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
