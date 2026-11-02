// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { dropResume, keepResume, resumable, resumeIdFor, resumeNote, RESUME_NOTE_MS } from "@/lib/client/resume";

beforeEach(() => localStorage.clear());

describe("resume notes (solo free play and levels)", () => {
  it("keeps the attempt being played and offers it back for the same mode", () => {
    keepResume("crownfall", { attemptId: "a1", mode: "free", difficulty: "easy" });
    expect(resumeNote("crownfall")?.attemptId).toBe("a1");
    expect(resumeIdFor("crownfall", "free")).toBe("a1");
    expect(resumeIdFor("crownfall", "free", { difficulty: "easy" })).toBe("a1");
    // Another mode, or free play at another difficulty, starts fresh.
    expect(resumeIdFor("crownfall", "level")).toBeUndefined();
    expect(resumeIdFor("crownfall", "free", { difficulty: "hard" })).toBeUndefined();
    expect(resumeIdFor("dusk", "free")).toBeUndefined();
  });

  it("matches levels by number when one is asked for", () => {
    keepResume("trotro", { attemptId: "l5", mode: "level", level: 5 });
    expect(resumeIdFor("trotro", "level")).toBe("l5");
    expect(resumeIdFor("trotro", "level", { level: 5 })).toBe("l5");
    expect(resumeIdFor("trotro", "level", { level: 6 })).toBeUndefined();
  });

  it("drops the note on a clear, a fail or a new puzzle (only for that attempt)", () => {
    keepResume("weave", { attemptId: "a1", mode: "free" });
    dropResume("weave", "other");
    expect(resumeNote("weave")).not.toBeNull();
    dropResume("weave", "a1");
    expect(resumeNote("weave")).toBeNull();
  });

  it("ignores stale notes", () => {
    const t0 = Date.now();
    keepResume("lost", { attemptId: "a1", mode: "free" }, t0);
    expect(resumeNote("lost", t0 + RESUME_NOTE_MS - 1)).not.toBeNull();
    expect(resumeNote("lost", t0 + RESUME_NOTE_MS + 1)).toBeNull();
  });

  it("never keeps timed scored runs (leaving loses the run)", () => {
    expect(resumable("quickfire")).toBe(false);
    keepResume("quickfire", { attemptId: "q1", mode: "free" });
    expect(resumeNote("quickfire")).toBeNull();
    expect(resumable("crownfall")).toBe(true);
  });
});
