/**
 * Nickname rules (FR-AC-03): 3 to 16 chars, letters, digits and underscore, filtered.
 * The filter normalises leetspeak and checks substrings against a blocklist. Moderators review reports.
 */
/** Abuse, slurs and sexual terms (shared with the 18+ party text filter in lib/party-adult/filter.ts). */
export const OFFENSIVE = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "dick",
  "pussy",
  "nigg",
  "fag",
  "slut",
  "whore",
  "rape",
  "nazi",
  "hitler",
  "porn",
  "sex",
  "kill",
  "suicide",
  "kwasia",
  "ashawo",
  "mumu",
  "olodo",
  "ode",
] as const;
/** Names that pretend to be staff or the app. */
const IMPERSONATION = ["admin", "spuzl", "moderator", "support", "official"];
const BLOCK: string[] = [...OFFENSIVE, ...IMPERSONATION];
const ALLOW = ["code", "model", "mode", "node", "episode", "spuzler"]; // contain a blocked substring innocently ("Spuzler" is what players are called)

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/_/g, "");
}

export function nicknameProblem(nick: string): string | null {
  if (nick.length < 3) return "At least 3 characters.";
  if (nick.length > 16) return "16 characters max.";
  if (!/^[A-Za-z0-9_]+$/.test(nick)) return "Letters, numbers and _ only.";
  const n = normalise(nick);
  const clean = ALLOW.reduce((s, w) => s.replaceAll(w, ""), n);
  if (BLOCK.some((b) => (b.length <= 3 ? clean === b || clean.startsWith(b) : clean.includes(b)))) return "Pick another name.";
  return null;
}
