import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Difficulty } from "@/games/types";
import type { ContentRef, GuessToken } from "@/games/_shared/guess";

/**
 * Opaque, bound references for content games (games/_shared/guess.ts).
 *
 * A content puzzle is built from a content index and a difficulty (`{ game, i, d }`). That reference must not
 * reach the client as is: with it a player could ask the guess route about a board outside any attempt (try
 * Five words before guessing on their own attempt) and Penalty King's keeper dives follow from the index.
 * Wherever the server sends a content puzzle it swaps the reference for a token (`bindPuzzle`): the
 * reference, the player, the context it was served in and an expiry, encrypted and authenticated with
 * AES-256-GCM under a server secret. The client can neither read it nor make one. The guess route opens it
 * (`openGuessToken`) and answers only in that context:
 * - `a`: the player's own open attempt (Daily, free play, archive, challenge, ghost run);
 * - `m`: a race or duel round, while it is the match's current round and the player races in it;
 * - `p`: the public guided practice board.
 */
export type TokenContext = { k: "a"; a: string } | { k: "m"; m: string; s: number; r: number } | { k: "p" };

export interface TokenPayload {
  /** game id */
  g: string;
  /** content index */
  i: number;
  d: Difficulty;
  /** player the puzzle was served to */
  p: string;
  c: TokenContext;
  /** expiry, unix seconds */
  x: number;
}

/** How long a token stays good. A resumed attempt or a re-fetched match view gets a fresh one. */
export const TOKEN_TTL_S: Record<TokenContext["k"], number> = { a: 3 * 86_400, m: 3 * 3_600, p: 86_400 };

const VERSION = "1";
const IV = 12;
const TAG = 16;
const MAX_LEN = 600;
const DIFFICULTIES = new Set(["easy", "medium", "hard", "expert", "mega"]);

let warned = false;

/**
 * GUESS_REF_SECRET, falling back to the service-role key (server-only, always set where puzzles are served).
 * Rotating the secret only invalidates tokens in flight: the next puzzle load hands out new ones. With
 * neither set (unit tests, a bare dev shell) a fixed development key is used outside production.
 */
export function guessSecret(env: Partial<Record<string, string>> = process.env): string {
  const s = env.GUESS_REF_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!env.GUESS_REF_SECRET && env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.warn("[guess] GUESS_REF_SECRET is not set; content-game tokens use a key derived from SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (s) return s;
  if (env.NODE_ENV === "production") throw new Error("no guess token secret");
  return "spuzl-dev-guess-ref";
}

const keyOf = (secret: string) => createHash("sha256").update(`spuzl|guess-ref|v${VERSION}|${secret}`).digest();

export function sealGuessToken(payload: TokenPayload, secret = guessSecret()): string {
  const iv = randomBytes(IV);
  const c = createCipheriv("aes-256-gcm", keyOf(secret), iv);
  c.setAAD(Buffer.from(`v${VERSION}`));
  const body = Buffer.concat([c.update(JSON.stringify(payload), "utf8"), c.final()]);
  return `${VERSION}.${Buffer.concat([iv, body, c.getAuthTag()]).toString("base64url")}`;
}

/** The payload of a well-formed, untampered, unexpired token; null otherwise. */
export function openGuessToken(token: unknown, secret = guessSecret(), nowMs = Date.now()): TokenPayload | null {
  if (typeof token !== "string" || token.length > MAX_LEN || !token.startsWith(`${VERSION}.`)) return null;
  const raw = Buffer.from(token.slice(VERSION.length + 1), "base64url");
  if (raw.length < IV + TAG + 2) return null;
  let p: TokenPayload;
  try {
    const d = createDecipheriv("aes-256-gcm", keyOf(secret), raw.subarray(0, IV));
    d.setAAD(Buffer.from(`v${VERSION}`));
    d.setAuthTag(raw.subarray(raw.length - TAG));
    const text = Buffer.concat([d.update(raw.subarray(IV, raw.length - TAG)), d.final()]).toString("utf8");
    p = JSON.parse(text) as TokenPayload;
  } catch {
    return null;
  }
  if (!validPayload(p)) return null;
  if (p.x * 1000 <= nowMs) return null;
  return p;
}

function validPayload(p: TokenPayload): boolean {
  if (!p || typeof p !== "object") return false;
  if (typeof p.g !== "string" || typeof p.p !== "string" || !Number.isInteger(p.i) || p.i < 0) return false;
  if (!DIFFICULTIES.has(p.d) || !Number.isFinite(p.x)) return false;
  const c = p.c;
  if (!c || typeof c !== "object") return false;
  if (c.k === "a") return typeof c.a === "string";
  if (c.k === "m") return typeof c.m === "string" && Number.isInteger(c.s) && Number.isInteger(c.r);
  return c.k === "p";
}

/** A content reference as the generators write it (`{ game, i, d }`), or null. */
export function contentRefOf(puzzle: unknown): ContentRef | null {
  const r = (puzzle as { ref?: unknown } | null)?.ref as Partial<ContentRef> | undefined;
  if (!r || typeof r !== "object") return null;
  if (typeof r.game !== "string" || !Number.isInteger(r.i) || typeof r.d !== "string" || !DIFFICULTIES.has(r.d)) return null;
  return { game: r.game, i: r.i!, d: r.d as Difficulty };
}

/**
 * The puzzle as it may leave the server: a content reference becomes a token for this player and context;
 * anything else (logic games, the sealed quiz boards' string salt) is returned unchanged.
 */
export function bindPuzzle<P>(puzzle: P, playerId: string, ctx: TokenContext, secret = guessSecret(), nowMs = Date.now()): P {
  const ref = contentRefOf(puzzle);
  if (!ref) return puzzle;
  const t = sealGuessToken(
    { g: ref.game, i: ref.i, d: ref.d, p: playerId, c: ctx, x: Math.floor(nowMs / 1000) + TOKEN_TTL_S[ctx.k] },
    secret,
  );
  const token: GuessToken = { game: ref.game, t };
  return { ...(puzzle as object), ref: token } as P;
}
