import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

/** Integration helpers: talk to a running dev server (API_BASE) and local Supabase (.env.local). */
const env = Object.fromEntries(
  fs.existsSync(".env.local")
    ? fs
        .readFileSync(".env.local", "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
    : [],
);
export const BASE = process.env.API_BASE ?? "http://localhost:3000";
export const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
export const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
export const admin = () => createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

export async function guest(nickname?: string) {
  const sb = createClient(SB_URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  const token = data.session!.access_token;
  const api = async (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const res = await fetch(BASE + path, {
      ...init,
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };
  if (nickname) {
    const r = await api("/api/v1/profile", { json: { nickname, ageBand: "18+", color: "#2FD3E0" } });
    if (r.status !== 200) throw new Error(`profile: ${r.status} ${JSON.stringify(r.data)}`);
  }
  return { sb, token, userId: data.user!.id, api };
}

export const uniq = (p: string) => `${p}${Math.random().toString(36).slice(2, 8)}`;
