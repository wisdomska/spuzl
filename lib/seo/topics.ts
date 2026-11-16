/**
 * Guides and game lists (/topics/<slug>, /guides/<slug>): which games each page shows and the facts it states, all
 * derived from the code (catalog, Games page state, Board Bay seats and clocks, race eligibility, bots). A game that
 * is retired, In testing or Off never appears, and a page whose games are all gone is not served (404, out of the
 * sitemap and llms.txt). Wording lives in lib/copy/topics.ts.
 */
import { WORLD_BY_ID, versusAllowed, type GameMeta } from "@/lib/catalog";
import type { QA } from "@/lib/copy/seo";
import { durationLabel, defaultMetaFor } from "@/lib/games-meta";
import { isRaceGame, isScoreRaceGame } from "@/lib/multiplayer/games";
import { BAY_GAMES, BAY_SEATS, CLOCK_MINUTES, isBayGame } from "@/lib/multiplayer/bay";
import { PARTY_MAX } from "@/lib/multiplayer/constants";
import {
  TOPIC_LABELS,
  arcadeCopy,
  boardFriendsCopy,
  botCopy,
  ghanaCopy,
  hubCopy,
  listOf,
  logicCopy,
  ludoCopy,
  owareCopy,
  owareVsMancalaCopy,
  partyCopy,
  quizCopy,
  shortBreaksCopy,
  topicsCopy,
  sudokuCopy,
  sudokuSizesCopy,
  twoPlayerCopy,
  wordCopy,
  type TopicLink,
  type TopicSection,
  type TypeCopy,
  type VersusFacts,
} from "@/lib/copy/topics";
import { gamesCopy } from "@/lib/copy/seo";
import { LIVE_ONLY, publicGame, publicGames } from "./games";
import { siteFacts, type PublicSwitch } from "./facts";

export type TopicKind = "topic" | "guide";

export interface TopicPage {
  slug: string;
  kind: TopicKind;
  path: string;
  /** short label for links */
  label: string;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  /** the answer-first intro: one or two sentences an AI answer can quote */
  answer: string;
  sections: TopicSection[];
  /** the games the page is about (ItemList); empty for none */
  games: GameMeta[];
  faq: QA[];
  /** numbered steps for HowTo structured data */
  howTo?: { name: string; steps: readonly (readonly [string, string])[] };
  /** the game a guide is about (VideoGame `about` link) */
  about?: GameMeta;
  cta: { label: string; href: string };
  related: string[];
}

/** List pages, then guides; the order of the /guides index and the sitemap. */
export const TOPIC_SLUGS = [
  "free-puzzle-games-in-browser",
  "logic-puzzles",
  "sudoku-online",
  "word-games",
  "trivia-quiz-games",
  "arcade-games",
  "board-games-online",
  "two-player-games",
  "party-games",
  "games-vs-computer",
] as const;
export const GUIDE_SLUGS = [
  "play-oware-online",
  "made-in-ghana",
  "oware-vs-mancala",
  "sudoku-6x6-vs-9x9",
  "ludo-online-4-players",
  "quick-games-for-short-breaks",
] as const;

export const topicPath = (kind: TopicKind, slug: string) => `/${kind === "topic" ? "topics" : "guides"}/${slug}`;
const kindOfSlug = (slug: string): TopicKind | undefined =>
  (TOPIC_SLUGS as readonly string[]).includes(slug) ? "topic" : (GUIDE_SLUGS as readonly string[]).includes(slug) ? "guide" : undefined;
/** The page path for a slug, wherever it lives. */
export const slugPath = (slug: string) => topicPath(kindOfSlug(slug)!, slug);

/** The game groups the pages are built from (only games that are On). */
export function topicGroups(s: PublicSwitch = LIVE_ONLY) {
  const all = publicGames(s);
  const inWorld = (w: GameMeta["world"]) => all.filter((g) => g.world === w);
  const bay = all.filter((g) => isBayGame(g.id));
  return {
    all,
    logic: inWorld("logic"),
    words: inWorld("word").filter((g) => g.engine === "word"),
    quiz: inWorld("word").filter((g) => g.engine !== "word"),
    arcade: inWorld("reflex"),
    board: inWorld("board"),
    bay,
    races: all.filter((g) => isRaceGame(g.id) && versusAllowed(g.id, s)),
    /** score games a Party can race while score races are on (lib/multiplayer/games scoreRaceGames) */
    scoreRaces: siteFacts(s).flags.scoreRaces ? all.filter((g) => isScoreRaceGame(g.id) && versusAllowed(g.id, s)) : [],
    bots: inWorld("board").filter((g) => g.botPlay),
    bayFour: bay.filter((g) => BAY_SEATS[g.id as (typeof BAY_GAMES)[number]].max >= 4),
    quick: all.filter((g) => defaultMetaFor(g.id).typicalSec <= 120),
  };
}

const minutesList = (xs: readonly number[]) => listOf([...new Set(xs)].sort((a, b) => a - b).map(String)).replace(/ and /, " or ");
const clocksOf = (gs: readonly GameMeta[]) => minutesList(gs.flatMap((g) => (isBayGame(g.id) ? CLOCK_MINUTES[g.id] : [])));
const timeOf = (id: string) => gamesCopy.facts.timeValue(durationLabel(defaultMetaFor(id).typicalSec));

const playCta = (g: GameMeta) => ({ label: gamesCopy.cta(g.name), href: `/play/${g.id}` });
const HUB_CTA = { label: "Play now", href: "/welcome/play" };

type Builder = (s: PublicSwitch) => Omit<TopicPage, "slug" | "kind" | "path" | "label"> | undefined;

function typePage(c: TypeCopy, gs: GameMeta[], related: string[]): ReturnType<Builder> {
  if (!gs.length) return undefined;
  return {
    title: c.title,
    description: c.description(gs),
    h1: c.h1,
    eyebrow: c.eyebrow,
    answer: c.answer(gs),
    sections: [{ id: "games", title: topicsCopy.gamesTitle(gs.length), games: gs }, ...c.sections(gs)],
    games: gs,
    faq: c.faq(gs),
    cta: gs.length === 1 ? playCta(gs[0]) : HUB_CTA,
    related,
  };
}

const versusFacts = (s: PublicSwitch): VersusFacts => {
  const t = topicGroups(s);
  const facts = siteFacts(s);
  return {
    bay: t.bay,
    races: t.races,
    bots: t.bots,
    bayFour: t.bayFour,
    partyMax: PARTY_MAX,
    clocks: clocksOf(t.bay),
    partyGames: [...t.races, ...t.scoreRaces],
    partyBoards: facts.partyBoards,
    flags: facts.flags,
  };
};

const BUILDERS: Record<string, Builder> = {
  "free-puzzle-games-in-browser": (s) => {
    const t = topicGroups(s);
    if (!t.all.length) return undefined;
    const groups = (
      [
        ["logic-puzzles", t.logic],
        ["word-games", t.words],
        ["trivia-quiz-games", t.quiz],
        ["arcade-games", t.arcade],
        ["board-games-online", t.board],
      ] as const
    ).filter(([, gs]) => gs.length);
    return {
      title: hubCopy.title,
      description: hubCopy.description(t.all.length),
      h1: hubCopy.h1,
      eyebrow: hubCopy.eyebrow,
      answer: hubCopy.answer(t.all.length),
      sections: [
        { id: "why", title: hubCopy.whyTitle, points: hubCopy.why },
        ...groups.map(([slug, gs]) => ({
          id: slug,
          title: slug === "board-games-online" ? WORLD_BY_ID.board.name : TOPIC_LABELS[slug],
          games: gs,
          links: [{ href: slugPath(slug), label: `More about ${TOPIC_LABELS[slug].toLowerCase()}` }],
        })),
        { id: "start", title: hubCopy.startTitle, steps: hubCopy.start },
      ],
      games: t.all,
      faq: hubCopy.faq(t.all.length),
      cta: HUB_CTA,
      related: ["quick-games-for-short-breaks", "two-player-games", "made-in-ghana", "play-oware-online"],
    };
  },
  "logic-puzzles": (s) => typePage(logicCopy, topicGroups(s).logic, ["sudoku-online", "free-puzzle-games-in-browser", "word-games"]),
  "sudoku-online": (s) => {
    const six = publicGame("sixer", s);
    const nine = publicGame("nine", s);
    if (!six || !nine) return undefined;
    const raced = topicGroups(s).races.some((g) => g.id === six.id);
    return {
      title: sudokuCopy.title,
      description: sudokuCopy.description,
      h1: sudokuCopy.h1,
      eyebrow: sudokuCopy.eyebrow,
      answer: sudokuCopy.answer,
      sections: [
        { id: "rules", title: sudokuCopy.rulesTitle, points: sudokuCopy.rules },
        {
          id: "features",
          title: sudokuCopy.featuresTitle,
          points: [...sudokuCopy.features(timeOf("sixer"), timeOf("nine")), ...(raced ? [sudokuCopy.friendsLine] : [])],
          games: [six],
        },
      ],
      games: [six],
      faq: sudokuCopy.faq(raced),
      about: six,
      cta: playCta(six),
      related: ["sudoku-6x6-vs-9x9", "logic-puzzles", "quick-games-for-short-breaks"],
    };
  },
  "word-games": (s) => typePage(wordCopy, topicGroups(s).words, ["trivia-quiz-games", "logic-puzzles", "made-in-ghana"]),
  "trivia-quiz-games": (s) => typePage(quizCopy, topicGroups(s).quiz, ["word-games", "party-games", "made-in-ghana"]),
  "arcade-games": (s) => typePage(arcadeCopy, topicGroups(s).arcade, ["quick-games-for-short-breaks", "free-puzzle-games-in-browser"]),
  "board-games-online": (s) => {
    const f = versusFacts(s);
    if (!f.bay.length) return undefined;
    return {
      title: boardFriendsCopy.title,
      description: boardFriendsCopy.description(f),
      h1: boardFriendsCopy.h1,
      eyebrow: boardFriendsCopy.eyebrow,
      answer: boardFriendsCopy.answer(f),
      sections: [
        { id: "games", title: topicsCopy.gamesTitle(f.bay.length), games: [...f.bay] },
        { id: "how", title: boardFriendsCopy.howTitle, steps: boardFriendsCopy.how },
        { id: "ways", title: boardFriendsCopy.waysTitle, points: boardFriendsCopy.ways(f) },
      ],
      games: [...f.bay],
      faq: boardFriendsCopy.faq(f),
      cta: { label: "See the board games", href: `/world/board` },
      related: ["play-oware-online", "ludo-online-4-players", "games-vs-computer", "two-player-games"],
    };
  },
  "two-player-games": (s) => {
    const f = versusFacts(s);
    const n = f.races.length + f.bay.length;
    if (!n) return undefined;
    return {
      title: twoPlayerCopy.title,
      description: twoPlayerCopy.description(n),
      h1: twoPlayerCopy.h1,
      eyebrow: twoPlayerCopy.eyebrow,
      answer: twoPlayerCopy.answer(n),
      sections: [
        ...(f.races.length ? [{ id: "duel", title: twoPlayerCopy.duelTitle, body: [twoPlayerCopy.duel], games: f.races }] : []),
        ...(f.bay.length ? [{ id: "board", title: twoPlayerCopy.boardTitle, body: [twoPlayerCopy.board], games: f.bay }] : []),
      ],
      games: [...f.races, ...f.bay],
      faq: twoPlayerCopy.faq(f),
      cta: HUB_CTA,
      related: ["board-games-online", "party-games", "games-vs-computer"],
    };
  },
  "party-games": (s) => {
    const f = versusFacts(s);
    if (!f.races.length) return undefined;
    return {
      title: partyCopy.title(PARTY_MAX),
      description: partyCopy.description(PARTY_MAX, f.flags.partyTv),
      h1: partyCopy.h1,
      eyebrow: partyCopy.eyebrow,
      answer: partyCopy.answer(PARTY_MAX),
      sections: [
        { id: "how", title: partyCopy.howTitle, steps: partyCopy.how(PARTY_MAX, f) },
        { id: "games", title: topicsCopy.gamesTitle(f.partyGames.length), games: [...f.partyGames] },
        { id: "extras", title: partyCopy.extrasTitle, points: partyCopy.extras(f) },
      ],
      games: [...f.partyGames],
      faq: partyCopy.faq(PARTY_MAX, f),
      cta: { label: "Open a Party room", href: "/party" },
      related: ["two-player-games", "ludo-online-4-players", "trivia-quiz-games"],
    };
  },
  "games-vs-computer": (s) => {
    const f = versusFacts(s);
    if (!f.bots.length) return undefined;
    return {
      title: botCopy.title,
      description: botCopy.description(f),
      h1: botCopy.h1,
      eyebrow: botCopy.eyebrow,
      answer: botCopy.answer(f),
      sections: [
        { id: "games", title: topicsCopy.gamesTitle(f.bots.length), games: [...f.bots] },
        { id: "how", title: botCopy.howTitle, steps: botCopy.how },
      ],
      games: [...f.bots],
      faq: botCopy.faq(f),
      cta: { label: "See the board games", href: `/world/board` },
      related: ["board-games-online", "play-oware-online", "ludo-online-4-players"],
    };
  },
  "play-oware-online": (s) => {
    const g = publicGame("oware", s);
    if (!g) return undefined;
    const c = owareCopy;
    const steps = c.steps;
    return {
      title: c.title,
      description: c.description,
      h1: c.h1,
      eyebrow: c.eyebrow,
      answer: c.answer,
      sections: [
        { id: "what", title: c.whatTitle, body: c.what },
        { id: "how", title: c.howTitle, steps: steps.map(([name, text]) => `${name}. ${text}`) },
        { id: "capture", title: c.captureTitle, body: c.capture },
        { id: "end", title: c.endTitle, points: c.end },
        { id: "tips", title: c.tipsTitle, points: c.tips },
        { id: "play", title: c.playTitle, points: c.play(clocksOf([g]), isBayGame(g.id), !!g.botPlay), games: [g] },
        {
          id: "mancala",
          title: c.mancalaTitle,
          body: c.mancala,
          links: [{ href: slugPath("oware-vs-mancala"), label: "Oware vs mancala" }],
        },
      ],
      games: [g],
      faq: c.faq,
      howTo: { name: c.howToName, steps },
      about: g,
      cta: playCta(g),
      related: ["oware-vs-mancala", "board-games-online", "games-vs-computer", "made-in-ghana"],
    };
  },
  "made-in-ghana": (s) => {
    const c = ghanaCopy;
    const on = (ids: Record<string, string>) =>
      Object.entries(ids).flatMap(([id, line]) => {
        const g = publicGame(id, s);
        return g ? [{ g, line }] : [];
      });
    const games = on(c.games);
    const words = on(c.words);
    const quiz = publicGame("quickfire", s);
    const links = (xs: { g: GameMeta; line: string }[]): TopicLink[] =>
      xs.map(({ g, line }) => ({ href: `/games/${g.id}`, label: g.name, note: line }));
    // Ghanaian games by name (Dara is West African, listed with them but not called Ghanaian)
    const ghanaian = games.filter(({ g }) => g.id !== "dara").map(({ g }) => g.name);
    return {
      title: c.title,
      description: c.description(ghanaian),
      h1: c.h1,
      eyebrow: c.eyebrow,
      answer: c.answer(ghanaian),
      sections: [
        ...(games.length ? [{ id: "games", title: c.gamesTitle, links: links(games) }] : []),
        ...(words.length ? [{ id: "words", title: c.wordsTitle, links: links(words) }] : []),
        ...(quiz ? [{ id: "march", title: c.marchTitle, body: [c.march], links: [{ href: `/games/${quiz.id}`, label: quiz.name }] }] : []),
        { id: "about", title: c.aboutTitle, points: c.about },
      ],
      games: [...games, ...words].map((x) => x.g),
      faq: c.faq(ghanaian),
      cta: HUB_CTA,
      related: ["play-oware-online", "free-puzzle-games-in-browser", "word-games"],
    };
  },
  "oware-vs-mancala": (s) => {
    const g = publicGame("oware", s);
    if (!g) return undefined;
    const c = owareVsMancalaCopy;
    return {
      title: c.title,
      description: c.description,
      h1: c.h1,
      eyebrow: c.eyebrow,
      answer: c.answer,
      sections: [
        { id: "family", title: c.familyTitle, body: c.family },
        { id: "table", title: c.tableTitle, table: c.table },
        {
          id: "play",
          title: c.playTitle,
          body: [c.play],
          games: [g],
          links: [{ href: slugPath("play-oware-online"), label: "How to play oware" }],
        },
      ],
      games: [g],
      faq: c.faq,
      about: g,
      cta: playCta(g),
      related: ["play-oware-online", "board-games-online", "made-in-ghana"],
    };
  },
  "sudoku-6x6-vs-9x9": (s) => {
    const six = publicGame("sixer", s);
    if (!six || !publicGame("nine", s)) return undefined;
    const c = sudokuSizesCopy;
    return {
      title: c.title,
      description: c.description,
      h1: c.h1,
      eyebrow: c.eyebrow,
      answer: c.answer,
      sections: [
        { id: "table", title: c.tableTitle, table: c.table(timeOf("sixer"), timeOf("nine")) },
        { id: "which", title: c.whichTitle, points: c.which, games: [six] },
      ],
      games: [six],
      faq: c.faq,
      about: six,
      cta: playCta(six),
      related: ["sudoku-online", "logic-puzzles", "quick-games-for-short-breaks"],
    };
  },
  "ludo-online-4-players": (s) => {
    const g = publicGame("ludo", s);
    if (!g || !isBayGame(g.id)) return undefined;
    const c = ludoCopy;
    return {
      title: c.title,
      description: c.description,
      h1: c.h1,
      eyebrow: c.eyebrow,
      answer: c.answer,
      sections: [
        { id: "rules", title: c.rulesTitle, body: [g.rule] },
        { id: "ways", title: c.waysTitle, points: c.ways(clocksOf([g])), games: [g] },
        { id: "house", title: c.houseTitle, points: c.house },
      ],
      games: [g],
      faq: c.faq,
      about: g,
      cta: playCta(g),
      related: ["board-games-online", "party-games", "games-vs-computer"],
    };
  },
  "quick-games-for-short-breaks": (s) => {
    const gs = topicGroups(s).quick;
    if (!gs.length) return undefined;
    const c = shortBreaksCopy;
    const daily = siteFacts(s).flags.dailyFive;
    return {
      title: c.title,
      description: c.description(gs.length),
      h1: c.h1,
      eyebrow: c.eyebrow,
      answer: c.answer(gs.length),
      sections: [
        { id: "games", title: topicsCopy.gamesTitle(gs.length), games: gs },
        { id: "why", title: c.whyTitle, points: c.why(daily) },
      ],
      games: gs,
      faq: c.faq(gs.length, daily),
      cta: HUB_CTA,
      related: ["free-puzzle-games-in-browser", "arcade-games", "trivia-quiz-games"],
    };
  },
};

/** One guide or list page, with the games that are On; undefined for an unknown slug or a page with no game left. */
export function topicPage(slug: string, s: PublicSwitch = LIVE_ONLY): TopicPage | undefined {
  const kind = kindOfSlug(slug);
  const b = kind && BUILDERS[slug]?.(s);
  if (!kind || !b) return undefined;
  // Related pages only while they are served too.
  const related = b.related.filter((r) => r !== slug && !!BUILDERS[r]?.(s));
  return { ...b, related, slug, kind, path: topicPath(kind, slug), label: TOPIC_LABELS[slug] };
}

/** Every page served now, list pages first. */
export const publicTopics = (s: PublicSwitch = LIVE_ONLY, kind?: TopicKind): TopicPage[] =>
  [...TOPIC_SLUGS, ...GUIDE_SLUGS].flatMap((slug) => {
    const p = topicPage(slug, s);
    return p && (!kind || p.kind === kind) ? [p] : [];
  });

/** The guides and lists that include a game (its game page links them); the dedicated guide first. */
export function topicsForGame(id: string, s: PublicSwitch = LIVE_ONLY): TopicPage[] {
  const pages = publicTopics(s).filter((p) => p.slug !== "free-puzzle-games-in-browser" && p.games.some((g) => g.id === id));
  return pages.sort((a, b) => Number(b.about?.id === id) - Number(a.about?.id === id));
}

/** The footer's keyword links: the hub, the oware guide and Made in Ghana (only while served). */
export const FOOTER_SLUGS = ["free-puzzle-games-in-browser", "play-oware-online", "made-in-ghana"] as const;
