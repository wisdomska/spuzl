import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { BOT_GAMES, BOT_LEVELS, HARD_BUDGET_MS, loadBot, type AnyBot, type BotLevel } from "./index";
import { fourupBot, evaluateFourUp } from "./games/fourup";
import { chessBot, chessSearch } from "./games/chess";
import { legalMoves, make, parseFen, positionKey, uci } from "@/games/chess/engine";
import { draughtsBot } from "./games/draughts";
import { owareBot } from "./games/oware";
import { flipBot, evaluateFlip } from "./games/flip";
import { place } from "@/games/flip/engine";
import { ludoBot, ludoHardScore } from "./games/ludo";
import { daraBot, evaluateDara } from "./games/dara";
import { initialMatch } from "@/games/chess/rules";
import { emptyGrid, COLS } from "@/games/fourup/engine";
import { searchBest, type SearchGame } from "./search";

const MAX_PLIES: Record<string, number> = { fourup: 42, flip: 70, draughts: 400, oware: 600, chess: 400, ludo: 3000, dara: 2000 };

/** Plays a whole game between two bots and checks every move against the rules. */
function selfPlay(bot: AnyBot, levels: [BotLevel, BotLevel], seed: string, budgetMs = 5) {
  const rng = createRng(seed);
  const rules = bot.rules;
  let s = rules.initial(2, rng);
  let plies = 0;
  while (!rules.status(s).over && plies < MAX_PLIES[rules.id]) {
    const seat = rules.turn(s);
    const m = bot.choose(s, seat, levels[seat], rng, budgetMs);
    expect(rules.isLegal(s, seat, m)).toBe(true);
    s = rules.apply(s, seat, m, rng);
    plies++;
  }
  return { status: rules.status(s), plies, state: s };
}

describe("vs bot: every game, every level", () => {
  for (const game of BOT_GAMES)
    for (const level of BOT_LEVELS)
      it(`${game} ${level} only plays legal moves and the game ends`, async () => {
        const bot = await loadBot(game);
        const r = selfPlay(bot, [level, level === "easy" ? "medium" : "easy"], `${game}:${level}`);
        // Chess between weak bots can wander; every other game is bounded by its own rules.
        if (game !== "chess") expect(r.status.over).toBe(true);
        if (r.status.over && r.status.winner !== null) expect([0, 1]).toContain(r.status.winner);
      }, 60_000);
});

describe("hard bot answers inside the phone budget", () => {
  for (const game of BOT_GAMES)
    it(`${game}: opening move under 300 ms`, async () => {
      const bot = await loadBot(game);
      const rng = createRng("budget");
      const s = bot.rules.initial(2, rng);
      const seat = bot.rules.turn(s);
      const t = performance.now();
      const m = bot.choose(s, seat, "hard", rng);
      expect(performance.now() - t).toBeLessThan(300);
      expect(bot.rules.isLegal(s, seat, m)).toBe(true);
    });
  it("uses the default budget", () => expect(HARD_BUDGET_MS).toBeLessThan(300));
});

describe("hard bot tactics", () => {
  it("Four Up: wins at once, otherwise blocks", () => {
    const g = emptyGrid();
    // seat 1 (ring) has three in the bottom row at columns 0..2; seat 0 has three stacked in column 6
    for (const c of [0, 1, 2]) g[5 * COLS + c] = 2;
    for (const r of [5, 4, 3]) g[r * COLS + 6] = 1;
    const s = { grid: g, moves: [0, 6, 1, 6, 2, 6] }; // six moves played: seat 0 to move
    expect(fourupBot.choose(s, 0, "hard", createRng("w"))).toBe(6);
    g[2 * COLS + 6] = 2; // column 6 blocked, now seat 0 must stop the ring row
    const s2 = { grid: g, moves: [0, 6, 1, 6, 2, 6, 6, 5] };
    expect(fourupBot.choose({ ...s2, moves: s2.moves.slice(0, 6) }, 0, "hard", createRng("b"))).toBe(3);
  });

  it("Four Up evaluation favours open threes", () => {
    const g = emptyGrid();
    for (const c of [1, 2, 3]) g[5 * COLS + c] = 1;
    expect(evaluateFourUp(g, 0)).toBeGreaterThan(evaluateFourUp(g, 1));
  });

  it("Chess: finds a back-rank mate in one", () => {
    const s = initialMatch("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    expect(chessBot.choose(s, 0, "hard", createRng("m"))).toBe("a1a8");
  });

  it("Chess: takes a hanging queen and does not hang its own", () => {
    const s = initialMatch("4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1");
    expect(chessBot.choose(s, 0, "hard", createRng("q"))).toBe("d2d5");
  });

  it("Chess: castling, en passant and promotion come through as legal moves", () => {
    const rng = createRng("r");
    for (const fen of ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "8/P3k3/8/8/8/8/8/4K3 w - - 0 1"]) {
      const s = initialMatch(fen);
      const m = chessBot.choose(s, 0, "hard", rng, 50);
      expect(chessBot.rules.isLegal(s, 0, m)).toBe(true);
    }
    expect(chessBot.choose(initialMatch("8/P3k3/8/8/8/8/8/4K3 w - - 0 1"), 0, "hard", rng, 50)).toBe("a7a8q");
  });

  it("Chess: treats a threefold repetition as a draw", () => {
    // Seen twice already: the position after `move` from `fen`.
    const twice = (fen: string, move: string) => {
      const p = parseFen(fen);
      const k = positionKey(
        make(
          p,
          legalMoves(p).find((m) => uci(m) === move)!,
        ),
      );
      return { fen, keys: [k, k, positionKey(p)], sans: [] };
    };
    // A queen down, the bot heads for the repetition: a draw beats a lost game.
    const losing = twice("4k3/8/8/8/8/8/8/K6Q b - - 0 1", "e8d8");
    expect(chessBot.choose(losing, 1, "hard", createRng("rep"))).toBe("e8d8");
    const pos = parseFen(losing.fen);
    const opts = { budgetMs: 200, maxDepth: 3, rng: createRng("rep") };
    expect(searchBest(chessSearch, pos, 1, { ...opts, history: losing.keys }).score).toBe(0);
    expect(searchBest(chessSearch, pos, 1, opts).score).toBeLessThan(-500);
    // A queen up, it never drifts into the same repetition.
    const winning = twice("4k3/8/8/8/8/8/8/K6Q w - - 0 1", "h1h2");
    for (const seed of ["a", "b", "c"]) expect(chessBot.choose(winning, 0, "hard", createRng(seed))).not.toBe("h1h2");
  });

  it("Draughts: takes the double jump", () => {
    const b = new Array(64).fill(0);
    b[5 * 8 + 2] = 1; // seat 0 man at row 5 col 2
    b[4 * 8 + 3] = 3; // rival man
    b[2 * 8 + 5] = 3; // second rival man
    b[0 * 8 + 1] = 3; // keep the rival alive
    const s = { board: b, turn: 0 as const, quiet: 0, moves: [] };
    const m = draughtsBot.choose(s, 0, "hard", createRng("d"));
    expect(m).toEqual([42, 28, 14]);
  });

  it("Oware: takes a capture when it is free", () => {
    const pits = [1, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 4];
    const s = { pits, scores: [20, 20] as [number, number], turn: 0 as const, quiet: 0, over: false, history: [] };
    expect(owareBot.choose(s, 0, "hard", createRng("o"))).toBe(5);
  });

  it("Flip: the evaluation prizes a corner over a plain flip", () => {
    const g = new Array(64).fill(0);
    g[9] = 2;
    g[18] = 1;
    g[27] = 2;
    g[36] = 1;
    g[20] = 2;
    g[21] = 1;
    const corner = place(g, 0, 1),
      plain = place(g, 19, 1);
    expect(evaluateFlip(corner, 0)).toBeGreaterThan(evaluateFlip(plain, 0));
    const m = flipBot.choose({ grid: g, turn: 0, moves: [] }, 0, "hard", createRng("f"));
    expect([0, 19]).toContain(m);
  });

  it("Ludo: rolls first, then captures over a plain step", () => {
    const rng = createRng("l");
    const s = ludoBot.rules.initial(2, rng);
    expect(ludoBot.choose(s, 0, "hard", rng)).toEqual({ kind: "roll" });
    // seat 0 (colour 0) pieces at 2 and 10; rival (colour 2, start 26) on absolute 5 = its progress 31
    const table = {
      colours: [0, 2],
      pieces: [
        [2, 10, -1, -1],
        [31, -1, -1, -1],
      ],
    };
    expect(ludoHardScore(table, 0, 3, 0)).toBeGreaterThan(ludoHardScore(table, 0, 3, 1));
    const m = ludoBot.choose({ ...table, turn: 0, roll: 3, sixes: 0, log: [{ seat: 0, roll: 3, piece: null }] }, 0, "hard", rng);
    expect(m).toEqual({ kind: "move", piece: 0 });
  });
});

describe("Dara bot", () => {
  const at = (r: number, c: number) => r * 6 + c;
  const pos = (mine: number[], theirs: number[]) => {
    const board = new Array(30).fill(0);
    mine.forEach((i) => (board[i] = 1));
    theirs.forEach((i) => (board[i] = 2));
    return { board, hand: [0, 0] as [number, number], turn: 0 as const, quiet: 0 };
  };

  it("hard takes a free capture, from the line the rival nearly has", () => {
    // seat 0 steps (0,2) down to make three across row 1; seat 1 has (3,3) (3,4) with (2,5) ready to step in
    const s = pos([at(1, 0), at(1, 1), at(0, 2), at(4, 0)], [at(3, 3), at(3, 4), at(2, 5), at(4, 3)]);
    const m = daraBot.choose(s, 0, "hard", createRng("d"));
    expect(m).toMatchObject({ kind: "move", from: at(0, 2), to: at(1, 2) });
    expect([at(3, 3), at(3, 4), at(2, 5)]).toContain((m as { take: number }).take);
  });

  it("evaluation counts stones and ready threes", () => {
    const s = pos([at(1, 0), at(1, 1), at(0, 2), at(4, 0)], [at(3, 3), at(4, 5), at(4, 3)]);
    expect(evaluateDara(s, 0)).toBeGreaterThan(evaluateDara(s, 1));
  });
});

describe("hard beats easy", () => {
  for (const game of ["fourup", "flip", "draughts", "oware", "dara"] as const)
    it(`${game}: hard wins most games against easy`, async () => {
      const bot = await loadBot(game);
      let wins = 0;
      for (const seed of ["a", "b", "c"]) {
        const r = selfPlay(bot, ["easy", "hard"], `${game}:strength:${seed}`, 15);
        if (r.status.winner === 1) wins++;
      }
      expect(wins).toBeGreaterThanOrEqual(2);
    }, 60_000);
});

describe("search", () => {
  // Nim with 1 or 2 stones: the player facing a multiple of 3 loses.
  const nim: SearchGame<{ n: number; turn: number }, number> = {
    toMove: (p) => p.turn,
    terminal: (p) => (p.n === 0 ? { winner: 1 - p.turn } : null),
    moves: (p) => [1, 2].filter((k) => k <= p.n),
    stuck: () => ({ winner: null }),
    play: (p, k) => ({ n: p.n - k, turn: 1 - p.turn }),
    evaluate: () => 0,
  };
  it("plays perfect Nim", () => {
    for (const n of [4, 5, 7, 8, 10, 11]) {
      const r = searchBest(nim, { n, turn: 0 }, 0, { budgetMs: 200, maxDepth: 12, rng: createRng(n) });
      expect((n - r.move) % 3).toBe(0);
    }
  });
});
