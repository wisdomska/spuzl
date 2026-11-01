/**
 * League placement for a player joining this week's league (SPZ-21). Pure, so the server route can run it
 * on the candidates `svc_league_candidates` returns and pass the choice to `svc_join_current_league`, which
 * re-checks it under the join lock (room, week, tier or friend rule) and falls back to its own pick.
 *
 * Order:
 *  1. Friends first (game setting `leagues.fillWithFriends`, new players only): the open group with the most
 *     friends in it, at any tier, so a newcomer plays alongside the people who invited them.
 *  2. Level-matched: an open group at the player's tier. Groups still under `leagues.minGroup` come first
 *     (they get topped up before anyone starts a new one), then the closest average player level.
 *  3. Nothing fits: null, and the database opens a new group.
 */
export interface LeagueCandidate {
  id: string;
  tier: number;
  /** players in the group now */
  members: number;
  /** of those, the joining player's friends */
  friends: number;
  /** average player level in the group */
  avgLevel: number;
}

export interface JoiningPlayer {
  tier: number;
  level: number;
  /** never been in a league before */
  isNew: boolean;
}

export interface GroupingOptions {
  /** max players per group */
  size: number;
  /** `leagues.minGroup` */
  minGroup: number;
  /** `leagues.fillWithFriends` */
  fillWithFriends: boolean;
}

export function chooseLeague(player: JoiningPlayer, candidates: LeagueCandidate[], opts: GroupingOptions): string | null {
  const open = candidates.filter((c) => c.members < opts.size);
  const byLevel = (a: LeagueCandidate, b: LeagueCandidate) =>
    Math.abs(a.avgLevel - player.level) - Math.abs(b.avgLevel - player.level) || b.members - a.members || a.id.localeCompare(b.id);

  if (opts.fillWithFriends && player.isNew) {
    const withFriends = open.filter((c) => c.friends > 0).sort((a, b) => b.friends - a.friends || byLevel(a, b));
    if (withFriends.length) return withFriends[0].id;
  }

  const sameTier = open
    .filter((c) => c.tier === player.tier)
    .sort((a, b) => {
      const smallA = a.members < opts.minGroup ? 0 : 1;
      const smallB = b.members < opts.minGroup ? 0 : 1;
      return smallA - smallB || byLevel(a, b);
    });
  return sameTier[0]?.id ?? null;
}

/**
 * Splits `n` players into the fewest groups of at most `size`, as evenly as possible (31 → 16 + 15, never
 * 30 + 1), so the weekly rollover doesn't leave someone alone. Mirrors private.league_rollover.
 */
export function evenGroupSizes(n: number, size: number): number[] {
  if (n <= 0) return [];
  const groups = Math.ceil(n / size);
  const base = Math.floor(n / groups);
  const extra = n % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < extra ? 1 : 0));
}
