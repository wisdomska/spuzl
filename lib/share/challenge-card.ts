import type { SpuzMood } from "@/components/brand/Spuz";
import type { WorldId } from "@/lib/catalog";
import { formatShort } from "@/lib/format";
import { challengeCopy } from "@/lib/copy/challenge";
import { CODE_ALPHABET } from "@/lib/multiplayer/roomCode";
import { STATUS_HATS, worldCardColours } from "./card-model";

/**
 * Friend challenge card (admin setting "features.challenges"): the link preview image of /challenge/<code> and,
 * in its 9:16 frame, the story card shared from a clear. Pure: lib/share/challenge.ts fills the input from the
 * challenge row and the sender's player row, never from the query string.
 */

/** Challenge codes: 6 characters from the room-code alphabet (no 0, O, 1 or I). */
export const CHALLENGE_CODE_LENGTH = 6;
const CODE = new RegExp(`^[${CODE_ALPHABET}]{${CHALLENGE_CODE_LENGTH}}$`);

/** A well-formed challenge code (trimmed, upper-cased), or null. */
export function challengeCodeOf(raw: string): string | null {
  const c = raw.trim().toUpperCase();
  return CODE.test(c) ? c : null;
}

/** Challenge links last this long (the `challenges.expires_at` default in SQL is 7 days). */
export const CHALLENGE_DAYS = 7;

/** Short link to a challenge: /c/<code> redirects to /challenge/<code>. */
export const challengePath = (code: string) => `/c/${code.toUpperCase()}`;

/** Link preview (1200 × 630, what WhatsApp, Instagram DMs and X crop to) and the 9:16 story. */
export type ChallengeFormat = "og" | "story";
export const CHALLENGE_SIZES: Record<ChallengeFormat, { width: number; height: number }> = {
  og: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
};

export interface ChallengeCardInput {
  code: string;
  nickname: string;
  /** avatar colour, #RRGGBB */
  color: string;
  /** equipped shop hat id (players.hat) */
  hat: string | null;
  gameName: string;
  /** colour family of the game (lib/catalog toneOf) */
  world: WorldId;
  senderMs: number;
  /** where the card is printed: the share domain (spuzl.vercel.app) */
  domain: string;
}

export interface ChallengeCardModel {
  kind: "challenge";
  bg: string;
  dot: string;
  fg: string;
  z: string;
  spuz: string;
  hat: string | null;
  mood: SpuzMood;
  nickname: string;
  /** the game's name */
  kicker: string;
  /** the time to beat */
  big: string;
  /** "Kofi's time" */
  who: string;
  /** "Beat me" */
  dare: string;
  /** spuzl.vercel.app/c/K7QX2M */
  link: string;
  alt: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const LIME = "#B8F23A";

export function challengeCard(i: ChallengeCardInput): ChallengeCardModel {
  const { bg, dot } = worldCardColours(i.world);
  const hat = i.hat && (STATUS_HATS as readonly string[]).includes(i.hat) ? i.hat : null;
  const big = formatShort(i.senderMs);
  return {
    kind: "challenge",
    bg,
    dot,
    fg: "#F4F5FB",
    z: LIME,
    spuz: HEX.test(i.color) ? i.color.toUpperCase() : LIME,
    hat,
    // A hat sits where the party and fire poses draw theirs; with a hat, Spuz waves (as on the status card).
    mood: hat ? "wave" : "proud",
    nickname: i.nickname,
    kicker: i.gameName,
    big,
    who: challengeCopy.card.who(i.nickname),
    dare: challengeCopy.card.dare,
    link: `${i.domain}${challengePath(i.code)}`,
    alt: challengeCopy.card.alt(i.nickname, i.gameName, big),
  };
}

/** Whole days left on a challenge, rounded up (a link with 3 hours left reads "1 day"); 0 once it ran out. */
export function challengeDaysLeft(expiresAt: number, now = Date.now()): number {
  const left = expiresAt - now;
  return left <= 0 ? 0 : Math.ceil(left / 86_400_000);
}

/** Design sample for the dev preview route and tests. */
export const SAMPLE_CHALLENGE: ChallengeCardModel = challengeCard({
  code: "K7QX2M",
  nickname: "Kofi",
  color: "#2FD3E0",
  hat: "kente",
  gameName: "Crownfall",
  world: "logic",
  senderMs: 72_000,
  domain: "spuzl.vercel.app",
});
