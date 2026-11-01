/**
 * Text filter for the 18+ party modes (Two Truths statements, Draw It guesses). The server runs it on every
 * typed line before anything is stored or shown; the client runs it too, only to explain a refusal early.
 *
 * Three checks, in order:
 *  1. shape: one line, not empty, within the length limit (statements 80, guesses 30);
 *  2. contact details: phone numbers, emails, links, @handles and "add me on ..." style asks;
 *  3. abuse: the nickname blocklist (`OFFENSIVE`) plus extra sexual and abusive terms, matched per word
 *     after the same leetspeak normalisation, so "sushi tea" or "Dickson" are not caught by accident.
 *
 * It is a first line only: every statement, guess and drawing also has a Report button, and moderators
 * review reports (admin moderation, "Party content" tab).
 */
import { normalise, OFFENSIVE } from "@/lib/validation/nickname";

export type PartyTextKind = "statement" | "guess";
export const TEXT_MAX: Record<PartyTextKind, number> = { statement: 80, guess: 30 };

export type TextProblem = "empty" | "too_long" | "contact" | "blocked";

/** Matched anywhere inside a word ("motherf...", "bullsh...") after normalising. */
const STEMS = [
  ...OFFENSIVE.filter((w) => w.length >= 4 && !["dick", "rape", "kill"].includes(w)),
  "dildo",
  "blowjob",
  "handjob",
  "wank",
  "twat",
  "bastard",
  "asshole",
  "faggot",
  "retard",
  "penis",
  "vagina",
  "boob",
  "nude",
  "horny",
  "molest",
  "paedo",
  "incest",
  "masturbat",
  "orgasm",
  "erection",
];

/** Matched only as a whole word (they hide inside innocent words: grape, Dickson, torpedo, assume). */
const WORDS = new Set([
  ...OFFENSIVE.filter((w) => w.length <= 3),
  "dick",
  "dicks",
  "fags",
  "sexy",
  "sexual",
  "rape",
  "raped",
  "rapes",
  "raping",
  "rapist",
  "ass",
  "arse",
  "cock",
  "cocks",
  "cum",
  "tits",
  "titty",
  "pedo",
  "pedos",
  "hoe",
  "hoes",
  "thot",
  "nonce",
  "kys",
  "aboa",
  "kote",
  "etwe",
  "gyimi",
]);

/** Abusive phrases checked on the normalised, space-separated text. */
const PHRASES = ["kill yourself", "kill urself", "kill your self", "go die", "send nudes", "send nude"];

const PLATFORMS = "snap|snapchat|insta|instagram|ig|whatsapp|wa|telegram|tiktok|discord|facebook|fb|twitter|signal|imo|kik";
const TLDS = "com|net|org|io|gh|co|me|ly|app|xyz|info|biz|tv|gg|link|site|online|ng|uk|us|ai|dev|shop";

const CONTACT: RegExp[] = [
  // links: scheme, www, a name glued to a common top-level domain ("spuzl.gh"), or spelled out ("x dot gh").
  // A full stop with spaces only counts before com, net and org, so "I can swim. Me too" stays fine.
  /(?:https?:\/\/|www\s*\.)/i,
  new RegExp(`\\b[a-z0-9-]+\\.(?:${TLDS})\\b`, "i"),
  new RegExp(`\\b[a-z0-9-]+\\s*(?:\\(dot\\)|\\[dot\\]|\\sdot\\s)\\s*(?:${TLDS})\\b`, "i"),
  /\.\s*(?:com|net|org)\b/i,
  // emails, including "name (at) mail.com"
  /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[a-z0-9-]+\s*\.\s*[a-z]{2,}/i,
  // @handles
  /(?:^|[^a-z0-9])@[a-z0-9_.]{2,}/i,
  // phone numbers: seven or more digits with only spaces, dashes, dots or brackets between them
  /(?:\+?\d[\s\-().]{0,2}){7,}/,
  // "add me", "dm me", "my snap", "ig: name"
  /\b(?:add|dm|text|call|message|msg|follow|find|hmu|hit|ping|whatsapp)\s+me\b/i,
  new RegExp(`\\b(?:my|on)\\s+(?:${PLATFORMS})\\b`, "i"),
  new RegExp(`\\b(?:${PLATFORMS})\\s*[:=]`, "i"),
];

// Control, zero-width and bidi-override characters.
const CONTROL = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]", "g");
// Combining accents left by NFKD ("é" becomes "e").
const MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Lower case, leetspeak undone, words split on anything that isn't a letter; runs of single letters joined ("f u c k"). */
export function textTokens(text: string): string[] {
  const words = normalise(text.normalize("NFKD").replace(MARKS, ""))
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const out: string[] = [];
  let run = "";
  for (const w of words) {
    if (w.length === 1) {
      run += w;
      continue;
    }
    if (run) out.push(run);
    run = "";
    out.push(w);
  }
  if (run) out.push(run);
  return out;
}

/** Collapses whitespace and strips control characters. What the server stores and shows. */
export function cleanText(text: string): string {
  return text.normalize("NFC").replace(CONTROL, " ").replace(/\s+/g, " ").trim();
}

/** The reason a line is refused, or null when it may be shown to the room. */
export function partyTextProblem(raw: string, kind: PartyTextKind): TextProblem | null {
  const text = cleanText(raw);
  if (!text) return "empty";
  if ([...text].length > TEXT_MAX[kind]) return "too_long";
  if (CONTACT.some((r) => r.test(text))) return "contact";
  const tokens = textTokens(text);
  if (tokens.some((t) => WORDS.has(t) || (t.endsWith("s") && WORDS.has(t.slice(0, -1))) || STEMS.some((s) => t.includes(s))))
    return "blocked";
  const spaced = ` ${tokens.join(" ")} `;
  if (PHRASES.some((p) => spaced.includes(` ${p} `))) return "blocked";
  return null;
}
