import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { guessSecret } from "@/lib/game/guess-token";

/**
 * Draw It live ink pass (R4-24). The round view hands it to the round's drawer only, while the round is drawing;
 * the ink relay (POST /api/v1/ink) takes a batch only with a pass for the caller, then broadcasts the batch on the
 * room's ink channel itself, stamped with the drawer and round from the pass. Players can't publish on that
 * channel (Realtime policy, Ably capability, PartyKit relay), so every live line a viewer sees came through here.
 *
 * Signed (HMAC-SHA256) with the server's token secret under its own label; nothing secret is inside, so it is
 * signed, not encrypted. It needs no database read, so the relay stays cheap at a batch every INK.batchMs.
 */
export interface InkPass {
  /** match id */
  m: string;
  /** set number (a rematch starts a new set) */
  s: number;
  /** round */
  r: number;
  /** the drawer */
  p: string;
  /** expiry, ms */
  x: number;
}

/** How long a pass outlives the drawing phase's end (a late last batch still lands). */
export const INK_PASS_SLACK_MS = 5000;

const MAX_LEN = 400;
const mac = (body: string, secret: string) => createHmac("sha256", `spuzl|ink-pass|v1|${secret}`).update(body).digest();

export function signInkPass(p: InkPass, secret = guessSecret()): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${mac(body, secret).toString("base64url")}`;
}

/** The pass if it is well formed, signed by this server and not expired; null otherwise. */
export function openInkPass(token: unknown, now = Date.now(), secret = guessSecret()): InkPass | null {
  if (typeof token !== "string" || token.length > MAX_LEN) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const want = mac(body, secret);
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  let p: InkPass;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as InkPass;
  } catch {
    return null;
  }
  if (!p || typeof p !== "object" || typeof p.m !== "string" || typeof p.p !== "string") return null;
  if (!Number.isInteger(p.s) || !Number.isInteger(p.r) || !Number.isFinite(p.x) || p.x < now) return null;
  return p;
}
