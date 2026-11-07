/** Player-facing copy for Two Truths and a Lie (games/twotruths, R2-P5 lab game). Short, warm, plain. */
import type { TruthsTheme } from "@/games/twotruths/rules";

export const TRUTHS_THEME_LABEL: Record<TruthsTheme, string> = {
  ghana: "Ghana",
  westafrica: "West Africa",
  science: "Science",
  food: "Food",
  football: "Football",
  music: "Music",
  animals: "Animals",
  world: "World facts",
};

export const twoTruths = {
  /** the card's question, the same every round */
  ask: "Two are true. Which one is the lie?",
  noun: "Round",
  /** the hint control: it strikes out one of the two truths */
  hint: "Hint",
  /** feedback once a round is judged; `fix` is what is true instead */
  right: (fix: string) => `You found the lie. ${fix}`,
  wrong: (lie: string, fix: string) => `Not that one. The lie was: ${lie} ${fix}`,
  time: (lie: string, fix: string) => `Time. The lie was: ${lie} ${fix}`,
  late: (lie: string, fix: string) => `Too late to count. The lie was: ${lie} ${fix}`,
} as const;
