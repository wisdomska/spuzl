/**
 * "Play a full game vs bot": casual games against a computer opponent for the Board Bay games (the six
 * launch games plus the lab game Dara, which is only reachable while "features.newGames" is on).
 * Everything runs on the device with the same match rules the server uses for Board Bay; nothing is
 * sent anywhere and nothing is rewarded, so there is nothing for the server to enforce.
 */
import type { Bot } from "./types";

export { BOT_LEVELS, HARD_BUDGET_MS, isBotLevel, type Bot, type BotLevel } from "./types";

export const BOT_GAMES = ["fourup", "draughts", "oware", "flip", "chess", "ludo", "dara"] as const;
export type BotGame = (typeof BOT_GAMES)[number];
export const isBotGame = (g: string): g is BotGame => (BOT_GAMES as readonly string[]).includes(g);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyBot = Bot<any, any>;

/** Each game's bot is its own chunk. */
export async function loadBot(game: BotGame): Promise<AnyBot> {
  switch (game) {
    case "fourup":
      return (await import("./games/fourup")).fourupBot;
    case "draughts":
      return (await import("./games/draughts")).draughtsBot;
    case "oware":
      return (await import("./games/oware")).owareBot;
    case "flip":
      return (await import("./games/flip")).flipBot;
    case "chess":
      return (await import("./games/chess")).chessBot;
    case "ludo":
      return (await import("./games/ludo")).ludoBot;
    case "dara":
      return (await import("./games/dara")).daraBot;
  }
}
