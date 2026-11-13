/** Notifications (the bell on Home, owner 13 Nov 2026). Short and plain. */
export const inboxCopy = {
  open: (n: number) => (n ? `Notifications, ${n} new` : "Notifications"),
  title: "Notifications",
  empty: "You're all caught up.",
  emptyHint: "Your weekly roundup, new games, friend requests and your moves land here.",
  week: (n: number) => (n === 1 ? "Your week: 1 game cleared" : `Your week: ${n} games cleared`),
  weekDetail: "Tap to see your roundup.",
  newGames: (n: number) => (n === 1 ? "1 new game to try" : `${n} new games to try`),
  newGamesDetail: "Fresh in All games.",
  friends: (n: number) => (n === 1 ? "1 friend request" : `${n} friend requests`),
  friendsDetail: (names: string) => `From ${names}.`,
  yourMove: (name: string) => `Your move against ${name}`,
  dismiss: "Remove",
  newBadge: "New",
} as const;
