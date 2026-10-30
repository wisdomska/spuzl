/**
 * Stacked towers (hand-tuned, one per difficulty). Slide speeds per block are seeded per Daily, so
 * everyone gets the same rhythm. Speeds are Q8 px per frame (256 = 1 px).
 */
import type { Difficulty } from "@/games/types";
import type { TowerDef } from "@/phaser/sim/stacked";

export const TOWERS: TowerDef[] = [
  { id: "steady", name: "Steady Tower", w: 160, start: 72, speed: 320, gain: 8, maxSpeed: 900, jitter: 40, target: 25 },
  { id: "brisk", name: "Brisk Tower", w: 160, start: 64, speed: 384, gain: 10, maxSpeed: 1000, jitter: 60, target: 25 },
  { id: "quick", name: "Quick Tower", w: 160, start: 60, speed: 448, gain: 12, maxSpeed: 1100, jitter: 80, target: 30 },
  { id: "frantic", name: "Frantic Tower", w: 160, start: 56, speed: 512, gain: 14, maxSpeed: 1200, jitter: 100, target: 30 },
  { id: "skyline", name: "Skyline", w: 170, start: 64, speed: 384, gain: 10, maxSpeed: 1200, jitter: 120, target: 50 },
];

export const TOWER_FOR: Record<Difficulty, string> = { easy: "steady", medium: "brisk", hard: "quick", expert: "frantic", mega: "skyline" };
