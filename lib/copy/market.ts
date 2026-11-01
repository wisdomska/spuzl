/** Player-facing copy for Market Run (games/market): a Makola market shopping puzzle in cedis. */

export type ItemKey =
  "kenkey" | "yam" | "plantain" | "tomato" | "onion" | "egg" | "bread" | "gari" | "fish" | "orange" | "shito" | "gardenEgg";

/** Item names: one, many. */
export const MARKET_ITEMS: Record<ItemKey, [string, string]> = {
  kenkey: ["kenkey ball", "kenkey balls"],
  yam: ["yam", "yams"],
  plantain: ["plantain", "plantains"],
  tomato: ["tomato tin", "tomato tins"],
  onion: ["onion", "onions"],
  egg: ["egg", "eggs"],
  bread: ["sugar bread", "sugar breads"],
  gari: ["bag of gari", "bags of gari"],
  fish: ["smoked fish", "smoked fish"],
  orange: ["orange", "oranges"],
  shito: ["jar of shito", "jars of shito"],
  gardenEgg: ["garden egg", "garden eggs"],
};

const cedis = (n: number) => `GH₵ ${n}`;
const name = (k: ItemKey, n: number) => MARKET_ITEMS[k][n === 1 ? 0 : 1];
const count = (k: ItemKey, n: number) => `${n} ${name(k, n)}`;

export const market = {
  cedis,
  name,
  count,
  many: (k: ItemKey) => MARKET_ITEMS[k][1],

  /* Board */
  board: "Market Run basket",
  list: "Shopping list",
  rules: "The list says",
  cash: (n: number) => `Cash ${cedis(n)}`,
  bringBack: (n: number) => `Bring back ${cedis(n)} change`,
  basket: (n: number) => `Basket ${cedis(n)}`,
  changeNow: (n: number) => (n < 0 ? `Short by ${cedis(-n)}` : `Change ${cedis(n)}`),
  each: (p: number) => `${cedis(p)} each`,
  deal: "Buy 3, get 1 free",
  dealShort: "3 + 1 free",
  subtotal: (n: number) => cedis(n),
  row: (r: number, k: ItemKey, price: number, deal: boolean, qty: number | null) =>
    `Row ${r}, column 1, ${MARKET_ITEMS[k][1]}, ${cedis(price)} each${deal ? ", buy 3 get 1 free" : ""}, ${qty === null ? "empty" : `${qty} in the basket`}`,
  pad: "Number pad",
  number: (d: number) => `Number ${d}`,
  erase: "Erase",
  undo: "Undo",
  hintLabel: "Hint",
  ruleOk: "kept",
  ruleBroken: "broken",
  ruleOpen: "not settled yet",

  /* Rules (clues) */
  clue: {
    spend: (cash: number, change: number) => `Pay from ${cedis(cash)} and bring back exactly ${cedis(change)}.`,
    min: (k: ItemKey, n: number) => `At least ${count(k, n)}.`,
    max: (k: ItemKey, n: number) => `No more than ${count(k, n)}.`,
    more: (a: ItemKey, b: ItemKey) => `More ${MARKET_ITEMS[a][1]} than ${MARKET_ITEMS[b][1]}.`,
    same: (a: ItemKey, b: ItemKey) => `As many ${MARKET_ITEMS[a][1]} as ${MARKET_ITEMS[b][1]}.`,
    twice: (a: ItemKey, b: ItemKey) => `Twice as many ${MARKET_ITEMS[a][1]} as ${MARKET_ITEMS[b][1]}.`,
    count: (n: number) => `${n} things in the basket in all, free ones too.`,
  },

  /* Feedback */
  start: "Tap an item, then a number. Hit the change exactly.",
  startTutorial: "Tap an item on the list, then tap how many to buy. Every rule must hold.",
  pickFirst: "Tap an item on the list first.",
  set: (k: ItemKey, n: number, basket: number) => `${count(k, n)}. Basket ${cedis(basket)}.`,
  over: (basket: number, spend: number) => `That basket costs ${cedis(basket)}, more than the ${cedis(spend)} you can spend.`,
  notYet: (rule: string) => `Not yet. This one breaks: ${rule}`,
  cleared: (change: number) => `Basket done, ${cedis(change)} change. Medaase!`,
  erased: (k: ItemKey) => `${MARKET_ITEMS[k][1]} cleared`,
  undone: "Undone",

  /* Server hints: one deduction with a reason */
  hint: {
    wrong: (k: ItemKey, n: number) => `${count(k, n)} does not fit the list. Clear it and look again.`,
    last: (k: ItemKey, left: number, n: number, deal: boolean) =>
      `After the rest you have ${cedis(left)} left, which buys exactly ${count(k, n)}${deal ? " with the free one" : ""}.`,
    same: (k: ItemKey, other: ItemKey, n: number) => `As many as the ${MARKET_ITEMS[other][1]}, so ${count(k, n)}.`,
    twice: (k: ItemKey, other: ItemKey, n: number) => `Twice the ${MARKET_ITEMS[other][1]}, so ${count(k, n)}.`,
    half: (k: ItemKey, other: ItemKey, n: number) => `Half the ${MARKET_ITEMS[other][1]}, so ${count(k, n)}.`,
    afford: (k: ItemKey, n: number) =>
      `The list wants at least ${n}, and even with the least of everything else you can only afford ${count(k, n)}.`,
    money1: (k: ItemKey, n: number, change: number) =>
      `To bring back exactly ${cedis(change)}, the only count that works is ${count(k, n)}.`,
    money: (k: ItemKey, options: number[], n: number) =>
      `The money only works with ${options.slice(0, -1).join(", ")} or ${options[options.length - 1]} ${MARKET_ITEMS[k][1]}, and the rules leave ${n}.`,
    only: (k: ItemKey, n: number, change: number) =>
      `Try ${count(k, n)}: it is the only count that keeps every rule with ${cedis(change)} change.`,
  },
};
