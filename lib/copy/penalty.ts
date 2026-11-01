/** Player-facing copy for Penalty King (games/penalty). Short, warm, plain; a little Accra park football. */
import type { KickResult } from "@/games/penalty/logic";

const zones = ["left", "middle", "right"] as const;

export const PENALTY_COPY = {
  tutorial: "Tap once to set your aim, then again to set your power. Beat the keeper.",
  intro: (kicks: number) => `${kicks} kicks. Tap or press Space: aim first, then power.`,
  zone: (z: number) => zones[z] ?? "middle",
  ready: "Ready",
  readySmall: (kick: number, total: number) => `Kick ${kick} of ${total}`,
  start: "Take the kick",
  setAim: "Set aim",
  setPower: "Set power",
  next: "Next kick",
  done: "Done",
  aimLabel: "Aim",
  powerLabel: "Power",
  aimMeter: (v: number) => `Aim meter, ${v} of 100. Left under 35, right over 65, wide at the ends.`,
  powerMeter: (v: number) => `Power meter, ${v} of 100. Too soft under the line, over the bar above 92.`,
  timeLeft: "Time left for this kick",
  goalLabel: "The goal",
  keeper: (z: number | null) => (z === null ? "Keeper on the line." : `Keeper went ${zones[z] ?? "middle"}.`),
  ball: (aim: number, power: number) => `Ball at aim ${aim}, power ${power}.`,
  armAnnounce: (kick: number) => `Kick ${kick}. Aim meter moving. Tap to set aim.`,
  aimAnnounce: (aim: number) => `Aim ${aim}. Power meter moving. Tap to set power.`,
  result: {
    goal: "Goal!",
    saved: "Saved",
    wide: "Wide",
    over: "Over the bar",
    timeout: "Too slow",
  } satisfies Record<KickResult, string>,
  /** Feedback line after a kick. */
  feedback: {
    goal: (acc: number) => `Back of the net! Plus ${acc} for accuracy.`,
    saved: (z: number) => `Chale, the keeper went ${zones[z] ?? "middle"} and saved it.`,
    softSaved: "Too soft. The keeper got back to it.",
    wide: "Wide of the post.",
    over: "Over the bar. Ease off the power.",
    timeout: "Too slow. The kick is gone.",
  },
  kickShort: { goal: "Goal", saved: "Save", wide: "Wide", over: "Over", timeout: "Slow" } satisfies Record<KickResult, string>,
  kickLabel: (i: number, r: KickResult | null, acc: number) =>
    r === null
      ? `Kick ${i + 1}, not taken`
      : r === "goal"
        ? `Kick ${i + 1}, goal, ${acc} accuracy`
        : `Kick ${i + 1}, ${r === "timeout" ? "too slow" : r}`,
  kicksLabel: "Kicks",
  finished: (goals: number, total: number, score: number) =>
    goals === total ? `Ayekoo! ${goals} from ${total}. Score ${score}.` : `${goals} from ${total}. Score ${score}.`,
  score: "Score",
};
