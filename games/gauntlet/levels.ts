/**
 * Gauntlet rooms: tiny one-screen troll rooms. The weekly Gauntlet plays 10 of them in a row, the same
 * 10 for everyone that week. Every lie is telegraphed after the first death, so the second try is fair.
 */
import type { LevelDef } from "@/phaser/sim/level";
import { BASE_CONFIG, type PlatformerConfig } from "@/phaser/sim/platformer";
import { GENERATED, LADDER } from "./levels.generated";

/** Gauntlet physics: the Gotcha runner. */
export const CONFIG: PlatformerConfig = { ...BASE_CONFIG, levelPause: 24 };

const SKY = "..................";

/** The original hand-designed rooms. Daily and free-play courses draw from these only. */
export const HAND_LEVELS: LevelDef[] = [
  {
    id: "hello",
    name: "Hello",
    tiles: [SKY, SKY, SKY, SKY, SKY, SKY, ".S..............E.", "###########11#####", "###########11#####"],
    traps: { "1": { kind: "drop", delay: 3 } },
    triggers: [{ zone: [10, 4, 1, 3], fire: ["1"] }],
  },
  {
    id: "pop",
    name: "Pop",
    tiles: [SKY, SKY, SKY, SKY, SKY, SKY, ".S......1.......E.", "##################", "##################"],
    traps: { "1": { kind: "spikes", delay: 6 } },
    triggers: [{ zone: [6, 4, 1, 3], fire: ["1"] }],
  },
  {
    id: "turn-around",
    name: "Turn Around",
    tiles: [SKY, SKY, SKY, SKY, SKY, SKY, ".S..............E.", "##################", "##################"],
    traps: { "1": { kind: "exit", delay: 0, to: [1, 6], frames: 45 } },
    triggers: [{ zone: [12, 0, 1, 7], fire: ["1"] }],
  },
  {
    id: "bonk",
    name: "Bonk",
    tiles: [SKY, SKY, SKY, SKY, SKY, ".......11.........", ".S..............E.", "#######..#########", "#######^^#########"],
    traps: { "1": { kind: "block", delay: 0 } },
    triggers: [{ zone: [5, 2, 2, 3], fire: ["1"] }],
  },
  {
    id: "hurry",
    name: "Hurry",
    tiles: [SKY, SKY, SKY, SKY, SKY, SKY, ".S..........E.....", "###1111111111#####", "###1111111111#####"],
    traps: { "1": { kind: "drop", delay: 130 } },
    triggers: [{ zone: [1, 4, 2, 3], fire: ["1"] }],
  },
  {
    id: "fake-step",
    name: "Fake Step",
    tiles: [
      SKY,
      SKY,
      SKY,
      SKY,
      "...........#####E.",
      "........1..######.",
      ".S...#..1..######.",
      "############^#####",
      "##################",
    ],
    traps: { "1": { kind: "drop", delay: 8 } },
    triggers: [{ zone: [8, 2, 1, 3], fire: ["1"] }],
  },
  {
    id: "two-doors",
    name: "Two Doors",
    tiles: [SKY, SKY, SKY, SKY, SKY, "........===.......", ".S..........E.....", "##################", "##################"],
    traps: {
      "1": { kind: "exit", delay: 0, to: [16, 6], frames: 30 },
      "2": { kind: "exit", delay: 0, to: [9, 4], frames: 40 },
    },
    triggers: [
      { zone: [10, 0, 1, 7], fire: ["1"] },
      { zone: [15, 0, 1, 7], fire: ["2"] },
    ],
  },
  {
    id: "landing",
    name: "Landing",
    tiles: [SKY, SKY, SKY, SKY, SKY, SKY, ".S.......1......E.", "######..##########", "######^^##########"],
    traps: { "1": { kind: "spikes", delay: 0 } },
    triggers: [{ zone: [6, 2, 2, 3], fire: ["1"] }],
  },
  {
    id: "behind-you",
    name: "Behind You",
    tiles: [SKY, SKY, SKY, SKY, SKY, ".....###.....", ".S.......1111...E.", "##################", "##################"].map((r) =>
      r.padEnd(18, "."),
    ),
    traps: { "1": { kind: "spikes", delay: 20 } },
    triggers: [{ zone: [8, 4, 1, 3], fire: ["1"] }],
  },
  {
    id: "stairs-down",
    name: "Stairs Down",
    tiles: [
      SKY,
      SKY,
      ".S................",
      "####..............",
      "####1.............",
      "####11............",
      "####111........E..",
      "####^^^###########",
      "##################",
    ],
    traps: { "1": { kind: "drop", delay: 2 } },
    triggers: [{ zone: [4, 1, 1, 3], fire: ["1"] }],
  },
  {
    id: "door-ledge",
    name: "Door Ledge",
    tiles: [
      SKY,
      SKY,
      SKY,
      "............####..",
      SKY,
      ".........==.......",
      ".S..............E.",
      "##################",
      "##################",
    ],
    traps: { "1": { kind: "exit", delay: 0, to: [14, 2], frames: 30 } },
    triggers: [{ zone: [13, 0, 1, 7], fire: ["1"] }],
  },
  {
    id: "last-laugh",
    name: "Last Laugh",
    tiles: [SKY, SKY, SKY, SKY, SKY, SKY, ".S.....2........E.", "############11####", "############11####"],
    traps: { "1": { kind: "drop", delay: 0 }, "2": { kind: "spikes", delay: 4 } },
    triggers: [
      { zone: [12, 4, 2, 3], fire: ["1"] },
      { zone: [5, 4, 1, 3], fire: ["2"] },
    ],
  },
];

/** Hand-tuned set pieces that close tiers of the level ladder (solutions found by scripts/rage-design.ts). */
export const SET_PIECES: LevelDef[] = [
  {
    // The door runs home, and the floor you just crossed gives way on the walk back.
    id: "round-trip",
    name: "Round Trip",
    tiles: [SKY, SKY, SKY, SKY, SKY, SKY, ".S..............E.", "########22########", "########22########"],
    traps: { "1": { kind: "exit", delay: 0, to: [2, 6], frames: 45 }, "2": { kind: "drop", delay: 50 } },
    triggers: [{ zone: [14, 0, 1, 7], fire: ["1", "2"] }],
  },
  {
    // A low hall: the ceiling grows teeth, so every hop over the floor spikes must stay low.
    id: "low-ceiling",
    name: "Low Ceiling",
    tiles: [
      SKY,
      SKY,
      SKY,
      "....##############",
      "....11111111111111",
      SKY,
      ".S......^.....^.E.",
      "##################",
      "##################",
    ],
    traps: { "1": { kind: "spikes", delay: 0 } },
    triggers: [{ zone: [4, 5, 1, 2], fire: ["1"] }],
  },
  {
    // A fake floor, a hidden block over the pit and a door that runs back across it.
    id: "double-cross",
    name: "Double Cross",
    tiles: [SKY, SKY, SKY, SKY, SKY, ".........33.........", ".S...............E..", "####11###..#########", "####11###^^#########"].map(
      (r) => r.padEnd(20, "."),
    ),
    traps: {
      "1": { kind: "drop", delay: 2 },
      "2": { kind: "exit", delay: 0, to: [12, 6], frames: 30 },
      "3": { kind: "block", delay: 0 },
    },
    triggers: [
      { zone: [4, 0, 2, 7], fire: ["1"] },
      { zone: [15, 0, 1, 7], fire: ["2"] },
      { zone: [7, 2, 2, 3], fire: ["3"] },
    ],
  },
  {
    // The final room: every lie at once.
    id: "last-laugh-encore",
    name: "Last Laugh Encore",
    tiles: [
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "...............===....",
      ".S.....2.....44.....E.",
      "#####11####..######33#",
      "#####11####^^######33#",
    ],
    traps: {
      "1": { kind: "drop", delay: 2 },
      "2": { kind: "spikes", delay: 0 },
      "3": { kind: "drop", delay: 0 },
      "4": { kind: "spikes", delay: 90 },
      "5": { kind: "exit", delay: 0, to: [16, 4], frames: 40 },
    },
    triggers: [
      { zone: [5, 0, 2, 7], fire: ["1"] },
      { zone: [6, 0, 1, 6], fire: ["2"] },
      { zone: [9, 0, 1, 7], fire: ["4"] },
      { zone: [18, 0, 1, 7], fire: ["3", "5"] },
    ],
  },
];

const BY_ID = new Map([...HAND_LEVELS, ...SET_PIECES, ...GENERATED].map((l) => [l.id, l]));

/** Every level in ladder order (Level 1 first): hand rooms, set pieces and generated rooms by difficulty. */
export const LEVELS: LevelDef[] = LADDER.length ? LADDER.map((id) => BY_ID.get(id)!) : [...HAND_LEVELS, ...SET_PIECES];

/** Level ids Daily and free-play courses draw from, in difficulty order (unchanged by the ladder). */
export const DAILY_POOL: string[] = HAND_LEVELS.map((l) => l.id);
