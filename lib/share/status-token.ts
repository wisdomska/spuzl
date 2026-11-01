import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Status card links: `/api/og/status/<playerId>.<sig>`. Link previews fetch the image without a session, so
 * the id must not be guessable from a player id alone (ids show up in friends lists and match rows). The
 * signature is an HMAC of the player id; only GET /api/v1/me/status-card hands it out, to the player
 * themself. The card is drawn from live rows, so a shared link follows later privacy changes (hide activity).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIG_BYTES = 16;

let warned = false;

/**
 * SHARE_CARD_SECRET, falling back to the service-role key (server-only, always set where cards render).
 * The fallback ties every shared link to that key: rotating it breaks them all. Production logs a warning once
 * per server instance when SHARE_CARD_SECRET is unset.
 */
export function statusSecret(env: Partial<Record<string, string>> = process.env): string {
  if (!env.SHARE_CARD_SECRET && env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.warn(
      "[status-card] SHARE_CARD_SECRET is not set; status card links are signed with SUPABASE_SERVICE_ROLE_KEY, " +
        "so rotating that key breaks every shared link. Set SHARE_CARD_SECRET (any long random string).",
    );
  }
  return env.SHARE_CARD_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function mac(playerId: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`status|${playerId.toLowerCase()}`).digest().subarray(0, SIG_BYTES);
}

export function signStatusToken(playerId: string, secret = statusSecret()): string {
  if (!secret) throw new Error("no share card secret");
  if (!UUID.test(playerId)) throw new Error("bad player id");
  return `${playerId.toLowerCase()}.${mac(playerId, secret).toString("base64url")}`;
}

/** The player id a token was signed for, or null (malformed, wrong signature, no secret). */
export function verifyStatusToken(token: string, secret = statusSecret()): string | null {
  if (!secret || typeof token !== "string" || token.length > 80) return null;
  const [id, sig, extra] = token.split(".");
  if (extra !== undefined || !id || !sig || !UUID.test(id)) return null;
  const got = Buffer.from(sig, "base64url");
  const want = mac(id, secret);
  return got.length === want.length && timingSafeEqual(got, want) ? id.toLowerCase() : null;
}
