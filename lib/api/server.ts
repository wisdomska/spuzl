import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

/** Wraps a route handler: maps ApiError and Zod errors to JSON, hides internals. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      if (!hasSupabase()) throw new ApiError(503, "backend_offline");
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
      if (e && typeof e === "object" && "issues" in e) return NextResponse.json({ error: "invalid_request", issues: (e as { issues: unknown }).issues }, { status: 400 });
      console.error("[api]", e);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json");
  }
  return schema.parse(raw);
}

export interface PlayerCtx {
  user: User;
  admin: SupabaseClient;
  player: { id: string; nickname: string; age_band: string; level: number; xp: number; sparks: number; banned_at: string | null; ranking_revoked: boolean; is_guest: boolean };
}

/** Requires a signed-in user (anonymous guests included) with a player profile. */
export async function requirePlayer(): Promise<PlayerCtx> {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "unauthenticated");
  const admin = supabaseAdmin();
  const { data: player } = await admin
    .from("players")
    .select("id, nickname, age_band, level, xp, sparks, banned_at, ranking_revoked, is_guest")
    .eq("id", user.id)
    .maybeSingle();
  if (!player) throw new ApiError(409, "no_profile");
  if (player.banned_at) throw new ApiError(403, "banned");
  return { user, admin, player };
}

export async function requireUser(): Promise<{ user: User; admin: SupabaseClient }> {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "unauthenticated");
  return { user, admin: supabaseAdmin() };
}

/** Fixed-window limiter in Postgres (free tier friendly; no Redis). */
export async function rateLimit(admin: SupabaseClient, key: string, max: number, windowSeconds: number) {
  const { data, error } = await admin.rpc("svc_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
  if (error) throw error;
  if (!data) throw new ApiError(429, "rate_limited");
}

export function todayGmt(): string {
  return new Date().toISOString().slice(0, 10);
}
