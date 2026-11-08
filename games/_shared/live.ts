/**
 * Reviewed content (round 3, item 12): for each content game, the entries of its content.ts the admin retired (never
 * dealt) and the ones it corrected (dealt as edited). Every content game's picker reads its list through
 * `liveContent`, so a retired entry can't reach a board and an edited one replaces the code entry.
 *
 * The server fills this from the database before it builds a board (lib/content/review.ts, through
 * lib/game/served-logic.ts). Logic modules are server only in practice (games/logic-registry.ts); in tests and dev
 * fixtures nothing is set, so every entry plays as written.
 */
export interface ContentReview {
  /** indexes into the content.ts list that are never dealt */
  retired: ReadonlySet<number>;
  /** index into the content.ts list to the entry dealt instead */
  edited: ReadonlyMap<number, unknown>;
}

const REVIEWS = new Map<string, ContentReview>();
/** Last list built per game, so pickers that run many times per board don't rebuild it. */
const MEMO = new Map<string, { all: readonly unknown[]; review: ContentReview | undefined; live: readonly unknown[] }>();

/** Sets (or, with null, clears) a game's reviewed state. */
export function setContentReview(game: string, review: ContentReview | null) {
  if (review && (review.retired.size || review.edited.size)) REVIEWS.set(game, review);
  else REVIEWS.delete(game);
  MEMO.delete(game);
}

export const contentReviewOf = (game: string): ContentReview | undefined => REVIEWS.get(game);

/** The entries a board may use: edited ones swapped in, retired ones left out, the rest in content.ts order. */
export function liveContent<T>(game: string, all: readonly T[]): readonly T[] {
  const review = REVIEWS.get(game);
  if (!review) return all;
  const m = MEMO.get(game);
  if (m && m.all === all && m.review === review) return m.live as readonly T[];
  const live: T[] = [];
  all.forEach((e, i) => {
    if (!review.retired.has(i)) live.push(review.edited.has(i) ? (review.edited.get(i) as T) : e);
  });
  MEMO.set(game, { all, review, live });
  return live;
}

/**
 * Runs `fn` with a game's reviewed state set to `review`, then puts the previous state back (synchronously, so no
 * other request sees it). The admin uses it to check that a game still builds boards before saving a decision.
 */
export function withContentReview<R>(game: string, review: ContentReview | null, fn: () => R): R {
  const before = REVIEWS.get(game) ?? null;
  setContentReview(game, review);
  try {
    return fn();
  } finally {
    setContentReview(game, before);
  }
}
