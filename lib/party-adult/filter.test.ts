import { describe, expect, it } from "vitest";
import { cleanText, partyTextProblem, textTokens } from "./filter";
import { DRAW_WORDS } from "./content";

const ok = (s: string, k: "statement" | "guess" = "statement") => expect(partyTextProblem(s, k), s).toBeNull();
const no = (s: string, why: string, k: "statement" | "guess" = "statement") => expect(partyTextProblem(s, k), s).toBe(why);

describe("party text filter: shape", () => {
  it("refuses empty lines and enforces the length limits (statements 80, guesses 30)", () => {
    no("", "empty");
    no("   \n\t ", "empty");
    ok("a".repeat(80));
    no("a".repeat(81), "too_long");
    ok("b".repeat(30), "guess");
    no("b".repeat(31), "too_long", "guess");
  });
  it("collapses whitespace and strips control and zero-width characters", () => {
    expect(cleanText("  I   have\n two\tdogs ")).toBe("I have two dogs");
    expect(cleanText(`ki${String.fromCharCode(0x200b)}te`)).toBe("ki te");
    expect(cleanText(`a${String.fromCharCode(0x202e)}b`)).toBe("a b");
  });
});

describe("party text filter: contact details", () => {
  it("blocks phone numbers, emails, links and handles", () => {
    no("call 024 412 3456", "contact");
    no("+233244123456", "contact");
    no("0244-123-456", "contact");
    no("ama@mail.com", "contact");
    no("ama (at) mail . com", "contact");
    no("www.example.org", "contact");
    no("https://spuzl.vercel.app", "contact");
    no("visit spuzl.gh", "contact");
    no("kofi dot com", "contact");
    no("find me @kofi_99", "contact");
    no("add me on snap", "contact");
    no("my insta is kofi", "contact");
    no("ig: kofi", "contact");
    no("dm me later", "contact");
  });
  it("lets ordinary numbers and sentences through", () => {
    ok("I was born in 1994 and have 2 sisters");
    ok("I can swim. Me too.");
    ok("I ran 10 km on Saturday");
    ok("I have never used Instagram");
    ok("I met Mr. Mensah at church");
  });
});

describe("party text filter: abuse", () => {
  it("reuses the nickname blocklist, with leetspeak and spaced letters", () => {
    no("you are a fuckwit", "blocked");
    no("sh1t happens", "blocked");
    no("f u c k this", "blocked");
    no("kwasia", "blocked", "guess");
    no("you mumu", "blocked", "guess");
  });
  it("blocks extra sexual and abusive terms and phrases", () => {
    no("send nudes", "blocked");
    no("kill yourself", "blocked");
    no("kys", "blocked", "guess");
    no("sexy", "blocked", "guess");
    no("big ass", "blocked", "guess");
  });
  it("doesn't catch innocent words that contain a blocked one", () => {
    ok("I ate grapes in Kumasi"); // grape: rape is whole-word only
    ok("My friend Dickson drives a trotro");
    ok("I can assume any accent");
    ok("I love sushi tea");
    ok("I have the skills to code");
    ok("I killed a snake once");
    ok("I have a cocktail every Friday");
  });
  it("splits text into normalised words", () => {
    expect(textTokens("Hello, W0rld! a b c")).toEqual(["hello", "world", "abc"]);
  });
});

describe("Draw It words", () => {
  it("are all accepted by the filter (as guesses) and unique", () => {
    for (const w of DRAW_WORDS) for (const a of [w.word, ...(w.alt ?? [])]) ok(a, "guess");
    const words = DRAW_WORDS.map((w) => w.word);
    expect(new Set(words).size).toBe(words.length);
  });
  it("include Ghanaian everyday items", () => {
    const words = new Set(DRAW_WORDS.map((w) => w.word));
    for (const w of ["banku", "kente", "trotro", "jollof"]) expect(words.has(w), w).toBe(true);
    expect(DRAW_WORDS.length).toBeGreaterThanOrEqual(80);
  });
});
