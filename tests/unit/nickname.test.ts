import { describe, expect, it } from "vitest";
import { nicknameProblem } from "@/lib/validation/nickname";

describe("nickname filter", () => {
  it("accepts normal names and Spuzler, rejects impersonation and abuse", () => {
    expect(nicknameProblem("AmaTheGreat")).toBeNull();
    expect(nicknameProblem("SpuzlerAma")).toBeNull();
    expect(nicknameProblem("Spuzl")).not.toBeNull();
    expect(nicknameProblem("SPUZL_admin")).not.toBeNull();
    expect(nicknameProblem("f4ckface")).toBeNull(); // only real matches are blocked
    expect(nicknameProblem("fuckface")).not.toBeNull();
    expect(nicknameProblem("ab")).not.toBeNull();
    expect(nicknameProblem("has space")).not.toBeNull();
  });
});
