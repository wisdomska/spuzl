import { describe, expect, it } from "vitest";
import { gameReturn, isReturnPath, returnPath } from "./onboarding-return";
import { GAMES, RETIRED_GAMES } from "@/lib/catalog";

describe("onboarding ?return= (R4-03)", () => {
  it("maps daily and real games to their pages", () => {
    expect(returnPath("daily")).toBe("/daily");
    expect(returnPath("game:crownfall")).toBe("/play/crownfall");
    for (const g of GAMES) expect(returnPath(gameReturn(g.id))).toBe(`/play/${g.id}`);
  });

  it("refuses unknown and retired games, and anything that could leave the app", () => {
    expect(returnPath(null)).toBeNull();
    expect(returnPath("")).toBeNull();
    expect(returnPath("home")).toBeNull();
    expect(returnPath("game:")).toBeNull();
    expect(returnPath("game:nope")).toBeNull();
    expect(returnPath("game:Crownfall")).toBeNull();
    expect(returnPath("game:crownfall/../../admin")).toBeNull();
    expect(returnPath("game://evil.example")).toBeNull();
    expect(returnPath("game:crownfall?x=1")).toBeNull();
    expect(returnPath("https://evil.example")).toBeNull();
    expect(returnPath("//evil.example")).toBeNull();
    expect(returnPath("game:__proto__")).toBeNull();
    expect(returnPath("game:constructor")).toBeNull();
    for (const g of RETIRED_GAMES) expect(returnPath(gameReturn(g.id))).toBeNull();
  });

  it("checks a stored path again before it is used", () => {
    expect(isReturnPath("/daily")).toBe(true);
    expect(isReturnPath("/play/crownfall")).toBe(true);
    expect(isReturnPath("/play/nope")).toBe(false);
    expect(isReturnPath("/play/crownfall?mode=free")).toBe(false);
    expect(isReturnPath("/admin")).toBe(false);
    expect(isReturnPath("https://evil.example/play/crownfall")).toBe(false);
    expect(isReturnPath("//evil.example")).toBe(false);
    expect(isReturnPath(undefined)).toBe(false);
  });
});
