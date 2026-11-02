import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { securedLevelSeed } from "./level-seed";

describe("secured level seeds", () => {
  it("are stable per game and level, differ between them, and depend on the secret", () => {
    expect(securedLevelSeed("lost", 12, "a")).toBe(securedLevelSeed("lost", 12, "a"));
    expect(securedLevelSeed("lost", 12, "a")).not.toBe(securedLevelSeed("lost", 13, "a"));
    expect(securedLevelSeed("lost", 12, "a")).not.toBe(securedLevelSeed("dusk", 12, "a"));
    expect(securedLevelSeed("lost", 12, "a")).not.toBe(securedLevelSeed("lost", 12, "b"));
    expect(securedLevelSeed("lost", 12, "a")).not.toBe("level:lost:12");
  });
});
