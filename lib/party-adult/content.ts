/**
 * Draw It word list (18+ party mode, but the words themselves are family-safe): things anyone can sketch in
 * 80 seconds, with Ghanaian everyday items first. Every word is checked against the party text filter in a
 * unit test, so a word can never be one players are refused for typing.
 *
 * `alt` lists other spellings or names a guesser may type for the same thing (compared after normalising:
 * lower case, letters and digits only).
 */
export interface DrawWord {
  word: string;
  alt?: string[];
}

export const DRAW_WORDS: readonly DrawWord[] = [
  // Ghana: food, dress, places and everyday life
  { word: "banku" },
  { word: "kenkey", alt: ["dokon"] },
  { word: "jollof", alt: ["jollof rice"] },
  { word: "fufu" },
  { word: "kelewele" },
  { word: "waakye" },
  { word: "plantain", alt: ["kokoo", "plantains"] },
  { word: "groundnut", alt: ["peanut", "groundnuts", "peanuts"] },
  { word: "kente", alt: ["kente cloth"] },
  { word: "trotro", alt: ["tro tro"] },
  { word: "okada", alt: ["motorbike", "motorcycle"] },
  { word: "talking drum", alt: ["drum"] },
  { word: "adinkra", alt: ["adinkra symbol"] },
  { word: "cocoa pod", alt: ["cocoa", "cacao"] },
  { word: "coconut" },
  { word: "mango" },
  { word: "pineapple" },
  { word: "yam" },
  { word: "cassava" },
  { word: "pepper", alt: ["chilli", "chili", "pepper fruit"] },
  { word: "coal pot", alt: ["charcoal pot", "coalpot"] },
  { word: "fan ice", alt: ["fanice", "ice cream"] },
  { word: "sachet water", alt: ["pure water", "water sachet"] },
  { word: "black star", alt: ["star"] },
  { word: "football", alt: ["soccer ball", "ball"] },
  { word: "goalkeeper", alt: ["keeper", "goalie"] },
  { word: "market" },
  { word: "canoe", alt: ["boat"] },
  { word: "lighthouse" },
  { word: "castle", alt: ["fort"] },
  { word: "harmattan", alt: ["dust"] },
  { word: "umbrella" },
  { word: "head pan", alt: ["headpan", "basin"] },
  { word: "broom" },
  { word: "chalkboard", alt: ["blackboard"] },
  { word: "school bag", alt: ["backpack", "bag"] },
  { word: "uniform" },
  { word: "funeral cloth", alt: ["cloth"] },
  { word: "palm tree", alt: ["palm"] },
  { word: "baobab", alt: ["tree"] },
  { word: "lizard", alt: ["agama"] },
  { word: "goat" },
  { word: "chicken", alt: ["hen", "fowl"] },
  { word: "guinea fowl" },
  // Everyday things
  { word: "phone", alt: ["mobile phone", "cellphone"] },
  { word: "television", alt: ["tv"] },
  { word: "radio" },
  { word: "bicycle", alt: ["bike"] },
  { word: "bus" },
  { word: "aeroplane", alt: ["airplane", "plane"] },
  { word: "rocket" },
  { word: "bridge" },
  { word: "house", alt: ["home"] },
  { word: "door" },
  { word: "window" },
  { word: "ladder" },
  { word: "key" },
  { word: "clock" },
  { word: "glasses", alt: ["spectacles"] },
  { word: "hat", alt: ["cap"] },
  { word: "shoe", alt: ["shoes", "sneaker"] },
  { word: "slippers", alt: ["flip flops", "charlie wote", "chale wote"] },
  { word: "candle" },
  { word: "lamp", alt: ["light bulb", "bulb"] },
  { word: "book" },
  { word: "pencil", alt: ["pen"] },
  { word: "scissors" },
  { word: "guitar" },
  { word: "piano", alt: ["keyboard"] },
  { word: "camera" },
  { word: "kite" },
  { word: "balloon" },
  { word: "birthday cake", alt: ["cake"] },
  { word: "cup", alt: ["mug"] },
  { word: "spoon" },
  { word: "bread" },
  { word: "egg" },
  { word: "banana" },
  { word: "orange" },
  { word: "watermelon" },
  { word: "rain", alt: ["raining"] },
  { word: "rainbow" },
  { word: "sun", alt: ["sunshine"] },
  { word: "moon" },
  { word: "cloud" },
  { word: "mountain", alt: ["hill"] },
  { word: "river" },
  { word: "beach", alt: ["seaside", "sea"] },
  { word: "fish" },
  { word: "crab" },
  { word: "turtle", alt: ["tortoise"] },
  { word: "elephant" },
  { word: "lion" },
  { word: "giraffe" },
  { word: "monkey" },
  { word: "snail" },
  { word: "butterfly" },
  { word: "spider" },
  { word: "dog", alt: ["puppy"] },
  { word: "cat", alt: ["kitten"] },
  { word: "robot" },
  { word: "crown" },
  { word: "snowman" },
  { word: "tent" },
  { word: "rocket ship", alt: ["spaceship"] },
];

// Combining accents left by NFKD.
const MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** lower case, letters and digits only, single spaces: "Fan-Ice!" and "fan ice" compare equal. */
export function normaliseWord(s: string): string {
  return s
    .normalize("NFKD")
    .replace(MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Same as normaliseWord, without spaces ("tro tro" and "trotro" match). */
export const squashWord = (s: string) => normaliseWord(s).replace(/ /g, "");
