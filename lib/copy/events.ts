/** Seasonal event copy (Home banner, Quests; admin setting "features.seasonal"). Event names and banners come from admins. */
export const eventsCopy = {
  bannerAction: "Quest",
  bannerLabel: (name: string) => `${name} event`,
  questHeading: (name: string) => name,
  questBonus: "Event bonus",
  endsIn: (left: string) => `ends in ${left}`,
  endsInAria: (name: string, left: string) => `${name} ends in ${left}`,
} as const;
