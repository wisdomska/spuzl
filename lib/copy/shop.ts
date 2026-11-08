/** Shop copy (SPZ-19 starter cosmetic). */
export const shopCopy = {
  starter: "Starter",
  starterHint: "Priced for your first few clears.",
  starterAria: "starter item",
  /** R2-19: on items the player's Sparks cover (short on the tile, full in the accessible name) */
  afford: "Can afford",
  affordAria: "you can afford this",
  /** R3-15: the accessible name of the player's own Spuz (wearing their Shop look) where it isn't decorative */
  yourSpuz: "Your Spuz",
  /** R3-15: another player's Spuz, wearing their look */
  theirSpuz: (nickname: string) => `${nickname}'s Spuz`,
} as const;
