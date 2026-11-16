import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SWITCH, GAMES, GAME_BY_ID, GAME_COUNT, WORLDS, WORLD_COUNT, type GameSwitch } from "@/lib/catalog";
import { aboutCopy } from "@/lib/copy/about";
import { siteCopy } from "@/lib/copy/site";
import { FEATURES, FREE_HINTS_COPY, GAME_CONTROLS, LEAGUES_LINE, featuresFor, siteFaq } from "@/lib/copy/seo";
import { BOT_LEVELS } from "@/lib/bot/types";
import { DEMOTE, LEAGUE_SIZE, PROMOTE } from "@/lib/leagues";
import { BAY_GAMES, BAY_SEATS } from "@/lib/multiplayer/bay";
import { DUEL_ROUNDS, DUEL_TO_WIN } from "@/lib/multiplayer/constants";
import { GHOST_TRACKS, partyBoardGames } from "@/lib/multiplayer/games";
import { videoGame } from "./jsonld";
import { flagsOf, siteFacts, type PublicSwitch } from "./facts";
import { gameFacts } from "./games";
import { llmsFullTxt, llmsTxt } from "./llms";
import { publicTopics, topicPage } from "./topics";

const root = process.cwd();
const sw = (flags: Partial<PublicSwitch> = {}, off: string[] = []): PublicSwitch => ({ ...DEFAULT_SWITCH, "games.off": off, ...flags });
/** Every public text the site serves for a switch: llms.txt, llms-full.txt (FAQ, features, games, guides). */
const allText = (s: PublicSwitch = sw()) => `${llmsTxt(undefined, s)}\n${llmsFullTxt(undefined, s)}`;

describe("numbers the copy states match the code", () => {
  it("free hints: the copy's count is lib/game/service.ts FREE_HINTS", () => {
    const src = readFileSync(join(root, "lib/game/service.ts"), "utf8");
    expect(Number(/export const FREE_HINTS = (\d+);/.exec(src)?.[1])).toBe(FREE_HINTS_COPY);
  });

  it("Duel is best of three", () => {
    expect([DUEL_ROUNDS, DUEL_TO_WIN]).toEqual([3, 2]);
    expect(allText()).toContain("best of three");
  });

  it("Spuzl plays at Easy, Medium or Hard", () => {
    expect([...BOT_LEVELS]).toEqual(["easy", "medium", "hard"]);
    expect(allText()).toContain("Easy, Medium or Hard");
  });

  it("leagues: up to LEAGUE_SIZE players, PROMOTE up and DEMOTE down", () => {
    expect(LEAGUES_LINE).toContain(`up to ${LEAGUE_SIZE}`);
    expect(LEAGUES_LINE).toContain(`Top ${PROMOTE} move up, bottom ${DEMOTE} down`);
    expect(aboutCopy.friends.find(([, t]) => t === "Leagues")![2]).toContain(`up to ${LEAGUE_SIZE}`);
  });

  it("the README states the catalogue count and worlds (a hand-written file, so a test keeps it in step)", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    expect(readme).toMatch(new RegExp(`^${GAME_COUNT} puzzle, word, arcade and classic board games across ${WORLD_COUNT} worlds`, "m"));
    for (const w of WORLDS) expect(readme).toContain(w.name);
    expect(siteCopy.description).toContain(`${WORLD_COUNT} worlds`);
  });
});

describe("nothing retired or renamed is claimed", () => {
  // Retired games and old names (owner, 14 to 16 Nov 2026). Names that are also everyday words (Flip, Equal) are left
  // to the catalog tests.
  const gone = [
    "Higher or Lower",
    "Killer Sums",
    "Light Up",
    "Pixl",
    "Market Run",
    "Pinned",
    "Beat Tap",
    "Penalty King",
    "Gauntlet",
    "Flipside",
    "Ghosted",
    "Sixer",
    "Kente",
    "Rage Ridge",
    "rhythm",
  ];
  const texts: [string, string][] = [
    ["llms", allText()],
    ["about", JSON.stringify(aboutCopy)],
    ["site", JSON.stringify(siteCopy)],
    ["README", readFileSync(join(root, "README.md"), "utf8").split("## Stack")[0]],
    ["topics", JSON.stringify(publicTopics())],
  ];

  it("names no retired game, old name or old party size", () => {
    for (const [where, t] of texts) {
      for (const name of gone) expect(t, `${where}: ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`));
      expect(t, where).not.toMatch(/up to 10\b/);
    }
  });

  it("the Arcade line names every live Arcade game", () => {
    const arcade = FEATURES.find((f) => f.startsWith("Arcade:"))!;
    for (const g of GAMES.filter((x) => x.world === "reflex")) expect(arcade, g.id).toContain(g.name);
  });
});

describe("switches the admin can turn off are only claimed while on", () => {
  it("defaults: Daily Five, score races, Party TV and challenges on; Draw It and Two Truths off", () => {
    expect(flagsOf()).toEqual({
      dailyFive: true,
      scoreRaces: true,
      partyTv: true,
      challenges: true,
      adultParty: false,
      familyDraw: false,
    });
    expect(FEATURES.join(" ")).not.toMatch(/Draw It|Two Truths party/);
  });

  it("all off: no Daily Five, score races, TV view or challenge links anywhere", () => {
    const off = sw({
      "dailyFive.enabled": false,
      "party.scoreRaces": false,
      "features.partyTv": false,
      "features.challenges": false,
    });
    const t = allText(off);
    expect(t).not.toMatch(/Daily Five/);
    expect(t).not.toMatch(/big-screen|on a TV/i);
    expect(t).not.toMatch(/score games/);
    expect(t).not.toMatch(/challenge link|Challenges:/);
    expect(siteFaq(1, 1, "A", siteFacts(off)).map((q) => q.q)).not.toContain("What is the Daily Five?");
    const party = topicPage("party-games", off)!;
    expect(party.games.every((g) => GAME_BY_ID[g.id].scoring === "time")).toBe(true);
    expect(topicPage("quick-games-for-short-breaks", off)!.faq.map((q) => q.q)).not.toContain("What is the Daily Five?");
    for (const g of GAMES.filter((x) => x.scoring === "score")) expect(gameFacts(g, off).modes, g.id).not.toContain("party");
  });

  it("Draw It and Two Truths are claimed once switched on", () => {
    const f = featuresFor(siteFacts(sw({ "features.adultParty": true, "party.familyDraw": true }))).join(" ");
    expect(f).toContain("Draw It with preset words for 16 and over");
    expect(f).toContain("Draw It and Two Truths party modes for 18 and over");
  });

  it("score games race in Party (not Duel) while score races are on", () => {
    const quick = GAME_BY_ID.quickfire;
    expect(gameFacts(quick).modes).toContain("party");
    expect(gameFacts(quick).modes).not.toContain("duel");
    expect(topicPage("party-games")!.games.map((g) => g.id)).toContain("quickfire");
  });
});

describe("board games, Party boards and Ghost Races come from the code", () => {
  it("Party board games: every Board Bay game at 2 players, Ludo at 3 and 4 (partyBoardGames)", () => {
    const groups = siteFacts().partyBoards;
    for (const { players, games } of groups)
      for (const n of players) expect(games).toEqual(partyBoardGames(n, DEFAULT_SWITCH).map((g) => GAME_BY_ID[g].name));
    expect(groups[0]).toEqual({ players: [2], games: BAY_GAMES.map((g) => GAME_BY_ID[g].name) });
    expect(groups[1]).toEqual({ players: [3, 4], games: ["Ludo"] });
    // a board game switched Off leaves the Party and Board Bay lines
    const noChess = siteFacts(sw({}, ["chess"]));
    expect(noChess.bay).not.toContain("Chess");
    expect(noChess.partyBoards[0].games).not.toContain("Chess");
    expect(featuresFor(noChess).join(" ")).not.toMatch(/Chess/);
  });

  it("each Board Bay game page offers its Party seats; Ludo says 4 players in structured data", () => {
    for (const id of BAY_GAMES) {
      const f = gameFacts(GAME_BY_ID[id]);
      expect(f.modes, id).toContain("partyBoard");
      expect(f.maxPlayers, id).toBe(BAY_SEATS[id].max);
    }
    const ludo = videoGame(gameFacts(GAME_BY_ID.ludo)) as { numberOfPlayers: { maxValue: number } };
    expect(ludo.numberOfPlayers.maxValue).toBe(4);
    expect(gameFacts(GAME_BY_ID.dara).modes).not.toContain("partyBoard");
  });

  it("Ghost Races: the live tracks, by name, and their game pages", () => {
    const live = GHOST_TRACKS.filter((g) => GAMES.some((x) => x.id === g));
    expect(siteFacts().ghost).toEqual(live.map((g) => GAME_BY_ID[g].name));
    for (const g of live) expect(gameFacts(GAME_BY_ID[g]).modes).toContain("ghost");
  });

  it("chess names its 1.65.0 controls; every board game has its own controls line", () => {
    for (const g of GAMES.filter((x) => x.world === "board")) expect(GAME_CONTROLS[g.id], g.id).toBeTruthy();
    expect(gameFacts(GAME_BY_ID.chess).controls).toMatch(/drag/);
    expect(gameFacts(GAME_BY_ID.chess).controls).toMatch(/premoves/);
  });

  it("Ludo's free play is a game against Spuzl, so it claims no ranked scoring or practice round", () => {
    const f = gameFacts(GAME_BY_ID.ludo);
    expect(f.scoring).toMatch(/casual/);
    expect(llmsFullTxt()).toContain(`- Scoring: ${f.scoring}`);
  });
});

it("public switches typed for the pages still accept a plain games switch", () => {
  const plain: GameSwitch = DEFAULT_SWITCH;
  expect(siteFacts(plain).flags).toEqual(flagsOf());
});
