/**
 * Wobble ropes: hand-designed tightrope spans (length, walk speed, how tippy, how windy). The gusts on
 * each span are seeded per Daily and replay the same on every attempt. A Daily course is 3 to 8 spans,
 * gentlest first. Speeds are Q8 px per frame (256 = 1 px).
 */
import type { RopeDef } from "@/phaser/sim/wobble";

export const ROPES: RopeDef[] = [
  { id: "first-steps", name: "First Steps", length: 480, speed: 320, k: 8, gusts: 1, wind: [1, 2], dur: [30, 50], breeze: 0 },
  { id: "light-breeze", name: "Light Breeze", length: 560, speed: 320, k: 9, gusts: 2, wind: [2, 2], dur: [30, 60], breeze: 0 },
  { id: "long-walk", name: "Long Walk", length: 720, speed: 352, k: 10, gusts: 2, wind: [2, 3], dur: [40, 60], breeze: 0 },
  { id: "side-wind", name: "Side Wind", length: 640, speed: 352, k: 10, gusts: 2, wind: [1, 2], dur: [40, 70], breeze: 1 },
  { id: "gusty", name: "Gusty", length: 640, speed: 352, k: 11, gusts: 4, wind: [2, 3], dur: [25, 45], breeze: 0 },
  { id: "jittery", name: "Jittery", length: 600, speed: 384, k: 13, gusts: 3, wind: [2, 3], dur: [20, 40], breeze: 0 },
  { id: "headwind", name: "Headwind", length: 720, speed: 320, k: 11, gusts: 3, wind: [3, 4], dur: [30, 50], breeze: -1 },
  { id: "storm", name: "Storm", length: 800, speed: 384, k: 12, gusts: 5, wind: [3, 4], dur: [25, 45], breeze: 0 },
  { id: "high-wire", name: "High Wire", length: 880, speed: 384, k: 13, gusts: 5, wind: [2, 4], dur: [30, 60], breeze: 1 },
  { id: "last-span", name: "Last Span", length: 960, speed: 416, k: 14, gusts: 6, wind: [3, 4], dur: [25, 50], breeze: 0 },
];
