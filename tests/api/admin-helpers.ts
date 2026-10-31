import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ANON, BASE, SB_URL, admin, uniq } from "./helpers";

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from a base32 secret, as an authenticator app computes it. */
export function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

export type Role = "owner" | "content_editor" | "moderator" | "analyst";
export type Call = (path: string, init?: RequestInit & { json?: unknown }) => Promise<{ status: number; data: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface AdminSession {
  userId: string;
  email: string;
  role: Role | null;
  /** password + TOTP verified */
  aal2: Call;
  /** password only */
  aal1: Call;
}

const caller =
  (token: string): Call =>
  async (path, init = {}) => {
    const res = await fetch(BASE + path, {
      ...init,
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };

/**
 * A fresh admin (or a plain email user when role is null): created with the service role, signed in with a
 * throwaway test password, then TOTP enrolled and verified. Returns an AAL1 and an AAL2 caller.
 */
export async function adminSession(role: Role | null): Promise<AdminSession> {
  const db = admin();
  const email = `${uniq(role ?? "user")}@admin.test`;
  const password = randomBytes(18).toString("base64url");
  const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  if (role) {
    const { error: e2 } = await db.from("admins").insert({ user_id: userId, role, email });
    if (e2) throw e2;
  }
  const sb = createClient(SB_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s1, error: e3 } = await sb.auth.signInWithPassword({ email, password });
  if (e3) throw e3;
  const aal1Token = s1.session!.access_token;
  const { data: factor, error: e4 } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "test" });
  if (e4) throw e4;
  const { error: e5 } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(factor.totp.secret) });
  if (e5) throw e5;
  const { data: s2 } = await sb.auth.getSession();
  return { userId, email, role, aal1: caller(aal1Token), aal2: caller(s2.session!.access_token) };
}
