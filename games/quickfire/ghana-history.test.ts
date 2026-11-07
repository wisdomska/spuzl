import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { EVENT_QUIZZES } from "@/lib/events";
import { GHANA_HISTORY } from "./ghana-history";
import { QUIZ_SETS } from "./sets";
import logic, { FREE_BASE, QUESTIONS, SET_BASE, generateAt, quizRounds, quizSetBoard } from "./logic";

describe("6 March Quiz: Ghana history set", () => {
  it("has 20 questions, each with one answer and three different wrong options and a source", () => {
    expect(GHANA_HISTORY).toHaveLength(20);
    expect(new Set(GHANA_HISTORY.map((q) => q.q)).size).toBe(20);
    for (const it of GHANA_HISTORY) {
      expect(new Set([it.answer, ...it.wrong]).size, it.q).toBe(4);
      expect(it.source.length).toBeGreaterThan(5);
      expect(it.cat).toBe("africa");
      expect(it.q).not.toMatch(/[–—]/);
    }
  });

  it("keeps the facts it was checked for", () => {
    const answer = (start: string) => GHANA_HISTORY.find((q) => q.q.startsWith(start))!.answer;
    expect(answer("On what date did Ghana become independent")).toBe("6 March 1957");
    expect(answer("On what date did Ghana become a republic")).toBe("1 July 1960");
    expect(answer("Who designed Ghana's national flag")).toBe("Theodosia Okoh");
    expect(answer("Who designed Ghana's coat of arms")).toBe("Amon Kotei");
    expect(answer("What is the motto")).toBe("Freedom and Justice");
    expect(answer("Tetteh Quarshie")).toBe("Cocoa");
  });

  it("every event quiz id has a set, played in four rounds of five", () => {
    for (const id of EVENT_QUIZZES) expect(QUIZ_SETS.some((s) => s.id === id)).toBe(true);
    expect(quizRounds("ghana-1957")).toBe(4);
    expect(quizRounds("nope")).toBe(0);
  });

  it("builds each round from its content index, the same way twice, apart from free and daily boards", () => {
    const seen = new Set<string>();
    for (let r = 0; r < 4; r++) {
      const a = generateAt(SET_BASE + r, "easy");
      const b = generateAt(SET_BASE + r, "easy");
      expect(a).toEqual(b);
      expect(a.puzzle.questions).toHaveLength(QUESTIONS);
      a.puzzle.questions.forEach((q, i) => {
        seen.add(q.q);
        expect(q.choices[a.solution.correct[i]]).toBe(GHANA_HISTORY[r * QUESTIONS + i].answer);
      });
    }
    expect(seen.size).toBe(20);
    expect(SET_BASE).toBeGreaterThanOrEqual(2 * FREE_BASE);
    expect(() => generateAt(SET_BASE + 4)).toThrow();
  });

  it("serves a round from a seed, so the attempt's seed rebuilds the same board", () => {
    const a = quizSetBoard("ghana-1957", createRng("quiz:ghana-1957:abc"), "easy")!;
    const b = quizSetBoard("ghana-1957", createRng("quiz:ghana-1957:abc"), "easy")!;
    expect(a).toEqual(b);
    expect(GHANA_HISTORY.map((q) => q.q)).toContain(a.puzzle.questions[0].q);
    expect(quizSetBoard("nope", createRng("x"), "easy")).toBeNull();
    // The served answer check works on a set board like any other.
    const ref = a.puzzle.ref as { i: number };
    expect(ref.i).toBeGreaterThanOrEqual(SET_BASE);
    expect(logic.verify(a.puzzle, a.solution, { answers: [] }).ok).toBe(false);
  });
});
