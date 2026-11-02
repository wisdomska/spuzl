import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/events/server", () => ({ advanceEventQuest: async () => null }));
import { countWorlds } from "./progress";
import { GAME_BY_ID } from "@/lib/catalog";

describe('"different worlds" quests', () => {
  it("count distinct live worlds, including this clear's", () => {
    expect(countWorlds([], "logic")).toBe(1);
    expect(countWorlds(["crownfall", "nine"], "logic")).toBe(1); // same world twice
    expect(countWorlds(["crownfall", "coil"], "board")).toBe(3);
    expect(countWorlds(["crownfall", "coil", "echo"], "board")).toBe(4);
  });

  it("ignore retired games' old worlds", () => {
    expect(GAME_BY_ID.pixl).toBeDefined();
    expect(countWorlds(["pixl", "quilt"], "logic")).toBeLessThanOrEqual(2);
    expect(countWorlds(["quilt"], "logic")).toBe(1); // Shape Shed is hidden
  });
});
