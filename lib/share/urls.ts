import type { CardFormat, CardKind } from "./card-model";

/**
 * Share card image URLs. Cards are rendered from server data by id; only the frame and size are
 * chosen here. Low-data mode asks for the half-size render (540 × 960 / 540 × 540).
 *
 *   cardUrl("daily", attemptId)                  Daily clear, 1080 × 1920
 *   cardUrl("full", attemptId, { format: "square" })
 *   cardUrl("duel", matchId)  /  cardUrl("party", matchId, { player: myId })
 */
export function cardUrl(
  kind: CardKind,
  id: string,
  opts: { format?: CardFormat; small?: boolean; player?: string; origin?: string } = {},
): string {
  const path = kind === "duel" || kind === "party" ? "match" : kind;
  const sp = new URLSearchParams();
  if (opts.format === "square") sp.set("format", "square");
  if (opts.small) sp.set("size", "small");
  if (kind === "party" && opts.player) sp.set("p", opts.player);
  const q = sp.toString();
  return `${opts.origin ?? ""}/api/og/${path}/${encodeURIComponent(id)}${q ? `?${q}` : ""}`;
}
