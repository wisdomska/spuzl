/**
 * Runtime game settings: tunables the admin console can change without a deploy (audit "admin cascade").
 * Each entry has a default, a range and helper text; the server validates every write against this
 * schema, and both the server and the client read values at runtime (never hard-coded copies).
 * Add a setting here, then read it with `getGameSettings()` (server) or `useGameSettings()` (client).
 * Labels and help are written for a non-technical owner: what it does and what players notice, in plain words.
 */
import { DEFAULT_SWITCH, GAMES, type GameSwitch } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-ids";

/** Game settings sections, in page order, each with one line on what it covers. */
export const SETTING_GROUPS = [
  { name: "Features for players", about: "Switch whole features on or off for everyone." },
  { name: "Daily Five", about: "The five quick puzzles everyone gets each day." },
  { name: "Rewards: XP and Sparks", about: "What players earn from playing alone, and the first price in the shop." },
  { name: "Duels and Parties", about: "Playing with friends: countdowns, score games, rewards and who can join." },
  {
    name: "Party games for older players",
    about: "Draw It and Two Truths, which only signed-in players aged 16 or 18 and over can see.",
  },
  { name: "Reminders and notifications", about: "When the app may send reminders, and when it asks players to allow them." },
  { name: "Tips and prompts", about: "Gentle suggestions the app shows players at the right moment." },
  { name: "Practice rounds", about: "The short first try with free hints before a player's first real game." },
  { name: "Leagues", about: "How weekly league groups are made." },
  { name: "Game timing", about: "Small timings inside games. The defaults are tested; change them only to fix a complaint." },
  { name: "Technical", about: "For troubleshooting. Leave these as they are unless a developer asks." },
] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number]["name"];

/** Shared by every kind: an owner-facing name, one short line of help, optional longer "more" text and a section. */
interface SettingText {
  /** Plain name shown to admins. */
  label: string;
  /** One short line: what it does. */
  help: string;
  /** Optional longer detail, folded under "More" on Game settings. */
  more?: string;
  /** Section on Game settings (one of SETTING_GROUPS). */
  group: SettingGroup;
  /**
   * Edited somewhere else, not on Game settings: "games" is the Games page (one switch on each game's row). The key
   * stays the storage and the server validates it the same way.
   */
  editedOn?: "games";
}

export type SettingDef =
  | (SettingText & {
      kind: "int";
      default: number;
      min: number;
      max: number;
      unit?: string;
      /** What a unit-less number counts, in words ("clears", "players"). */
      noun?: string;
    })
  | (SettingText & { kind: "bool"; default: boolean })
  /** A set of switches picked from `options` (any number of them, none included). */
  | (SettingText & {
      kind: "set";
      default: readonly string[];
      options: readonly { id: string; label: string }[];
    })
  /** One of a fixed list of values (shown as a select). */
  | (SettingText & { kind: "enum"; default: string; options: readonly string[] });

const FEATURES = "Features for players";
const FIVE = "Daily Five";
const REWARDS = "Rewards: XP and Sparks";
const PARTY = "Duels and Parties";
const OLDER = "Party games for older players";
const REMIND = "Reminders and notifications";
const TIPS = "Tips and prompts";
const PRACTICE = "Practice rounds";
const LEAGUES = "Leagues";
const TIMING = "Game timing";
const TECH = "Technical";

export const SETTINGS = {
  "features.dailies": {
    kind: "bool",
    group: FEATURES,
    label: "Daily puzzles (one per game)",
    help: "A shared daily puzzle for each game, with leaderboards and an archive of past days.",
    more: "Off: free play is the only way to play alone, every Daily screen and mention is hidden, and the server refuses Daily play.",
    default: false,
  },
  "dailyFive.enabled": {
    kind: "bool",
    group: FIVE,
    label: "Daily Five",
    help: "Five quick puzzles a day, the same for everyone, with a combined score and a grid to share.",
    more: "One game from each world plus a bonus game. Shows the Daily Five card on Home and the Daily Five page. Off: both are hidden and the server refuses Daily Five play.",
    default: true,
  },
  "dailyFive.resetHour": {
    kind: "int",
    group: FIVE,
    label: "New Daily Five starts at",
    help: "The hour, in GMT, when the next day's five opens. 0 is midnight.",
    more: "A clear before this hour counts for the previous day's five. With Daily puzzles on, a game in the five is also that game's Daily until this hour (one puzzle per game a day), and clears made offline are checked against the Daily Five day.",
    default: 0,
    min: 0,
    max: 23,
    unit: "h GMT",
  },
  "dailyFive.difficulty": {
    kind: "enum",
    group: FIVE,
    label: "Difficulty",
    help: "How hard every Daily Five puzzle is. Keep it quick: all five should take about 5 minutes together.",
    more: "Applies to days picked after the change. Locked days keep their puzzles.",
    default: "easy",
    options: ["easy", "medium", "hard"],
  },
  "dailyFive.maxGameSec": {
    kind: "int",
    group: FIVE,
    label: "Longest game it can pick",
    help: "Only games that usually take this long or less are picked automatically.",
    more: "Each game's usual time is on the Games page. A world with no game this quick uses its quickest game.",
    default: 120,
    min: 30,
    max: 600,
    unit: "s",
  },
  "dailyFive.daysAhead": {
    kind: "int",
    group: FIVE,
    label: "Days planned ahead",
    help: "How many days ahead the Daily Five is picked and its puzzles made.",
    more: "Days that were picked automatically and are not locked are picked again when these rules change.",
    default: 14,
    min: 2,
    max: 60,
    unit: "days",
  },
  "dailyFive.world.logic": {
    kind: "bool",
    group: FIVE,
    label: "Include a Puzzles game",
    help: "One game from the Puzzles world each day.",
    more: "Off: a bonus game takes its place, so there are still five.",
    default: true,
  },
  "dailyFive.world.word": {
    kind: "bool",
    group: FIVE,
    label: "Include a Words & Quiz game",
    help: "One game from the Words & Quiz world each day.",
    more: "Off: a bonus game takes its place, so there are still five.",
    default: true,
  },
  "dailyFive.world.reflex": {
    kind: "bool",
    group: FIVE,
    label: "Include an Arcade game",
    help: "One game from the Arcade world each day.",
    more: "Off: a bonus game takes its place, so there are still five.",
    default: true,
  },
  "dailyFive.world.board": {
    kind: "bool",
    group: FIVE,
    label: "Include a Board Games puzzle",
    help: "One board puzzle from the Board Games world each day.",
    more: "Off: a bonus game takes its place, so there are still five.",
    default: true,
  },
  "dailyFive.bonus.logic": {
    kind: "bool",
    group: FIVE,
    label: "Bonus game can be from Puzzles",
    help: "The bonus game takes turns between the worlds switched on here.",
    more: "It is never a game already in that day's five. If all four are off, every world can give the bonus game.",
    default: true,
  },
  "dailyFive.bonus.word": {
    kind: "bool",
    group: FIVE,
    label: "Bonus game can be from Words & Quiz",
    help: "Words & Quiz games can be the bonus game.",
    default: true,
  },
  "dailyFive.bonus.reflex": {
    kind: "bool",
    group: FIVE,
    label: "Bonus game can be from Arcade",
    help: "Arcade games can be the bonus game.",
    default: true,
  },
  "dailyFive.bonus.board": {
    kind: "bool",
    group: FIVE,
    label: "Bonus game can be from Board Games",
    help: "Board puzzles can be the bonus game.",
    default: true,
  },
  "features.statusCards": {
    kind: "bool",
    group: FEATURES,
    label: "Share my status card",
    help: "Lets players share a card from Me with their Spuz, nickname, level, streak, favourite world and rank.",
    more: 'Off: the "Share my status" button is hidden and links to existing cards stop working.',
    default: false,
  },
  "features.challenges": {
    kind: "bool",
    group: FEATURES,
    label: "Friend challenges",
    help: '"Beat my time" links that send a friend the exact puzzle a player just cleared.',
    more: 'The link shows a preview picture (the game, the time, the sender\'s Spuz and "Beat me"), and the friend can "Send it back" from their result. Links last 7 days. Off: the buttons are hidden, new and open challenges are refused, and preview pictures stop.',
    default: true,
  },
  "features.storyCards": {
    kind: "bool",
    group: FEATURES,
    label: "Story cards for sharing",
    help: "Sharing a clear makes a tall picture sized for WhatsApp Status and Instagram stories.",
    more: 'The picture shows Spuz in the player\'s hat, the time, hints and slips, and "Beat me" with a short challenge link to the same puzzle. Needs Friend challenges on. Off: sharing uses the older Daily cards.',
    default: true,
  },
  "features.partyTv": {
    kind: "bool",
    group: PARTY,
    label: "Party on a big screen",
    help: "A watch-only page of a Party room for a classroom projector or a TV.",
    more: "Anyone with the room code can watch nicknames, progress and scores; there is no chat and no way to play. The host turns it on or off for each room (on by default for classroom rooms, off otherwise, never for a host under 16). Off: the page is refused for every room.",
    default: true,
  },
  "features.streakShield": {
    kind: "bool",
    group: FEATURES,
    label: "Free streak shield for signing in",
    help: "A guest who saves their account with an email or Google gets one free Streak Freeze.",
    more: 'Once per account, and none if they already hold 2. The "Save your streak" prompt says so ("Sign in and get a free streak shield"). Each one given shows in the Activity log. Off: no shield is given and the prompt keeps its plain wording.',
    default: true,
  },
  "features.seasonal": {
    kind: "bool",
    group: FEATURES,
    label: "Seasonal events",
    help: "Runs the events planned on the Events page: a small Home banner and a bonus quest while an event is live.",
    more: "The bonus quest counts free-play clears, and an event can feature a Quickfire quiz set. With no live event (or only drafts) players see nothing. Off: players see no event and no event quest is counted or paid.",
    default: true,
  },
  "features.adultParty": {
    kind: "bool",
    group: OLDER,
    label: "Draw It and Two Truths for 18+",
    help: "Adds Draw It and Two Truths to Party for signed-in players aged 18 and over.",
    more: "Players type and draw freely, so every line goes through the word filter and has a Report button (Reports page, Party content tab). Off: the games are hidden from everyone and the server refuses them, including in rooms already open.",
    default: false,
  },
  "party.familyDraw": {
    kind: "bool",
    group: OLDER,
    label: "Draw It for 16+ (safe word list, no typing)",
    help: "Adds a family-safe Draw It to Party for signed-in players aged 16 and over.",
    more: "Words come from a safe list (preview and export it on the Content page) and players guess by picking one of four words, so nobody types. Drawings still have a Report button, and an upheld report keeps the drawer out of drawing rooms. Under-16s never see it. It uses the same timings and rewards as the 18+ games. Off: hidden from everyone and refused by the server, including in rooms already open.",
    default: false,
  },
  "adultParty.drawSec": {
    kind: "int",
    group: OLDER,
    label: "Draw It: time to draw",
    help: "How long the drawer has to draw, and the others to guess, each round.",
    default: 80,
    min: 30,
    max: 180,
    unit: "s",
  },
  "adultParty.writeSec": {
    kind: "int",
    group: OLDER,
    label: "Two Truths: time to write",
    help: "How long a player has to write their three statements. If time runs out, their turn is skipped.",
    default: 75,
    min: 30,
    max: 180,
    unit: "s",
  },
  "adultParty.voteSec": {
    kind: "int",
    group: OLDER,
    label: "Two Truths: time to vote",
    help: "How long everyone else has to pick the lie.",
    default: 30,
    min: 10,
    max: 120,
    unit: "s",
  },
  "adultParty.revealSec": {
    kind: "int",
    group: OLDER,
    label: "Answer stays on screen for",
    help: "How long the word or the lie is shown before the next round.",
    default: 7,
    min: 3,
    max: 30,
    unit: "s",
  },
  "adultParty.blockDays": {
    kind: "int",
    group: OLDER,
    label: "Keep a reported player out for",
    help: "When a report about party content is upheld, the reported player cannot join these rooms for this long.",
    default: 7,
    min: 1,
    max: 90,
    unit: "days",
  },
  "adultParty.xpPerRound": {
    kind: "int",
    group: OLDER,
    label: "XP for each round played",
    help: "XP for each round a player took part in (drew, wrote, guessed or voted), paid when the room finishes.",
    more: "Only players still in the room at the end, in rooms of 3 or more, until the daily limit below.",
    default: 5,
    min: 0,
    max: 50,
    unit: "XP",
  },
  "adultParty.sparksPerRound": {
    kind: "int",
    group: OLDER,
    label: "Sparks for each round played",
    help: "Sparks for each round a player took part in, paid with the XP while they are under the daily limit.",
    default: 1,
    min: 0,
    max: 20,
    unit: "Sparks",
  },
  "adultParty.winXp": {
    kind: "int",
    group: OLDER,
    label: "Winner's extra XP",
    help: "Extra XP for the room's winner. A tie gives it to everyone sharing first place.",
    default: 20,
    min: 0,
    max: 200,
    unit: "XP",
  },
  "adultParty.winSparks": {
    kind: "int",
    group: OLDER,
    label: "Winner's extra Sparks",
    help: "Extra Sparks for the room's winner.",
    default: 5,
    min: 0,
    max: 100,
    unit: "Sparks",
  },
  "adultParty.xpDailyCap": {
    kind: "int",
    group: OLDER,
    label: "Most XP a day from these games",
    help: "The most XP a player can earn from these party games in one day (GMT).",
    more: "The room that reaches the limit pays what is left; after that, rooms pay no XP or Sparks until the next day.",
    default: 150,
    min: 0,
    max: 2000,
    unit: "XP",
  },
  "hints.dailyXpKeptPct": {
    kind: "int",
    group: REWARDS,
    label: "Daily XP kept after using a hint",
    help: "The share of a Daily's XP a player keeps if they used at least one hint. 50% halves it.",
    default: 50,
    min: 0,
    max: 100,
    unit: "%",
  },
  "play.solvedHoldMs": {
    kind: "int",
    group: TIMING,
    label: "Pause on the solved board",
    help: "How long the finished board stays on screen, highlighted, before the results appear.",
    default: 1000,
    min: 300,
    max: 3000,
    unit: "ms",
  },
  "duel.roundResultMs": {
    kind: "int",
    group: PARTY,
    label: "Duel: round result shown for",
    help: "How long the round result shows before the next round's countdown.",
    default: 2000,
    min: 1000,
    max: 5000,
    unit: "ms",
  },
  "party.countdownSeconds": {
    kind: "int",
    group: PARTY,
    label: "Countdown before each round",
    help: "The number every Duel round and Party game counts down from before SPUZL! (3 means 3, 2, 1).",
    more: "Each number shows for 0.8 seconds, then SPUZL! for 1.6 seconds. Boards stay frozen until the round starts and the server refuses moves sent before then. Party rounds start half a second after the countdown so slow phones see all of it.",
    default: 3,
    min: 2,
    max: 5,
  },
  "party.scoreRaces": {
    kind: "bool",
    group: PARTY,
    label: "Score games in Party",
    help: "Lets hosts pick score games such as Quickfire and Emoji Hits in a Party. Most points wins.",
    more: "Everyone plays the same round; a tie goes to the faster finish. Answers are checked on the server, as in solo play. Only all-ages games that are safe for light-sensitive players, and games in testing only while they are switched on. Never in Duels. Off: score games leave the list and the server refuses them, including in rooms already open (their next Start fails).",
    default: true,
  },
  "party.scoreRaceSeconds": {
    kind: "int",
    group: PARTY,
    label: "Score game time limit",
    help: "The longest a score game in a Party can run.",
    more: "The round ends when everyone has finished or at this limit; anyone still playing is scored on what they had done. Most score games end on their own well within 3 minutes.",
    default: 180,
    min: 60,
    max: 600,
    unit: "s",
  },
  "party.winXp": {
    kind: "int",
    group: PARTY,
    label: "Party winner XP",
    help: "XP for the winner of a Party set. Counts toward the daily Party limit.",
    default: 30,
    min: 0,
    max: 200,
    unit: "XP",
  },
  "party.playXp": {
    kind: "int",
    group: PARTY,
    label: "Party player XP",
    help: "XP for everyone else still in the room when a Party set ends. Counts toward the daily Party limit.",
    default: 10,
    min: 0,
    max: 100,
    unit: "XP",
  },
  "party.xpDailyCap": {
    kind: "int",
    group: PARTY,
    label: "Most Party XP a day",
    help: "The most XP a player can earn from Party in one day (GMT).",
    more: "The set that reaches it pays what is left; after that, Party sets pay no XP until the next day (quests and badges still count). The 16+ and 18+ party games have their own limit.",
    default: 150,
    min: 0,
    max: 2000,
    unit: "XP",
  },
  "rooms.under16FriendsOnly": {
    kind: "bool",
    group: PARTY,
    label: "Younger hosts (13 to 15): friends only",
    help: "Party rooms and friend Duels hosted by a 13 to 15 year old only let in the host's friends.",
    more: "Anyone else gets a clear message and can ask to join; the host approves or declines in the lobby (listed on Join requests). Board Bay invite codes from a 13 to 15 year old let in only their friends, with no asking step. Off: anyone with the code can join, as for older hosts. The server checks every join.",
    default: true,
  },
  "quickfire.autoAdvanceMs": {
    kind: "int",
    group: TIMING,
    label: "Quickfire: pause between questions",
    help: "How long after an answer before the next question appears.",
    default: 1500,
    min: 800,
    max: 4000,
    unit: "ms",
  },
  "flinch.autoStartMs": {
    kind: "int",
    group: TIMING,
    label: "Flinch: pause between rounds",
    help: "How long before the next Flinch round starts on its own. Players can tap to skip it.",
    default: 1500,
    min: 800,
    max: 4000,
    unit: "ms",
  },
  "dusk.doubleTapMs": {
    kind: "int",
    group: TIMING,
    label: "Dusk: double-tap speed",
    help: "Two taps on one Dusk square closer together than this count as a double-tap (a moon).",
    more: "The square is judged once this time has passed.",
    default: 320,
    min: 200,
    max: 700,
    unit: "ms",
  },
  "perf.prefetch": {
    kind: "bool",
    group: TECH,
    label: "Load the next screen early",
    help: "Loads the next game and results screens in the background, so they open faster. Leave it on.",
    more: "Switch it off only when a developer asks, to track down a problem.",
    default: true,
  },
  "shop.starterPrice": {
    kind: "int",
    group: REWARDS,
    label: "Starter hat price",
    help: "The price of the starter hat in the shop: the first thing a new player can afford.",
    default: 100,
    min: 0,
    max: 1000,
    unit: "Sparks",
  },
  "free.xpPerClear": {
    kind: "int",
    group: REWARDS,
    label: "XP for each free-play clear",
    help: "XP for each free-play board cleared, until the daily limit below. Replaying the same board earns nothing.",
    default: 10,
    min: 0,
    max: 100,
    unit: "XP",
  },
  "free.sparksPerClear": {
    kind: "int",
    group: REWARDS,
    label: "Sparks for each free-play clear",
    help: "Sparks for each free-play board cleared, while the player is under the daily limit.",
    default: 5,
    min: 0,
    max: 50,
    unit: "Sparks",
  },
  "free.xpDailyCap": {
    kind: "int",
    group: REWARDS,
    label: "Most free-play XP a day",
    help: "The most XP a player can earn from free play in one day (GMT). After that, clears give no XP or Sparks until the next day.",
    default: 300,
    min: 0,
    max: 5000,
    unit: "XP",
  },
  "guest.signInPromptAfterClears": {
    kind: "int",
    group: TIPS,
    label: "Ask guests to save their account after",
    help: "After this many clears a guest sees “Save your streak” with one-tap sign-in. 0 turns it off.",
    default: 3,
    min: 0,
    max: 50,
    noun: "clears",
  },
  "prompts.alertsTriggers": {
    kind: "set",
    group: REMIND,
    label: "When to ask about notifications",
    help: "The moments that earn the “Know when it's your turn” question.",
    more: "It never shows out of the blue, on Home or during play. None ticked: it never shows (players can still switch alerts on in their Settings).",
    default: ["friend", "invite", "streak"],
    options: [
      { id: "friend", label: "First friend added" },
      { id: "invite", label: "First Duel or Party invite, sent or received" },
      { id: "streak", label: "Streak reached (days below)" },
    ],
  },
  "prompts.alertsCooldownDays": {
    kind: "int",
    group: REMIND,
    label: "Wait before asking again",
    help: "After the notification question has shown, it waits at least this long before it can show again, and then only after a new moment.",
    default: 7,
    min: 1,
    max: 30,
    unit: "days",
  },
  "prompts.alertsStreakDays": {
    kind: "int",
    group: REMIND,
    label: "Streak that earns the question",
    help: "The streak length that earns the notification question, while that moment is ticked above.",
    default: 3,
    min: 2,
    max: 14,
    unit: "days",
  },
  "prompts.lowDataThresholdMs": {
    kind: "int",
    group: TIPS,
    label: "Low-data tip: a load is slow after",
    help: "A screen that takes longer than this to load counts as slow.",
    more: "Measured on the first page load, on a tap to the next screen and on a tap to a playable board.",
    default: 4000,
    min: 2000,
    max: 15000,
    unit: "ms",
  },
  "prompts.lowDataSlowLoads": {
    kind: "int",
    group: TIPS,
    label: "Low-data tip: slow loads in a row",
    help: "How many slow loads in a row before the app suggests low-data mode (at most once a visit).",
    more: "On a connection the phone rates as 2G or 3G, one slow load is enough.",
    default: 2,
    min: 1,
    max: 5,
    noun: "slow loads",
  },
  "weeklyRecap.enabled": {
    kind: "bool",
    group: FEATURES,
    label: "Weekly recap",
    help: "A card on a player's first Home visit of the week that sums up their last week.",
    more: "It shows games cleared, best time, streak, league result and Sparks earned, with Share and Play today's Daily. Once a week from Monday (GMT), it can be closed, and it never shows during play or next to another prompt. Off: the card and its share picture are hidden.",
    default: true,
  },
  "streakNudge.enabled": {
    kind: "bool",
    group: REMIND,
    label: "Streak reminder",
    help: "An evening notification to players whose streak ends at midnight because they haven't played today.",
    more: "“Your 12-day streak ends at midnight. One quick game keeps it.” At most once a day, never in quiet hours, never to banned or test players, and only to players with alerts and Streak reminders switched on. Off: no reminders are sent.",
    default: true,
  },
  "streakNudge.hour": {
    kind: "int",
    group: REMIND,
    label: "Streak reminder: send at",
    help: "The player's local time the reminder goes out (GMT when we don't know their country).",
    more: "If a run is missed, it can still send in the next hour. Keep it before quiet hours start, or nobody gets it.",
    default: 19,
    min: 12,
    max: 22,
    unit: "h local",
  },
  "streakNudge.minStreak": {
    kind: "int",
    group: REMIND,
    label: "Streak reminder: shortest streak",
    help: "Only streaks of at least this many days get a reminder.",
    default: 2,
    min: 2,
    max: 30,
    unit: "days",
  },
  "alerts.quietStart": {
    kind: "int",
    group: REMIND,
    label: "Quiet hours start",
    help: "No reminder notifications from this local time. Invites and your-turn alerts from friends still arrive.",
    more: "Set it the same as the end time for no quiet hours.",
    default: 22,
    min: 0,
    max: 23,
    unit: "h local",
  },
  "alerts.quietEnd": {
    kind: "int",
    group: REMIND,
    label: "Quiet hours end",
    help: "Reminder notifications may go out again from this local time.",
    default: 8,
    min: 0,
    max: 23,
    unit: "h local",
  },
  "alerts.quietStartUnder16": {
    kind: "int",
    group: REMIND,
    label: "Quiet hours start for 13 to 15 year olds",
    help: "Younger players' quiet hours start at this local time instead, when it is earlier.",
    default: 21,
    min: 0,
    max: 23,
    unit: "h local",
  },
  "practice.disabled": {
    kind: "set",
    group: PRACTICE,
    label: "Games that skip the practice round",
    help: "A game switched on here skips the short first try with free hints, everywhere.",
    editedOn: "games",
    more: "From every way in: Continue, the Games list, links, the Daily Five, levels and vs the bot. It also skips the How it works card in Duels and Parties, and the server stops serving its practice boards. None switched on: every game has its practice round.",
    default: [] as readonly string[],
    options: GAMES.filter((g) => hasLogic(g.id)).map((g) => ({ id: g.id, label: g.name })),
  },
  "leagues.fillWithFriends": {
    kind: "bool",
    group: LEAGUES,
    label: "Put new players with their friends",
    help: "New players join a league with their friends first, then with players near their level.",
    default: true,
  },
  "leagues.minGroup": {
    kind: "int",
    group: LEAGUES,
    label: "Smallest league",
    help: "A league with fewer players than this is topped up with players of a similar level before the week starts.",
    default: 8,
    min: 2,
    max: 30,
    noun: "players",
  },
} as const satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTINGS;
/**
 * The settings every reader gets: the stored tunables over their defaults, plus the games' runtime switch (On, In
 * testing, Off and the Duels and Parties opt-out: GameSwitch in lib/catalog.ts). The switch is not a setting key: the
 * server reads it from the `games` table (getGameSettings) and the Games page changes it.
 */
export type GameSettings = SchemaSettings & GameSwitch;
type SchemaSettings = {
  [K in SettingKey]: (typeof SETTINGS)[K]["default"] extends boolean
    ? boolean
    : (typeof SETTINGS)[K]["default"] extends readonly string[]
      ? readonly string[]
      : (typeof SETTINGS)[K]["default"] extends string
        ? string
        : number;
};
export type SettingValue = number | boolean | string | readonly string[];

export const DEFAULTS = {
  ...Object.fromEntries(Object.entries(SETTINGS).map(([k, d]) => [k, d.default])),
  ...DEFAULT_SWITCH,
} as unknown as GameSettings;

/** Longest list a multi-pick (set) setting can hold through the admin API: at least every option of every set. */
export const SETTING_LIST_MAX = 100;

export const isSettingKey = (k: string): k is SettingKey => k in SETTINGS;

/** Validates one value against its definition; returns an error message or null. */
export function validateSetting(key: string, value: unknown): string | null {
  if (!isSettingKey(key)) return "Unknown setting";
  const d: SettingDef = SETTINGS[key];
  if (d.kind === "bool") return typeof value === "boolean" ? null : "Must be on or off";
  if (d.kind === "set") {
    const ids = d.options.map((o) => o.id);
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string" && ids.includes(v)))
      return `Must be a list of: ${ids.join(", ")}`;
    return new Set(value).size === value.length ? null : "Each option at most once";
  }
  if (d.kind === "enum") return typeof value === "string" && d.options.includes(value) ? null : `Must be one of: ${d.options.join(", ")}`;
  if (typeof value !== "number" || !Number.isInteger(value)) return "Must be a whole number";
  if (value < d.min || value > d.max) return `Must be between ${d.min} and ${d.max}${d.unit ? ` ${d.unit}` : ""}`;
  return null;
}

/** Equal setting values (a set compares as a set, in any order). */
export function sameSetting(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x) => b.includes(x));
  return a === b;
}

/** Stored rows over the defaults; invalid or unknown stored values fall back to the default. */
export function mergeSettings(rows: { key: string; value: unknown }[]): GameSettings {
  const out: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) if (isSettingKey(r.key) && validateSetting(r.key, r.value) === null) out[r.key] = r.value;
  return out as unknown as GameSettings;
}
