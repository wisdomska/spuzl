/**
 * Deep links a first-run visitor comes back to after onboarding (`?return=` on /intro, /welcome and /welcome/play).
 * Shared by the server gates (lib/auth/gate.ts) and the client (lib/client/onboarding.ts). Only known names map to
 * a path, and only to paths built here, so `?return=` can never send anyone to another site or an arbitrary page:
 * - "daily": the Daily Five (/daily).
 * - "game:<id>" (R4-03): that game's page (/play/<id>), for a real catalog game that is not retired.
 */
import { playableGame } from "@/lib/catalog";

const GAME_ID = /^[a-z0-9]{1,32}$/;

/** The path a `?return=` value leads back to, or null for anything unknown. */
export function returnPath(param: string | null | undefined): string | null {
  if (!param) return null;
  if (param === "daily") return "/daily";
  if (param.startsWith("game:")) {
    const id = param.slice(5);
    return GAME_ID.test(id) && playableGame(id) ? `/play/${id}` : null;
  }
  return null;
}

/** True for a path `returnPath` can produce (a stored value is checked again before it is used). */
export function isReturnPath(to: string | null | undefined): to is string {
  if (!to) return false;
  if (to === "/daily") return true;
  const m = /^\/play\/([^/?#]+)$/.exec(to);
  return !!m && returnPath(`game:${m[1]}`) === to;
}

/** The `?return=` value for a game's page (the gates and PlayScreen send first-run visitors off with it). */
export const gameReturn = (id: string) => `game:${id}`;
