/**
 * Social rules shared by routes and screens: codes, presence, reactions, report reasons, privacy.
 * Pure functions only (unit tested in lib/social/social.test.ts).
 */
import { GAME_BY_ID } from "@/lib/catalog";

/** Room, crew and invite codes: no 0/O or 1/I (Components file, room code card). */
export const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function makeCode(length: number, random: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < length; i++) s += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return s;
}

export function normaliseCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** Presets only (FR-SO-04): no free text anywhere in social. */
export const REACTIONS = ["fire", "lol", "gg", "wow", "clap"] as const;
export type Reaction = (typeof REACTIONS)[number];
/** Emoji are allowed in emotes (copy rule): the reaction chips are emotes. */
export const REACTION_GLYPH: Record<Reaction, string> = { fire: "🔥", lol: "😂", gg: "GG", wow: "😮", clap: "👏" };
export const REACTION_LABEL: Record<Reaction, string> = { fire: "Fire", lol: "Funny", gg: "Good game", wow: "Wow", clap: "Clap" };

/** Report sheet options (F2) mapped onto reports.reason. */
export const REPORT_REASONS = [
  { id: "nickname", label: "Offensive nickname", icon: "text-aa" },
  { id: "cheating", label: "Cheating or bot", icon: "robot" },
  { id: "harassment", label: "Harassing me", icon: "hand-palm" },
  { id: "other", label: "Something else", icon: "dots-three" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

/** Online if seen in the last 2 minutes (the client heartbeats every 60 s while visible). */
export const ONLINE_WINDOW_MS = 2 * 60_000;

export interface Presence {
  online: boolean;
  label: string;
}

export function presenceFor(lastSeen: string | null, playing: string | null, now: number = Date.now()): Presence {
  const seen = lastSeen ? Date.parse(lastSeen) : NaN;
  if (Number.isFinite(seen) && now - seen <= ONLINE_WINDOW_MS) {
    const game = playing ? GAME_BY_ID[playing] : null;
    return { online: true, label: game ? `Playing ${game.name}` : "Online" };
  }
  if (!Number.isFinite(seen)) return { online: false, label: "Offline" };
  return { online: false, label: `Seen ${agoLong(now - seen)} ago` };
}

/** "2 h", "5 min", "3 d" */
export function agoLong(ms: number): string {
  const m = Math.max(1, Math.floor(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

/** Feed timestamps: "4m", "1h", "2d" */
export function agoShort(iso: string, now: number = Date.now()): string {
  const m = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export type AgeBand = "13-15" | "16-17" | "18+";

/** Under-16s show nickname and avatar only, and only add friends by invite link or QR (SRS 15.2). */
export const isUnder16 = (band: string | null | undefined) => band === "13-15";

/** Username requests are blocked when either side is under 16. */
export function canRequestByUsername(from: string, to: string): boolean {
  return !isUnder16(from) && !isUnder16(to);
}

export interface FeedPayload {
  timeMs?: number;
  hints?: number;
  badge?: string;
  level?: number;
  days?: number;
  tier?: string;
}

/** One-line feed copy ("Kofi cleared Crownfall in 1:05, no hints"). No dashes, no emoji. */
export function feedLine(
  name: string,
  kind: string,
  game: string | null,
  p: FeedPayload,
  badgeName?: (id: string) => string | undefined,
): string {
  const g = game ? (GAME_BY_ID[game]?.name ?? game) : "";
  switch (kind) {
    case "clear":
    case "full_spuzl": {
      const t = p.timeMs !== undefined ? ` in ${clock(p.timeMs)}` : "";
      const tail = p.hints === 0 ? ", no hints" : "";
      const base = `${name} cleared ${g}${t}${tail}`;
      return kind === "full_spuzl" ? `${base}. Full Spuzl today` : base;
    }
    case "badge":
      return `${name} earned ${badgeName?.(p.badge ?? "") ?? "a badge"}`;
    case "level":
      return `${name} reached level ${p.level ?? ""}`.trim();
    case "streak":
      return `${name} hit a ${p.days ?? 0}-day streak`;
    case "duel_win":
      return `${name} won a Duel${g ? ` in ${g}` : ""}`;
    case "party_win":
      return `${name} won a Party Race`;
    case "promotion":
      return `${name} was promoted to ${p.tier ?? "a new league"}`;
    default:
      return `${name} played SPUZL`;
  }
}

function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Avatar initial for row chips. */
export const initial = (nickname: string) => (nickname.trim()[0] ?? "?").toUpperCase();
