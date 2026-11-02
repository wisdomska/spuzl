import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";
import { effectiveBand } from "@/lib/age";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
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
      if (e && typeof e === "object" && "issues" in e)
        return NextResponse.json({ error: "invalid_request", issues: (e as { issues: unknown }).issues }, { status: 400 });
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
  player: {
    id: string;
    nickname: string;
    /** Derived from birth month and year at read time when they are kept (lib/age), else the stored band. */
    age_band: string;
    /** False for players from before birth month and year were asked, until they add theirs. */
    birth_set: boolean;
    level: number;
    xp: number;
    sparks: number;
    banned_at: string | null;
    ranking_revoked: boolean;
    is_guest: boolean;
  };
}

/**
 * Requires a signed-in user (anonymous guests included) with a player profile. The age band every gate reads
 * (player.age_band) is derived here from the stored birth month and year, so it moves the day the player ages,
 * even before the daily refresh (private.refresh_age_bands) updates the stored column; a stale stored band is
 * brought up to date on the way.
 */
export async function requirePlayer(): Promise<PlayerCtx> {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "unauthenticated");
  const admin = supabaseAdmin();
  const cols = "id, nickname, age_band, level, xp, sparks, banned_at, ranking_revoked, is_guest";
  let { data: row, error } = await admin.from("players").select(`${cols}, birth_year, birth_month`).eq("id", user.id).maybeSingle();
  // Deployed ahead of migration 20261119000001 (no birth columns yet): the stored band still works.
  if (error?.code === "42703") ({ data: row, error } = await admin.from("players").select(cols).eq("id", user.id).maybeSingle());
  if (error) throw error;
  if (!row) throw new ApiError(409, "no_profile");
  if (row.banned_at) throw new ApiError(403, "banned");
  const { birth_year, birth_month, ...rest } = row;
  const band = effectiveBand(row);
  // The trigger re-derives it from birth month and year; this only refreshes a band the daily job hasn't reached.
  if (birth_year != null && band !== row.age_band) await admin.from("players").update({ age_band: band }).eq("id", row.id);
  return { user, admin, player: { ...rest, age_band: band, birth_set: birth_year != null && birth_month != null } };
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
