/** Seasonal event copy (Home banner, Quests; admin setting "features.seasonal"). Event names and banners come from admins. */
export const eventsCopy = {
  bannerAction: "Quest",
  bannerLabel: (name: string) => `${name} event`,
  questHeading: (name: string) => name,
  questBonus: "Event bonus",
  endsIn: (left: string) => `ends in ${left}`,
  endsInAria: (name: string, left: string) => `${name} ends in ${left}`,
  /**
   * Ready-made event templates (R2-P5): the name, Home banner (140 characters at most, no dashes) and bonus quest
   * title each template starts with. The admin can edit all of it before scheduling.
   */
  templates: {
    dettyDecember: {
      name: "Detty December",
      banner: "Detty December don land! Clear free games all season and the bonus Sparks are yours. Enjoy, but drink water.",
      quest: "Detty December run: 15 free clears",
      blurb: "15 Dec to 5 Jan. Holiday fun, gold accent, 15 free clears for a big bonus.",
    },
    examSeason: {
      name: "Exam Season",
      banner: "Exam season. Small breaks, calm mind. One clean puzzle, a deep breath, then back to your books. You've got this.",
      quest: "Calm focus: 7 clears, no hints",
      blurb: "1 May to 30 Jun. Calm blue accent, a quiet no-hint quest for short study breaks.",
    },
    afconWeek: {
      name: "AFCON Week",
      banner: "AFCON week! Watch the matches, cheer loud, then clear a quick game at half time. Starting eleven, let's go!",
      quest: "Starting eleven: 11 free clears",
      blurb: "Football green. Set the dates to the tournament week before you schedule it.",
    },
    marchSixth: {
      name: "6 March Quiz",
      banner: "Happy Independence Day, Ghana! Play Quickfire for 6 March history rounds. Freedom and Justice, Ayekoo!",
      quest: "Six for the sixth: 6 Words & Quiz clears",
      blurb: "6 to 7 March. Gold accent, Quickfire plays 20 Ghana history questions while it runs.",
    },
  },
} as const;
