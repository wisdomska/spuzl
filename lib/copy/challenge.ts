/** Challenge copy. */
export const challengeCopy = {
  /** Ghost Race opened for a game without one: names the live tracks ("Dash", "Dash and Gauntlet"). */
  ghostTracks: (names: string[]) =>
    `Ghost Races run on ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "Rage Ridge")}.`,
  /** Ghost strip: one clock per game (the header); the strip says how the race stands in words. */
  ahead: "On pace",
  behind: "Past their time",
} as const;
