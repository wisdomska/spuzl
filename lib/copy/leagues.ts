/** Leagues copy (SPZ-21 empty and alone states). */
export const leaguesCopy = {
  noGroupTitle: "Clear 1 game to join this week's league",
  noGroupBody: "Leagues are up to 30 Spuzlers. Earn XP all week, the top 7 go up on Monday.",
  playDaily: "Play a game",
  aloneTitle: "Just you so far",
  aloneBody: "Your league fills up as players clear their first game this week.",
  inviteTitle: "Bring a friend",
  inviteWithFriends: "Friends who join from your link play in your league.",
  inviteGeneric: "Race your friends on the Grid and climb together.",
  inviteShare: (url: string) => `Join my SPUZL league. Tap to be friends: ${url}`,
  copy: "Copy link",
  copied: "Copied",
  copiedStatus: "Invite link copied",
  share: "Share",
  inviteAria: "Your invite link",
  /** R2-P5 school and campus league (admin "features.schoolLeagues"): school names and averages, never players */
  school: {
    title: "School league",
    intro: (metric: string) =>
      metric === "sparks"
        ? "Schools and campuses ranked by the average Sparks their players earn this week."
        : "Schools and campuses ranked by the average clears per player this week.",
    yours: (name: string) => `You play for ${name}`,
    rank: (n: number) => `#${n} this week`,
    unranked: "Not on the table yet: it needs a few more active players this week.",
    pick: "Find your school or campus",
    searchLabel: "School or campus name",
    searchPlaceholder: "Type at least 2 letters",
    join: (name: string) => `Join ${name}`,
    joined: (name: string) => `You're in. Go ${name}!`,
    leave: "Leave school",
    noMatch: "No school by that name yet. Ask your teacher or school to get it added.",
    classCode: "Join your school with your teacher's class code.",
    classCodeCta: "Enter a class code",
    changeLater: "You can change your school once a week.",
    empty: "No school is on the table yet this week. Clear a game for yours!",
    head: ["#", "School", "Players", "Average"],
    average: (n: number, metric: string) => (metric === "sparks" ? `${n} Sparks` : `${n} clears`),
    tableLabel: (n: number) => `School league table, ${n} schools`,
    failed: "Couldn't join. Try again.",
  },
} as const;
