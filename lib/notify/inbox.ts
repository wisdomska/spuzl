/**
 * Notifications on Home (owner, 13 Nov 2026): the weekly roundup, new games, friend requests and Board Games waiting
 * on your move, in one list behind a bell, so nothing on Home blocks the screen. `buildInbox` is pure (unit tested);
 * the bell keeps two lists on this device: what was removed, and what has been seen (the dot counts the rest).
 */
import { inboxCopy as T } from "@/lib/copy/inbox";

export type InboxKind = "week" | "new_games" | "friends" | "your_move";

export interface InboxItem {
  id: string;
  kind: InboxKind;
  icon: string;
  title: string;
  detail?: string;
  /** a page to open; the weekly roundup opens its own sheet instead */
  href?: string;
  /** removable with ×; friend requests and moves go when they're answered */
  removable: boolean;
}

export interface InboxInput {
  /** this week's roundup of last week (clears) when there is one */
  week?: { id: string; cleared: number } | null;
  /** new games not played yet, and the key of the whole new set */
  newGames?: { key: string; unplayed: number } | null;
  friendRequests?: { names: string[] } | null;
  yourMove?: { id: string; opponent: string; detail: string }[];
  removed?: readonly string[];
}

const names = (list: string[]) => (list.length <= 2 ? list.join(" and ") : `${list.slice(0, 2).join(", ")} and ${list.length - 2} more`);

export function buildInbox(input: InboxInput): InboxItem[] {
  const out: InboxItem[] = [];
  for (const g of input.yourMove ?? [])
    out.push({
      id: `move:${g.id}`,
      kind: "your_move",
      icon: "game-controller",
      title: T.yourMove(g.opponent),
      detail: g.detail,
      href: `/bay/${g.id}`,
      removable: false,
    });
  const fr = input.friendRequests?.names ?? [];
  if (fr.length)
    out.push({
      id: `friends:${[...fr].sort().join(",")}`,
      kind: "friends",
      icon: "user-plus",
      title: T.friends(fr.length),
      detail: T.friendsDetail(names(fr)),
      href: "/friends",
      removable: false,
    });
  if (input.week)
    out.push({
      id: `week:${input.week.id}`,
      kind: "week",
      icon: "calendar-blank",
      title: T.week(input.week.cleared),
      detail: T.weekDetail,
      removable: true,
    });
  if (input.newGames && input.newGames.unplayed > 0)
    out.push({
      id: `games:${input.newGames.key}`,
      kind: "new_games",
      icon: "sparkle",
      title: T.newGames(input.newGames.unplayed),
      detail: T.newGamesDetail,
      href: "/library?filter=new",
      removable: true,
    });
  const removed = new Set(input.removed ?? []);
  return out.filter((i) => !removed.has(i.id));
}

/** How many items haven't been seen on this device: the number on the bell. */
export const unseenCount = (items: readonly InboxItem[], seen: readonly string[]) => {
  const s = new Set(seen);
  return items.filter((i) => !s.has(i.id)).length;
};
