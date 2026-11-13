import "server-only";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Live-message usage estimate (owner, 13 Nov 2026) for the admin Overview. Supabase's free plan allows about 2
 * million Realtime messages a month and its API doesn't report the count, so the server counts what it sends: each
 * broadcast is 1 message in plus one delivery per player in that room. Counted after the response (never on the
 * player's wait) and written in small batches per server instance. Messages devices send directly (chat, emotes,
 * presence) aren't seen here, so the figure reads a little low.
 */
export const REALTIME_FREE_MONTHLY = 2_000_000;
const FLUSH_MS = 3000;
const SIZE_TTL_MS = 60_000;

let pending = 0;
let pendingDay = "";
let lastFlush = 0;
const sizes = new Map<string, { n: number; at: number }>();
const today = () => new Date().toISOString().slice(0, 10);

/** How many players receive a broadcast on `topic`. Pure apart from the cached room size. */
export function recipientsFor(topic: string, roomSize: (matchId: string) => number | undefined): number {
  if (topic.startsWith("user:")) return 1;
  if (topic.startsWith("bay:")) return 2;
  const id = topic.startsWith("match:") ? topic.slice(6) : topic.startsWith("ink:") ? topic.slice(4) : null;
  return id ? (roomSize(id) ?? 2) : 1;
}

async function roomSize(matchId: string): Promise<number> {
  const hit = sizes.get(matchId);
  if (hit && Date.now() - hit.at < SIZE_TTL_MS) return hit.n;
  const { count } = await supabaseAdmin().from("match_players").select("player_id", { count: "exact", head: true }).eq("match_id", matchId);
  const n = Math.max(1, count ?? 2);
  sizes.set(matchId, { n, at: Date.now() });
  if (sizes.size > 500) sizes.delete(sizes.keys().next().value!);
  return n;
}

async function count(topic: string) {
  const id = topic.startsWith("match:") ? topic.slice(6) : topic.startsWith("ink:") ? topic.slice(4) : null;
  const size = id ? await roomSize(id) : undefined;
  const n = 1 + recipientsFor(topic, () => size);
  const day = today();
  if (pendingDay && pendingDay !== day) await flush();
  pendingDay = day;
  pending += n;
  if (Date.now() - lastFlush >= FLUSH_MS) await flush();
}

async function flush() {
  if (!pending) return;
  const n = pending;
  const day = pendingDay;
  pending = 0;
  lastFlush = Date.now();
  const { error } = await supabaseAdmin().rpc("svc_add_realtime_usage", { p_day: day, p_n: n });
  if (error) pending += n; // try again with the next batch
}

/** Counts one broadcast on `topic`, after the response. Never throws, never slows the request. */
export function noteBroadcast(topic: string) {
  const run = () => count(topic).catch(() => {});
  try {
    after(run);
  } catch {
    void run(); // outside a request (a job): count straight away
  }
}

/** This month's estimate so far (admin Overview). */
export async function realtimeUsageThisMonth(): Promise<{ messages: number; limit: number }> {
  const first = today().slice(0, 8) + "01";
  const { data } = await supabaseAdmin().from("realtime_usage").select("messages").gte("day", first);
  return { messages: (data ?? []).reduce((s, r) => s + Number(r.messages), 0), limit: REALTIME_FREE_MONTHLY };
}
