import { describe, expect, it } from "vitest";
import { digitRuns, foldText, longestDigitRun } from "./fold";

const zw = String.fromCharCode(0x200b);
const shy = String.fromCharCode(0x00ad);

describe("foldText", () => {
  it("maps look-alike letters from other scripts to Latin", () => {
    expect(foldText("ѕех")).toBe("sex"); // Cyrillic dze, ie, ha
    expect(foldText("ΑΒΕΚΜΝΟΡΤΧ")).toBe("abekmnoptx"); // Greek capitals
    expect(foldText("рорсоrn")).toBe("popcorn"); // Cyrillic er, o, es mixed with Latin
    expect(foldText("ıłøđ")).toBe("ilod");
  });
  it("unifies full-width and styled letters (NFKC) and strips accents", () => {
    expect(foldText("ｆｕｃｋ")).toBe("fuck");
    expect(foldText("𝐟𝐮𝐜𝐤")).toBe("fuck");
    expect(foldText("𝒻𝓊𝒸𝓀")).toBe("fuck");
    expect(foldText("fücķ")).toBe("fuck");
    expect(foldText("café ñame")).toBe("cafe name");
    expect(foldText("ﬁsh")).toBe("fish");
  });
  it("removes invisible characters instead of splitting the word", () => {
    expect(foldText(`fu${zw}ck`)).toBe("fuck");
    expect(foldText(`fu${shy}ck`)).toBe("fuck");
    expect(foldText(`a${String.fromCharCode(0x2060)}b${String.fromCharCode(0xfeff)}c`)).toBe("abc");
  });
  it("leaves plain English and digits alone", () => {
    expect(foldText("I was born in 1994")).toBe("i was born in 1994");
    expect(foldText("Ama's 2 dogs!")).toBe("ama's 2 dogs!");
  });
});

describe("digitRuns", () => {
  it("reads spelled-out numbers", () => {
    expect(digitRuns("zero two four four one two three four five six")).toEqual(["0244123456"]);
    expect(digitRuns("oh two four, five five five")).toEqual(["024555"]);
    expect(digitRuns("o2four 555 1234")).toEqual(["0245551234"]);
    expect(digitRuns("twofourfive")).toEqual(["245"]);
    expect(digitRuns("double five triple 0 one")).toEqual(["550001"]);
    expect(digitRuns("nil-two-four")).toEqual(["024"]);
  });
  it("ends a run at an ordinary word or a long separator", () => {
    expect(digitRuns("i have two dogs and three cats")).toEqual(["2", "3"]);
    expect(digitRuns("one two three ... four five six")).toEqual(["123", "456"]);
    expect(digitRuns("someone often tone phone")).toEqual([]);
    expect(digitRuns("i went to the shop for food")).toEqual([]);
  });
  it("finds the longest run", () => {
    expect(longestDigitRun("call zero two four 412 3456")).toBe(10);
    expect(longestDigitRun("born in 1994")).toBe(4);
    expect(longestDigitRun("")).toBe(0);
  });
});
