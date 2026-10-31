/**
 * Gauntlet rooms: tiny one-screen troll rooms. The weekly Gauntlet plays 10 of them in a row, the same
 * 10 for everyone that week. Every lie is telegraphed after the first death, so the second try is fair.
 */
import type { LevelDef } from "@/phaser/sim/level";
import { BASE_CONFIG, type PlatformerConfig } from "@/phaser/sim/platformer";

/** Gauntlet physics: the Gotcha runner. */
export const CONFIG: PlatformerConfig = { ...BASE_CONFIG, levelPause: 24 };

const SKY = "..................";

export const LEVELS: LevelDef[] = [
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
