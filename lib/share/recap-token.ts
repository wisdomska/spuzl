import { createHmac, timingSafeEqual } from "node:crypto";
import { statusSecret } from "./status-token";

/**
 * Weekly recap card links (R3-10): `/api/og/recap/<playerId>.<yyyymmdd>.<sig>`, the Monday of the week summed up.
 * Link previews fetch the image without a session, so like the status card the link is signed (HMAC of the player
 * id and week, same secret); only GET /api/v1/me/weekly-recap hands it out, to the player themself.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WEEK = /^(\d{4})(\d{2})(\d{2})$/;
const SIG_BYTES = 16;

function mac(playerId: string, week: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`recap|${playerId.toLowerCase()}|${week}`).digest().subarray(0, SIG_BYTES);
}

export function signRecapToken(playerId: string, week: string, secret = statusSecret()): string {
  if (!secret) throw new Error("no share card secret");
  if (!UUID.test(playerId) || !/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error("bad recap token input");
  return `${playerId.toLowerCase()}.${week.replace(/-/g, "")}.${mac(playerId, week, secret).toString("base64url")}`;
}

/** The player id and week a token was signed for, or null (malformed, wrong signature, no secret). */
export function verifyRecapToken(token: string, secret = statusSecret()): { playerId: string; week: string } | null {
  if (!secret || typeof token !== "string" || token.length > 100) return null;
  const [id, w, sig, extra] = token.split(".");
  if (extra !== undefined || !id || !w || !sig || !UUID.test(id)) return null;
  const m = WEEK.exec(w);
  if (!m) return null;
  const week = `${m[1]}-${m[2]}-${m[3]}`;
  const got = Buffer.from(sig, "base64url");
  const want = mac(id, week, secret);
  return got.length === want.length && timingSafeEqual(got, want) ? { playerId: id.toLowerCase(), week } : null;
}
