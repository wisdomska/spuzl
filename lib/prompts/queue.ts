/**
 * The prompt queue (R2-04), pure. One rule: at most one prompt per screen visit (a pathname).
 *
 * - A prompt that wants to show `request`s the slot; it `withdraw`s when it no longer wants it (answered, closed,
 *   unmounted, or its screen became one it must not cover).
 * - `decide` hands the slot to the highest-priority request (PROMPT_PRIORITY), but only once the visit has
 *   settled for SETTLE_MS, so prompts that become ready a moment apart on the same screen are compared, not raced.
 * - Once a visit has given its slot away it is spent: a prompt closed on this screen is not followed by another.
 *   Requests that lost wait for the next visit.
 * - A prompt still open when the pathname changes carries over and counts as the new visit's prompt.
 *
 * The client store is `components/shell/PromptQueue.tsx`.
 */
import { PROMPT_PRIORITY, type PromptId } from "./ids";

export const SETTLE_MS = 800;

export interface QueueState {
  /** the current screen visit (pathname); "" before the first one */
  visit: string;
  visitAt: number;
  /** prompts that want a slot, in request order */
  waiting: PromptId[];
  /** the prompt on screen */
  active: PromptId | null;
  /** this visit's slot was given away */
  used: boolean;
}

export const initialQueue = (): QueueState => ({ visit: "", visitAt: 0, waiting: [], active: null, used: false });

/** A new screen visit. Requests stay (they are standing wants); an open prompt carries over and spends the slot. */
export function enterVisit(s: QueueState, visit: string, now: number): QueueState {
  if (visit === s.visit) return s;
  return { ...s, visit, visitAt: now, used: s.active !== null };
}

export function request(s: QueueState, id: PromptId): QueueState {
  if (s.active === id || s.waiting.includes(id)) return s;
  return { ...s, waiting: [...s.waiting, id] };
}

export function withdraw(s: QueueState, id: PromptId): QueueState {
  if (s.active !== id && !s.waiting.includes(id)) return s;
  return { ...s, waiting: s.waiting.filter((w) => w !== id), active: s.active === id ? null : s.active };
}

/** Milliseconds until `decide` could grant something, or null when nothing is pending this visit. */
export function settleIn(s: QueueState, now: number): number | null {
  if (!s.visit || s.active || s.used || !s.waiting.length) return null;
  return Math.max(0, s.visitAt + SETTLE_MS - now);
}

/** Grants the visit's slot to the highest-priority request once the visit has settled. */
export function decide(s: QueueState, now: number): QueueState {
  const wait = settleIn(s, now);
  if (wait === null || wait > 0) return s;
  const pick = PROMPT_PRIORITY.find((p) => s.waiting.includes(p));
  if (!pick) return s;
  return { ...s, active: pick, used: true, waiting: s.waiting.filter((w) => w !== pick) };
}

/**
 * Screens no overlay prompt (notifications, low data) may cover:
 * - Home (`/`): the Continue card sits at the bottom of every Home visit, and the first Home visit is off-limits;
 * - play: `/play` (with its results), a Duel (`/duel`, lobby and live rounds), a Party room (`/party/<code>`), a
 *   Board Games match (`/bay/<id>`), a ghost race or a challenge (`/ghost`, `/challenge`), the dev boards;
 * - first run and sign-in (`/intro`, `/welcome`) and the admin console.
 */
const QUIET = /^\/(?:$|(?:play|duel|ghost|challenge|dev|intro|welcome|admin)(?:\/|$)|(?:party|bay)\/[^/]+)/;

export const isQuietScreen = (pathname: string): boolean => QUIET.test(pathname);
