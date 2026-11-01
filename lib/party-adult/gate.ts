/**
 * Age gate for the 18+ party modes. One rule, used by the server for every create, join, view and action,
 * and by the client to decide whether the modes are shown at all:
 *   the admin switch "features.adultParty" is on, AND the player is signed in with an account (not an
 *   anonymous guest), AND their stored age band is 18+, AND no moderator block is running.
 * Anything else is refused (403 on the API) and the modes are never shown.
 */
export interface AdultGateInput {
  /** players.age_band: "13-15" | "16-17" | "18+" */
  ageBand: string | null | undefined;
  /** anonymous auth user or players.is_guest */
  guest: boolean;
  /** players.adult_party_blocked_until (ISO) */
  blockedUntil?: string | null;
}

export type AdultRefusal = "adult_party_off" | "adults_signed_in" | "adults_only" | "adult_party_blocked";

export function adultPartyRefusal(p: AdultGateInput, enabled: boolean, now = Date.now()): AdultRefusal | null {
  if (!enabled) return "adult_party_off";
  if (p.guest) return "adults_signed_in";
  if (p.ageBand !== "18+") return "adults_only";
  if (p.blockedUntil && Date.parse(p.blockedUntil) > now) return "adult_party_blocked";
  return null;
}

/** Client: whether to show Draw It and Two Truths at all (a running block is left to the server). */
export const canSeeAdultParty = (p: { age_band?: string; guest?: boolean } | null | undefined, enabled: boolean) =>
  !!p && adultPartyRefusal({ ageBand: p.age_band, guest: p.guest !== false }, enabled) === null;
