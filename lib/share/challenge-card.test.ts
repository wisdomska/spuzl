import { describe, expect, it } from "vitest";
import {
  CHALLENGE_DAYS,
  CHALLENGE_SIZES,
  SAMPLE_CHALLENGE,
  challengeCard,
  challengeCodeOf,
  challengeDaysLeft,
  challengePath,
  type ChallengeCardInput,
} from "./challenge-card";
import { worldCardColours } from "./card-model";
import { challengeCopy } from "@/lib/copy/challenge";

const base: ChallengeCardInput = {
  code: "K7QX2M",
  nickname: "Ama_K",
  color: "#ff8a3d",
  hat: "crown",
  gameName: "Crownfall",
  world: "logic",
  senderMs: 72_400,
  hints: 0,
  mistakes: 0,
  domain: "spuzl.vercel.app",
};

describe("challengeCard", () => {
  it("draws the game, the sender's time, their hatted Spuz and Beat me with the short link", () => {
    const c = challengeCard(base);
    expect(c).toMatchObject({
      kind: "challenge",
      kicker: "Crownfall",
      big: "1:12",
      who: "Ama_K's time",
      dare: "Beat me",
      spuz: "#FF8A3D",
      hat: "crown",
      mood: "wave",
      link: "spuzl.vercel.app/c/K7QX2M",
      nickname: "Ama_K",
    });
    expect(c.bg).toBe(worldCardColours("logic").bg);
    expect(c.alt).toBe("Ama_K challenges you to beat 1:12 on Crownfall. SPUZL.");
  });

  it("says the clear's effort on the story line", () => {
    expect(challengeCard(base).line).toBe("Clean clear. No hints, no slips.");
    expect(challengeCard({ ...base, hints: 1, mistakes: 0 }).line).toBe("1 hint, no slips.");
    expect(challengeCard({ ...base, hints: 0, mistakes: 3 }).line).toBe("No hints, 3 slips.");
    expect(challengeCard({ ...base, hints: 2, mistakes: 1 }).line).toBe("2 hints, 1 slip.");
    expect(challengeCard({ ...base, hints: -4, mistakes: -1 }).line).toBe("Clean clear. No hints, no slips.");
  });

  it("drops hats SpuzOG can't draw and bad colours, and Spuz stands proud without a hat", () => {
    const c = challengeCard({ ...base, hat: "<script>", color: "red" });
    expect(c.hat).toBeNull();
    expect(c.mood).toBe("proud");
    expect(c.spuz).toBe("#B8F23A");
  });

  it("prints nothing personal beyond the nickname", () => {
    const text = JSON.stringify(challengeCard(base));
    for (const k of ["city", "level", "birth", "age"]) expect(text).not.toContain(k);
  });

  it("has the link preview and story sizes", () => {
    expect(CHALLENGE_SIZES).toEqual({ og: { width: 1200, height: 630 }, story: { width: 1080, height: 1920 } });
    expect(SAMPLE_CHALLENGE.hat).toBe("kente");
  });
});

describe("challenge codes and expiry", () => {
  it("accepts 6-character codes from the room alphabet only", () => {
    expect(challengeCodeOf(" k7qx2m ")).toBe("K7QX2M");
    expect(challengeCodeOf("K7QX2")).toBeNull();
    expect(challengeCodeOf("K7QX0M")).toBeNull(); // no zero
    expect(challengeCodeOf("../../x")).toBeNull();
    expect(challengePath("k7qx2m")).toBe("/c/K7QX2M");
  });

  it("counts whole days left, rounding up, and 0 once it ran out", () => {
    const now = Date.parse("2026-11-07T12:00:00Z");
    expect(challengeDaysLeft(now + CHALLENGE_DAYS * 86_400_000, now)).toBe(7);
    expect(challengeDaysLeft(now + 3 * 3_600_000, now)).toBe(1);
    expect(challengeDaysLeft(now - 1, now)).toBe(0);
  });

  it("says the 7-day life plainly", () => {
    expect(CHALLENGE_DAYS).toBe(7);
    expect(challengeCopy.expiredBody(CHALLENGE_DAYS)).toBe("Challenges last 7 days. Ask for a fresh link.");
    expect(challengeCopy.endsIn(7)).toBe("Ends in 7 days");
    expect(challengeCopy.endsIn(1)).toBe("Ends today. Go now.");
  });
});
