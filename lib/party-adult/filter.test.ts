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

describe("party text filter: spelled-out and disguised contact details", () => {
  const zw = String.fromCharCode(0x200b);
  it("blocks phone numbers written in words, or words and digits mixed", () => {
    no("zero two four four one two three four five six", "contact");
    no("zero two four 555 1234", "contact");
    no("o2four 555 1234", "contact");
    no("oh two four, four one two, three four five six", "contact");
    no("ZERO-TWO-FOUR-FIVE-FIVE-FIVE-ONE", "contact");
    no("my number is 0 two 4 four 1 two 3", "contact");
    no("zerotwofourfivefivefiveone", "contact");
    no("o two 4 double five triple one", "contact");
    no("+ two three three two four four one two three", "contact");
    no("nil two four 412 3456", "contact");
  });
  it("blocks numbers, emails and links in look-alike or full-width characters", () => {
    no("０２４４ １２３ ４５６", "contact");
    no("𝟎𝟐𝟒𝟒𝟏𝟐𝟑𝟒𝟓𝟔", "contact");
    no(`024${zw}412${zw}3456`, "contact");
    no("ama＠mail．com", "contact");
    no("visit spuzl．gh", "contact");
    no("my іnѕta is kofi", "contact"); // Cyrillic i and dze
    no("аdd me on snар", "contact"); // Cyrillic a and er
    no("ⓦⓦⓦ.example.com", "contact");
  });
  it("lets ordinary sentences with number words through", () => {
    ok("I have two brothers and one sister");
    ok("I was born in nineteen ninety four");
    ok("Someone once told me I sing well");
    ok("Oh no, I lost my phone twice");
    ok("I went to Kumasi for a wedding");
    ok("I ate three plates of jollof, two of banku");
    ok("One two three, I can dance like a pro");
    ok("I have 2 cats, 3 dogs and 1 goat");
    ok("My PIN has four digits");
    ok("I scored 100 in maths in 2019");
    ok("I'm one of five children");
    ok("I own seven pairs of sneakers");
  });
});

describe("party text filter: look-alike letters and symbols", () => {
  const zw = String.fromCharCode(0x200b);
  it("blocks blocked words written with look-alikes, accents, symbols or invisible characters", () => {
    no("ѕеху", "blocked", "guess"); // Cyrillic
    no("ΚΥS", "blocked", "guess"); // Greek capitals
    no("ｆｕｃｋ", "blocked", "guess");
    no("𝐟𝐮𝐜𝐤 this", "blocked");
    no("fücк you", "blocked");
    no(`fu${zw}ck`, "blocked", "guess");
    no(`ni${String.fromCharCode(0x00ad)}gga`, "blocked", "guess");
    no("$hit", "blocked", "guess");
    no("b!tch", "blocked", "guess");
    no("big a$$", "blocked", "guess");
    no("a$$hole", "blocked", "guess");
    no("you @sshole", "contact"); // reads as a handle: refused either way
    no("sеnd nudеs", "blocked"); // Cyrillic e
    no("kіll yourself", "blocked"); // Cyrillic i
  });
  it("still lets accented names, punctuation and other scripts' ordinary words through", () => {
    ok("I love café au lait!");
    ok("My name is Zoë and I'm from Accra!");
    ok("Hello! I'm Kwame.");
    ok("I paid $5 for kenkey");
    ok("I'm @ home most weekends");
    ok("I once met a Ψ professor");
    ok("I speak Ελληνικά a little");
    ok("Привет means hello");
    ok("I can say Merci beaucoup!");
    ok("I named my dog Ñoño");
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
