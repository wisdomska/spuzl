/** Party Race copy (SPZ-13): Host and Join tabs, and the game-first Challenge sheet. */
export const partyCopy = {
  title: "Party",
  back: "Back",
  tabs: { label: "Host or join a party", host: "Host", join: "Join" },
  host: {
    game: "Game",
    randomMix: "Random mix",
    randomMixHint: "A different game each round",
    pickSeveral: "Pick several games",
    pickSeveralHint: (rounds: number) => `${rounds} rounds from the games you pick`,
    picked: (n: number, max: number) => `${n} of ${max} picked`,
    pickMore: (min: number) => `Pick at least ${min} games`,
    yourGames: "Your games",
    gamesLine: (games: string, rounds: number) => `${games}, ${rounds} games`,
    worlds: "Filter games by world",
    gameCount: (n: number) => (n === 1 ? "1 game" : `${n} games`),
    difficulty: "Difficulty",
    players: "Players",
    playersValue: (n: number) => `Up to ${n}`,
    playersExact: (n: number) => `${n} players`,
    boards: "Board games",
    boardsHint: (n: number) => `Board games for ${n} players. Opens a live game with a code to share.`,
    openBoard: (game: string, n: number) => `Open ${game} for ${n}`,
    classroom: "Party mode",
    classroomHint: "Show the race on a big screen. You host, you don't play.",
    open: "Open room",
    failed: "Couldn't open a room. Try again.",
  },
  join: {
    heading: "Got a room code?",
    body: "The 4-character code on the host's screen.",
    label: "Room code",
    placeholder: "ABCD",
    cta: "Join room",
    badCode: "Codes are 4 letters and numbers, no 0, O, 1 or I.",
  },
  challenge: {
    /** the action on a game card (World view) */
    cta: "Challenge",
    ctaAria: (game: string) => `Challenge someone to ${game}`,
    /** on results and the free-play end bar, where "Challenge a friend" (beat my time) already sits */
    live: "Race live",
    title: (game: string) => `Race ${game}`,
    body: "Same puzzle, same clock.",
    friend: "Duel a friend",
    friendHint: "Send a link. Best of 3, unranked.",
    quick: "Quick Match",
    quickHint: "Ranked. We find you a rival.",
    /** R3-06: 13 to 15 year olds are paired with players their age only */
    quickHintTeen: "Ranked. We find you a rival aged 13 to 15.",
    party: "Host a party",
    partyHint: "2 to 8 players race with a room code.",
    /** R4-08: score games (Quickfire, Echo, Beat Tap, ...) race in Party only, on points */
    scoreBody: "Same round for everyone. Most points wins, then the faster finish.",
    partyHintScore: "2 to 8 players with a room code. Most points wins.",
    close: "Close",
    beat: "Beat my time",
    beatHint: "They race your time on this puzzle.",
  },
  /** R3-01: the lobby's Start and who is still getting ready */
  lobby: {
    start: "Start",
    readyCount: (ready: number, of: number) => `${ready} of ${of} ready`,
    shareCode: "Share the code",
    waitingClass: "Waiting for everyone",
    waitingFor: (names: string[], more: number) => {
      const list = more > 0 ? [...names, `${more} more`] : names;
      const line = list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
      return `Waiting for ${line}`;
    },
    startWithout: "Start without them",
    startWithoutHint: "They join the next set.",
    /** server refusals */
    notReady: (name: string) => `${name} is still getting ready.`,
    needReady: "Two ready Spuzlers make a race.",
    needPlayers: "Two Spuzlers make a race. Share the code.",
    /** a player the host started without */
    satOut: "Started without you. You're in the next set.",
  },
  /** R3-08: score races (score games in a Party: most points wins, then the faster finish) */
  scoreRace: {
    badge: "Points",
    tileLabel: (game: string) => `${game}, most points wins`,
    rule: "Most points wins",
    finished: (name: string) => `${name} finished.`,
    countdown: (game: number, of: number) => `Game ${game} of ${of}. Same round for everyone. Most points wins!`,
    roundScore: (n: number) => (n === 1 ? "1 point" : `${n} points`),
  },
  /** the race rail in rooms bigger than five */
  race: {
    showAll: (n: number) => `Show all ${n}`,
    showFewer: "Show fewer",
    moreHidden: (n: number) => (n === 1 ? "1 more player hidden." : `${n} more players hidden.`),
  },
  /** the round-start countdown (Duel's 3-2-1-SPUZL!) over the board */
  countdown: {
    line: (game: number, of: number) => `Game ${game} of ${of}. Same puzzle for everyone. Go!`,
  },
  /** results after each game and after the set (podium, lists, rail) */
  results: {
    you: "You",
    someone: "Someone",
    theHost: "the host",
    youWin: "You take it!",
    theyWin: (name: string) => `${name} takes it`,
    standings: "Standings",
    rest: "Everyone else",
    placeLine: (place: number, name: string, points: number) => `${place}. ${name}, ${points} points`,
    nextGame: (game: number, of: number) => `Next game (${game} of ${of})`,
    runItBack: "Run it back",
    leave: "Leave",
    waitingNext: (host: string, game: number, of: number) => `Waiting for ${host} to start game ${game} of ${of}`,
    waitingRunItBack: (host: string) => `Waiting for ${host} to run it back`,
  },
  /** the podium's reward line (shown when the server says what you were paid) */
  podium: {
    reward: "You earned",
    xp: (n: number) => `+${n} XP`,
    sparks: (n: number) => `+${n} Sparks`,
    capped: "Daily XP limit reached. Back tomorrow.",
  },
  /** big-screen spectator view (R2-P5, /party/<code>/tv, admin "features.partyTv") */
  tv: {
    pageTitle: "Party on the big screen",
    loading: "Finding the room…",
    closedTitle: "This room isn't on the big screen",
    closedBody: "Ask the host to turn on Big-screen view. This page fills in by itself.",
    missingTitle: (code: string) => `No room called ${code}`,
    missingBody: "Codes expire 2 h after everyone leaves. Check the host's phone.",
    offTitle: "Big-screen view is resting",
    offBody: "Off for now. Phones can still race.",
    retrying: "Checking again every few seconds.",
    /** host switch in Room settings */
    switchLabel: "Big-screen view",
    switchHelp: "Anyone with the code can watch: nicknames and scores, no chat.",
    switchUnder16: "Opens for hosts 16 and over.",
    openLink: "Open big-screen view",
    linkLabel: (url: string) => `Watch at ${url}`,
    saved: (on: boolean) => (on ? "Big-screen view is on." : "Big-screen view is off."),
    failed: "Couldn't change it. Try again.",
  },
} as const;
