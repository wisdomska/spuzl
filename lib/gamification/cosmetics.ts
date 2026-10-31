/** Shop catalogue (SRS 4.6). Sparks only buy cosmetics and Freezes, never ranked advantages. */
export interface CosmeticDef {
  id: string;
  type: "skin" | "hat" | "board_theme" | "title" | "frame" | "freeze" | "hint_pack";
  name: string;
  price: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  payload: Record<string, string | number>;
  unlockLevel?: number;
}

/** Board themes: the backdrop and frame around a game board. Cells keep their game colours (they carry meaning). */
export const BOARD_THEMES: Record<string, { bg: string; cell: string; mark: string }> = {
  midnight: { bg: "#0A0B1E", cell: "#1B1E3A", mark: "#8B7CFF" },
  sand: { bg: "#C9A66B", cell: "#E8D3A6", mark: "#B4520F" },
  neon: { bg: "#07070C", cell: "#14142A", mark: "#B8F23A" },
};

export const COSMETICS: CosmeticDef[] = [
  { id: "freeze", type: "freeze", name: "Streak Freeze", price: 200, rarity: "common", payload: { icon: "snowflake" } },
  { id: "hint-pack-5", type: "hint_pack", name: "Free play hint pack", price: 50, rarity: "common", payload: { hints: 5 } },
  { id: "skin-lime", type: "skin", name: "Classic Lime", price: 0, rarity: "common", payload: { color: "#B8F23A" } },
  { id: "skin-cyan", type: "skin", name: "Lagoon", price: 150, rarity: "common", payload: { color: "#2FD3E0" } },
  { id: "skin-gold", type: "skin", name: "Gold Rush", price: 400, rarity: "rare", payload: { color: "#FFC93C" } },
  { id: "skin-orange", type: "skin", name: "Jollof", price: 250, rarity: "common", payload: { color: "#FF8A3D" } },
  { id: "skin-violet", type: "skin", name: "Ultraviolet", price: 400, rarity: "rare", payload: { color: "#8B7CFF" } },
  { id: "skin-pink", type: "skin", name: "Bubblegum", price: 400, rarity: "rare", payload: { color: "#F27ADB" } },
  { id: "skin-prism", type: "skin", name: "Prism", price: 800, rarity: "legendary", payload: { color: "#B8F23A", effect: "prism" } },
  { id: "hat-party", type: "hat", name: "Party Hat", price: 300, rarity: "rare", payload: { hat: "party" } },
  { id: "hat-crown", type: "hat", name: "Tiny Crown", price: 600, rarity: "epic", payload: { hat: "crown" } },
  { id: "hat-kente", type: "hat", name: "Kente Cap", price: 500, rarity: "epic", payload: { hat: "kente" } },
  { id: "hat-shades", type: "hat", name: "Shades", price: 350, rarity: "rare", payload: { hat: "shades" } },
  { id: "hat-headphones", type: "hat", name: "Headphones", price: 400, rarity: "rare", payload: { hat: "headphones" } },
  { id: "hat-chef", type: "hat", name: "Chef Hat", price: 450, rarity: "epic", payload: { hat: "chef" } },
  { id: "theme-midnight", type: "board_theme", name: "Midnight board", price: 300, rarity: "common", payload: { theme: "midnight" } },
  { id: "theme-sand", type: "board_theme", name: "Sandstone board", price: 600, rarity: "rare", payload: { theme: "sand" } },
  { id: "theme-neon", type: "board_theme", name: "Neon board", price: 1000, rarity: "epic", payload: { theme: "neon" } },
  { id: "title-thinker", type: "title", name: "The Thinker", price: 0, rarity: "common", payload: {}, unlockLevel: 5 },
  { id: "title-sparkplug", type: "title", name: "Spark Plug", price: 0, rarity: "rare", payload: {}, unlockLevel: 10 },
  { id: "title-gridlord", type: "title", name: "Grid Lord", price: 0, rarity: "epic", payload: {}, unlockLevel: 25 },
];
