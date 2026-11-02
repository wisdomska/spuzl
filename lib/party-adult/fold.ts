/**
 * Look-alike folding and spelled-out numbers for the 18+ party text filter (lib/party-adult/filter.ts).
 *
 * `foldText` turns what a player typed into the plain lower-case Latin text the checks match against:
 * compatibility forms are unified (NFKC: full-width letters, styled maths letters, ligatures), invisible
 * characters are removed outright (zero-width, soft hyphen, bidi controls, variation selectors), accents are
 * stripped, and common look-alikes from other scripts become the Latin letter they imitate (Cyrillic "а", Greek
 * "ο", "ı", "ø" ...). It never rewrites digits or symbols; the word check adds leetspeak on top of it.
 *
 * `digitRuns` reads a folded text the way a phone number is read out: digit groups and English digit words
 * ("zero", "oh", "o", "two", "double five", "triple 0"), written apart or glued ("o2four", "twofour"), with at
 * most a short separator (space, dash, dot, comma, bracket, slash, plus) between them. Only whole words count, so
 * "someone", "often" or "tone" are never read as numbers, and homophones ("to", "for", "won") are left out.
 */

// Invisible characters removed before matching (stored text keeps cleanText's own handling).
const INVISIBLE = new RegExp(
  "[\\u00ad\\u034f\\u061c\\u115f\\u1160\\u17b4\\u17b5\\u180b-\\u180f\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u206f\\u3164\\ufe00-\\ufe0f\\ufeff\\uffa0]",
  "g",
);
const MARKS = new RegExp("\\p{M}", "gu");

/** Letters from other scripts (and a few Latin extras) that pass for a Latin letter. Lower case only. */
const CONFUSABLES: Record<string, string> = {
  // Cyrillic
  а: "a",
  б: "b",
  в: "b",
  г: "r",
  д: "d",
  е: "e",
  ё: "e",
  и: "u",
  й: "u",
  к: "k",
  л: "n",
  м: "m",
  н: "h",
  о: "o",
  п: "n",
  р: "p",
  с: "c",
  т: "t",
  у: "y",
  ф: "f",
  х: "x",
  ц: "u",
  ш: "w",
  щ: "w",
  ъ: "b",
  ы: "bi",
  ь: "b",
  э: "e",
  ю: "io",
  я: "r",
  ѕ: "s",
  і: "i",
  ї: "i",
  ј: "j",
  ԁ: "d",
  ԛ: "q",
  ԝ: "w",
  ү: "y",
  ұ: "y",
  һ: "h",
  ҳ: "x",
  ӏ: "l",
  ә: "e",
  ө: "o",
  ҫ: "c",
  ґ: "r",
  // Greek
  α: "a",
  β: "b",
  γ: "y",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "n",
  θ: "o",
  ι: "i",
  κ: "k",
  λ: "l",
  μ: "u",
  ν: "v",
  ξ: "e",
  ο: "o",
  π: "n",
  ρ: "p",
  σ: "o",
  ς: "c",
  τ: "t",
  υ: "u",
  φ: "f",
  χ: "x",
  ψ: "w",
  ω: "w",
  ϲ: "c",
  ϳ: "j",
  // Latin extras NFKD leaves alone
  ı: "i",
  ȷ: "j",
  ł: "l",
  ø: "o",
  đ: "d",
  ħ: "h",
  ŧ: "t",
  ƀ: "b",
  ɐ: "a",
  ɑ: "a",
  ɡ: "g",
  ɩ: "i",
  ɪ: "i",
  ʏ: "y",
  ʀ: "r",
  ʙ: "b",
  ʜ: "h",
  ɴ: "n",
  ᴀ: "a",
  ᴄ: "c",
  ᴅ: "d",
  ᴇ: "e",
  ᴊ: "j",
  ᴋ: "k",
  ᴍ: "m",
  ᴏ: "o",
  ᴘ: "p",
  ᴛ: "t",
  ᴜ: "u",
  ᴠ: "v",
  ᴡ: "w",
  ᴢ: "z",
  ß: "ss",
  æ: "ae",
  œ: "oe",
  þ: "p",
  // Cherokee and Armenian letters that copy Latin capitals and small letters
  ꭺ: "a",
  ꮯ: "c",
  ꭼ: "e",
  ꮋ: "h",
  ꮃ: "w",
  օ: "o",
  ս: "u",
  ց: "g",
  հ: "h",
  ո: "n",
};
const CONFUSABLE = new RegExp(`[${Object.keys(CONFUSABLES).join("")}]`, "gu");

/** Capitals that copy a different Latin letter than their small form does (Greek "Μ" is M, "μ" is u). */
const CAPITALS: Record<string, string> = {
  Α: "a",
  Β: "b",
  Ε: "e",
  Ζ: "z",
  Η: "h",
  Ι: "i",
  Κ: "k",
  Μ: "m",
  Ν: "n",
  Ο: "o",
  Ρ: "p",
  Τ: "t",
  Υ: "y",
  Χ: "x",
  А: "a",
  В: "b",
  Е: "e",
  К: "k",
  М: "m",
  Н: "h",
  О: "o",
  Р: "p",
  С: "c",
  Т: "t",
  Х: "x",
  У: "y",
  Ѕ: "s",
  І: "i",
  Ј: "j",
};
const CAPITAL = new RegExp(`[${Object.keys(CAPITALS).join("")}]`, "gu");

/** Plain lower-case Latin: NFKC, invisibles removed, accents stripped, look-alike letters mapped. */
export function foldText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(CAPITAL, (c) => CAPITALS[c] ?? c)
    .toLowerCase()
    .normalize("NFKD")
    .replace(MARKS, "")
    .replace(CONFUSABLE, (c) => CONFUSABLES[c] ?? c)
    .normalize("NFC");
}

const DIGIT_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  o: "0",
  nil: "0",
  nought: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};
const REPEAT: Record<string, number> = { double: 2, triple: 3 };
const WORDS = [...Object.keys(DIGIT_WORDS), ...Object.keys(REPEAT)].sort((a, b) => b.length - a.length);

/** A letter run read as digit words ("twofour" -> ["two", "four"]), or null when it isn't made only of them. */
function splitWords(s: string): string[] | null {
  const memo = new Map<number, string[] | null>();
  const at = (i: number): string[] | null => {
    if (i === s.length) return [];
    if (memo.has(i)) return memo.get(i)!;
    let res: string[] | null = null;
    for (const w of WORDS) {
      if (!s.startsWith(w, i)) continue;
      const rest = at(i + w.length);
      if (rest) {
        res = [w, ...rest];
        break;
      }
    }
    memo.set(i, res);
    return res;
  };
  return at(0);
}

/** Separators that keep a number going: a few spaces, dashes, dots, commas, brackets, slashes or a plus. */
const JOIN = /^[\s\-.,()[\]/+_*]{1,3}$/;

/**
 * Every run of digits in a folded text, with digit words and "double"/"triple" read as digits. A pending
 * "double" applies to the next digit; a letter run that isn't digit words, or a longer separator, ends the run.
 */
export function digitRuns(folded: string): string[] {
  const runs: string[] = [];
  let run = "";
  let repeat = 1;
  const end = () => {
    if (run) runs.push(run);
    run = "";
    repeat = 1;
  };
  const push = (d: string) => {
    run += d.repeat(repeat);
    repeat = 1;
  };
  for (const [part] of folded.matchAll(/[a-z]+|[0-9]+|[^a-z0-9]+/g)) {
    if (/^[0-9]/.test(part)) {
      push(part[0]);
      run += part.slice(1);
    } else if (/^[a-z]/.test(part)) {
      const words = splitWords(part);
      if (!words) {
        end();
        continue;
      }
      // A lone "o" or "oh" ("oh no") is read as a 0 too; a run that short never counts.
      for (const w of words) {
        if (REPEAT[w]) repeat = REPEAT[w];
        else push(DIGIT_WORDS[w]);
      }
    } else if (!JOIN.test(part)) end();
  }
  end();
  return runs;
}

/** The longest digit run, as a phone number would be read out. */
export const longestDigitRun = (folded: string) => digitRuns(folded).reduce((m, r) => Math.max(m, r.length), 0);
