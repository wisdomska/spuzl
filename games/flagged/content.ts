/**
 * Flagged data: countries with capital, currency and (only where the design is simple enough to draw
 * exactly) a flag. National flags are public domain designs; they are redrawn here as plain SVG from
 * their official proportions, with no coats of arms or seals. Countries whose capital is split or
 * disputed, or whose currency is shared or changing, leave that field out.
 * Needs owner review before scheduling (see /admin).
 */
export type Continent = "africa" | "europe" | "asia" | "americas" | "oceania";

export type Emblem =
  { type: "disc"; color: string; cx: number; cy: number; r: number } | { type: "star"; color: string; cx: number; cy: number; r: number };

/** w x h is the flag's official ratio, used as the SVG viewBox. */
export type FlagSpec = { w: number; h: number; emblems?: Emblem[] } & (
  | { kind: "h"; stripes: string[]; weights?: number[] }
  | { kind: "v"; stripes: string[]; weights?: number[] }
  /** Nordic cross: offsets from the hoist and top, in viewBox units. `inner` is a narrower cross on top. */
  | {
      kind: "nordic";
      field: string;
      cross: { color: string; x: number; y: number; t: number };
      inner?: { color: string; x: number; y: number; t: number };
    }
  /** Any flag built from plain rectangles and polygons, in viewBox units */
  | { kind: "shapes"; field: string; rects?: [number, number, number, number, string][]; polys?: [string, string][] }
);

export interface Country {
  name: string;
  continent: Continent;
  capital?: string;
  currency?: string;
  flag?: FlagSpec;
}

export const needsReview = true;

const RED = "#CE1126",
  GOLD = "#FCD116",
  WHITE = "#FFFFFF",
  BLACK = "#000000";
const h = (stripes: string[], weights?: number[], emblems?: Emblem[], w = 3, hh = 2): FlagSpec => ({
  kind: "h",
  stripes,
  weights,
  emblems,
  w,
  h: hh,
});
const v = (stripes: string[], emblems?: Emblem[], w = 3, hh = 2): FlagSpec => ({ kind: "v", stripes, emblems, w, h: hh });
const star = (color: string, cx: number, cy: number, r: number): Emblem => ({ type: "star", color, cx, cy, r });
const disc = (color: string, cx: number, cy: number, r: number): Emblem => ({ type: "disc", color, cx, cy, r });

export const CONTENT: Country[] = [
  // Africa
  {
    name: "Ghana",
    continent: "africa",
    capital: "Accra",
    currency: "Ghanaian cedi",
    flag: h([RED, GOLD, "#006B3F"], undefined, [star(BLACK, 1.5, 1, 0.33)]),
  },
  {
    name: "Nigeria",
    continent: "africa",
    capital: "Abuja",
    currency: "Nigerian naira",
    flag: v(["#008751", WHITE, "#008751"], undefined, 2, 1),
  },
  { name: "Kenya", continent: "africa", capital: "Nairobi", currency: "Kenyan shilling" },
  { name: "South Africa", continent: "africa", currency: "South African rand" },
  { name: "Egypt", continent: "africa", capital: "Cairo", currency: "Egyptian pound" },
  { name: "Morocco", continent: "africa", capital: "Rabat", currency: "Moroccan dirham" },
  { name: "Ethiopia", continent: "africa", capital: "Addis Ababa", currency: "Ethiopian birr" },
  {
    name: "Botswana",
    continent: "africa",
    capital: "Gaborone",
    currency: "Botswana pula",
    flag: h(["#75AADB", WHITE, BLACK, WHITE, "#75AADB"], [9, 1, 4, 1, 9]),
  },
  { name: "Zambia", continent: "africa", capital: "Lusaka", currency: "Zambian kwacha" },
  { name: "Malawi", continent: "africa", capital: "Lilongwe", currency: "Malawian kwacha" },
  {
    name: "Gambia",
    continent: "africa",
    capital: "Banjul",
    currency: "Gambian dalasi",
    flag: h([RED, WHITE, "#0C1C8C", WHITE, "#3A7728"], [6, 1, 4, 1, 6]),
  },
  {
    name: "Sierra Leone",
    continent: "africa",
    capital: "Freetown",
    currency: "Sierra Leonean leone",
    flag: h(["#1EB53A", WHITE, "#0072C6"]),
  },
  { name: "Liberia", continent: "africa", capital: "Monrovia", currency: "Liberian dollar" },
  { name: "Guinea", continent: "africa", capital: "Conakry", currency: "Guinean franc", flag: v([RED, GOLD, "#009460"]) },
  {
    name: "Senegal",
    continent: "africa",
    capital: "Dakar",
    currency: "West African CFA franc",
    flag: v(["#00853F", "#FDEF42", "#E31B23"], [star("#00853F", 1.5, 1, 0.35)]),
  },
  {
    name: "Cote d'Ivoire",
    continent: "africa",
    capital: "Yamoussoukro",
    currency: "West African CFA franc",
    flag: v(["#F77F00", WHITE, "#009E60"]),
  },
  { name: "Mali", continent: "africa", capital: "Bamako", currency: "West African CFA franc", flag: v(["#14B53A", GOLD, RED]) },
  {
    name: "Burkina Faso",
    continent: "africa",
    capital: "Ouagadougou",
    currency: "West African CFA franc",
    flag: h(["#EF2B2D", "#009E49"], undefined, [star(GOLD, 1.5, 1, 0.33)]),
  },
  {
    name: "Niger",
    continent: "africa",
    capital: "Niamey",
    currency: "West African CFA franc",
    flag: h(["#E05206", WHITE, "#0DB02B"], undefined, [disc("#E05206", 3.5, 3, 0.85)], 7, 6),
  },
  {
    name: "Benin",
    continent: "africa",
    currency: "West African CFA franc",
    flag: {
      kind: "shapes",
      w: 3,
      h: 2,
      field: "#E8112D",
      rects: [
        [0, 0, 3, 1, GOLD],
        [0, 0, 1.2, 2, "#008751"],
      ],
    },
  },
  { name: "Togo", continent: "africa", capital: "Lome", currency: "West African CFA franc" },
  {
    name: "Guinea-Bissau",
    continent: "africa",
    capital: "Bissau",
    currency: "West African CFA franc",
    flag: {
      kind: "shapes",
      w: 2,
      h: 1,
      field: "#009E49",
      rects: [
        [0, 0, 2, 0.5, GOLD],
        [0, 0, 2 / 3, 1, RED],
      ],
      emblems: [star(BLACK, 1 / 3, 0.5, 0.2)],
    },
  },
  {
    name: "Cameroon",
    continent: "africa",
    capital: "Yaounde",
    currency: "Central African CFA franc",
    flag: v(["#007A5E", RED, GOLD], [star(GOLD, 1.5, 1, 0.35)]),
  },
  {
    name: "Gabon",
    continent: "africa",
    capital: "Libreville",
    currency: "Central African CFA franc",
    flag: h(["#009E60", GOLD, "#3A75C4"], undefined, undefined, 4, 3),
  },
  { name: "Angola", continent: "africa", capital: "Luanda", currency: "Angolan kwanza" },
  { name: "Mozambique", continent: "africa", capital: "Maputo", currency: "Mozambican metical" },
  {
    name: "Madagascar",
    continent: "africa",
    capital: "Antananarivo",
    currency: "Malagasy ariary",
    flag: {
      kind: "shapes",
      w: 3,
      h: 2,
      field: "#007E3A",
      rects: [
        [0, 0, 3, 1, "#FC3D32"],
        [0, 0, 1, 2, WHITE],
      ],
    },
  },
  {
    name: "Mauritius",
    continent: "africa",
    capital: "Port Louis",
    currency: "Mauritian rupee",
    flag: h(["#EA2839", "#1A206D", "#FFD500", "#00A551"]),
  },
  { name: "Tanzania", continent: "africa", capital: "Dodoma", currency: "Tanzanian shilling" },
  { name: "Uganda", continent: "africa", capital: "Kampala", currency: "Ugandan shilling" },
  { name: "Rwanda", continent: "africa", capital: "Kigali", currency: "Rwandan franc" },
  {
    name: "Somalia",
    continent: "africa",
    capital: "Mogadishu",
    currency: "Somali shilling",
    flag: { kind: "shapes", w: 3, h: 2, field: "#4189DD", emblems: [star(WHITE, 1.5, 1, 0.5)] },
  },
  { name: "Namibia", continent: "africa", capital: "Windhoek", currency: "Namibian dollar" },
  { name: "Algeria", continent: "africa", capital: "Algiers", currency: "Algerian dinar" },
  { name: "Tunisia", continent: "africa", capital: "Tunis", currency: "Tunisian dinar" },
  { name: "Cape Verde", continent: "africa", capital: "Praia", currency: "Cape Verdean escudo" },
  { name: "Mauritania", continent: "africa", capital: "Nouakchott", currency: "Mauritanian ouguiya" },
  // Europe
  { name: "France", continent: "europe", capital: "Paris", currency: "Euro", flag: v(["#002395", WHITE, "#ED2939"]) },
  { name: "Italy", continent: "europe", capital: "Rome", currency: "Euro", flag: v(["#009246", WHITE, "#CE2B37"]) },
  { name: "Ireland", continent: "europe", capital: "Dublin", currency: "Euro", flag: v(["#169B62", WHITE, "#FF883E"], undefined, 2, 1) },
  {
    name: "Belgium",
    continent: "europe",
    capital: "Brussels",
    currency: "Euro",
    flag: v([BLACK, "#FDDA24", "#EF3340"], undefined, 15, 13),
  },
  {
    name: "Germany",
    continent: "europe",
    capital: "Berlin",
    currency: "Euro",
    flag: h([BLACK, "#DD0000", "#FFCE00"], undefined, undefined, 5, 3),
  },
  { name: "Netherlands", continent: "europe", currency: "Euro", flag: h(["#AE1C28", WHITE, "#21468B"]) },
  { name: "Austria", continent: "europe", capital: "Vienna", currency: "Euro", flag: h(["#ED2939", WHITE, "#ED2939"]) },
  {
    name: "Hungary",
    continent: "europe",
    capital: "Budapest",
    currency: "Hungarian forint",
    flag: h(["#CE2939", WHITE, "#477050"], undefined, undefined, 2, 1),
  },
  {
    name: "Estonia",
    continent: "europe",
    capital: "Tallinn",
    currency: "Euro",
    flag: h(["#0072CE", BLACK, WHITE], undefined, undefined, 11, 7),
  },
  {
    name: "Lithuania",
    continent: "europe",
    capital: "Vilnius",
    currency: "Euro",
    flag: h(["#FDB913", "#006A44", "#C1272D"], undefined, undefined, 5, 3),
  },
  {
    name: "Latvia",
    continent: "europe",
    capital: "Riga",
    currency: "Euro",
    flag: h(["#9E3039", WHITE, "#9E3039"], [2, 1, 2], undefined, 2, 1),
  },
  { name: "Ukraine", continent: "europe", capital: "Kyiv", currency: "Ukrainian hryvnia", flag: h(["#0057B7", "#FFD700"]) },
  {
    name: "Poland",
    continent: "europe",
    capital: "Warsaw",
    currency: "Polish zloty",
    flag: h([WHITE, "#DC143C"], undefined, undefined, 8, 5),
  },
  { name: "Bulgaria", continent: "europe", capital: "Sofia", flag: h([WHITE, "#00966E", "#D62612"], undefined, undefined, 5, 3) },
  {
    name: "Armenia",
    continent: "europe",
    capital: "Yerevan",
    currency: "Armenian dram",
    flag: h(["#D90012", "#0033A0", "#F2A800"], undefined, undefined, 2, 1),
  },
  {
    name: "Sweden",
    continent: "europe",
    capital: "Stockholm",
    currency: "Swedish krona",
    flag: { kind: "nordic", w: 16, h: 10, field: "#006AA7", cross: { color: "#FECC00", x: 5, y: 4, t: 2 } },
  },
  {
    name: "Denmark",
    continent: "europe",
    capital: "Copenhagen",
    currency: "Danish krone",
    flag: { kind: "nordic", w: 37, h: 28, field: "#C8102E", cross: { color: WHITE, x: 12, y: 12, t: 4 } },
  },
  {
    name: "Finland",
    continent: "europe",
    capital: "Helsinki",
    currency: "Euro",
    flag: { kind: "nordic", w: 18, h: 11, field: WHITE, cross: { color: "#002F6C", x: 5, y: 4, t: 3 } },
  },
  {
    name: "Norway",
    continent: "europe",
    capital: "Oslo",
    currency: "Norwegian krone",
    flag: {
      kind: "nordic",
      w: 22,
      h: 16,
      field: "#BA0C2F",
      cross: { color: WHITE, x: 6, y: 6, t: 4 },
      inner: { color: "#00205B", x: 7, y: 7, t: 2 },
    },
  },
  {
    name: "Iceland",
    continent: "europe",
    capital: "Reykjavik",
    currency: "Icelandic krona",
    flag: {
      kind: "nordic",
      w: 25,
      h: 18,
      field: "#02529C",
      cross: { color: WHITE, x: 7, y: 7, t: 4 },
      inner: { color: "#DC1E35", x: 8, y: 8, t: 2 },
    },
  },
  {
    name: "Switzerland",
    continent: "europe",
    currency: "Swiss franc",
    flag: {
      kind: "shapes",
      w: 32,
      h: 32,
      field: "#DA291C",
      rects: [
        [6, 13, 20, 6, WHITE],
        [13, 6, 6, 20, WHITE],
      ],
    },
  },
  {
    name: "Czechia",
    continent: "europe",
    capital: "Prague",
    currency: "Czech koruna",
    flag: { kind: "shapes", w: 3, h: 2, field: WHITE, rects: [[0, 1, 3, 1, "#D7141A"]], polys: [["0,0 1.5,1 0,2", "#11457E"]] },
  },
  { name: "Portugal", continent: "europe", capital: "Lisbon", currency: "Euro" },
  { name: "Spain", continent: "europe", capital: "Madrid", currency: "Euro" },
  { name: "Greece", continent: "europe", capital: "Athens", currency: "Euro" },
  { name: "United Kingdom", continent: "europe", capital: "London", currency: "Pound sterling" },
  // Asia
  {
    name: "Japan",
    continent: "asia",
    capital: "Tokyo",
    currency: "Japanese yen",
    flag: { kind: "shapes", w: 3, h: 2, field: WHITE, emblems: [disc("#BC002D", 1.5, 1, 0.6)] },
  },
  {
    name: "Bangladesh",
    continent: "asia",
    capital: "Dhaka",
    currency: "Bangladeshi taka",
    flag: { kind: "shapes", w: 10, h: 6, field: "#006A4E", emblems: [disc("#F42A41", 4.5, 3, 2)] },
  },
  {
    name: "Laos",
    continent: "asia",
    capital: "Vientiane",
    currency: "Lao kip",
    flag: h([RED, "#002868", RED], [1, 2, 1], [disc(WHITE, 1.5, 1, 0.4)]),
  },
  {
    name: "Vietnam",
    continent: "asia",
    capital: "Hanoi",
    currency: "Vietnamese dong",
    flag: { kind: "shapes", w: 3, h: 2, field: "#DA251D", emblems: [star("#FFFF00", 1.5, 1, 0.6)] },
  },
  {
    name: "Thailand",
    continent: "asia",
    capital: "Bangkok",
    currency: "Thai baht",
    flag: h(["#A51931", "#F4F5F8", "#2D2A4A", "#F4F5F8", "#A51931"], [1, 1, 2, 1, 1]),
  },
  { name: "Indonesia", continent: "asia", capital: "Jakarta", currency: "Indonesian rupiah", flag: h(["#FF0000", WHITE]) },
  { name: "India", continent: "asia", capital: "New Delhi", currency: "Indian rupee" },
  { name: "South Korea", continent: "asia", capital: "Seoul", currency: "South Korean won" },
  { name: "Malaysia", continent: "asia", capital: "Kuala Lumpur", currency: "Malaysian ringgit" },
  { name: "Philippines", continent: "asia", capital: "Manila", currency: "Philippine peso" },
  { name: "Pakistan", continent: "asia", capital: "Islamabad", currency: "Pakistani rupee" },
  { name: "Mongolia", continent: "asia", capital: "Ulaanbaatar", currency: "Mongolian togrog" },
  { name: "Saudi Arabia", continent: "asia", capital: "Riyadh", currency: "Saudi riyal" },
  { name: "United Arab Emirates", continent: "asia", capital: "Abu Dhabi", currency: "UAE dirham" },
  { name: "Nepal", continent: "asia", capital: "Kathmandu", currency: "Nepalese rupee" },
  { name: "Cambodia", continent: "asia", capital: "Phnom Penh", currency: "Cambodian riel" },
  // Americas
  { name: "Peru", continent: "americas", capital: "Lima", currency: "Peruvian sol", flag: v(["#D91023", WHITE, "#D91023"]) },
  { name: "Colombia", continent: "americas", capital: "Bogota", currency: "Colombian peso", flag: h([GOLD, "#003893", RED], [2, 1, 1]) },
  {
    name: "Chile",
    continent: "americas",
    capital: "Santiago",
    currency: "Chilean peso",
    flag: {
      kind: "shapes",
      w: 3,
      h: 2,
      field: WHITE,
      rects: [
        [0, 1, 3, 1, "#D52B1E"],
        [0, 0, 1, 1, "#0039A6"],
      ],
      emblems: [star(WHITE, 0.5, 0.5, 0.25)],
    },
  },
  {
    name: "Panama",
    continent: "americas",
    capital: "Panama City",
    flag: {
      kind: "shapes",
      w: 3,
      h: 2,
      field: WHITE,
      rects: [
        [1.5, 0, 1.5, 1, "#D21034"],
        [0, 1, 1.5, 1, "#005293"],
      ],
      emblems: [star("#005293", 0.75, 0.5, 0.25), star("#D21034", 2.25, 1.5, 0.25)],
    },
  },
  {
    name: "Jamaica",
    continent: "americas",
    capital: "Kingston",
    currency: "Jamaican dollar",
    flag: {
      kind: "shapes",
      w: 2,
      h: 1,
      field: BLACK,
      polys: [
        ["0,0 2,0 1,0.5", "#009B3A"],
        ["0,1 2,1 1,0.5", "#009B3A"],
        ["0,0 0.17,0 2,0.92 2,1 1.83,1 0,0.08", "#FED100"],
        ["2,0 2,0.08 0.17,1 0,1 0,0.92 1.83,0", "#FED100"],
      ],
    },
  },
  { name: "Mexico", continent: "americas", capital: "Mexico City", currency: "Mexican peso" },
  { name: "Brazil", continent: "americas", capital: "Brasilia", currency: "Brazilian real" },
  { name: "Argentina", continent: "americas", capital: "Buenos Aires", currency: "Argentine peso" },
  { name: "Canada", continent: "americas", capital: "Ottawa", currency: "Canadian dollar" },
  { name: "United States", continent: "americas", capital: "Washington, D.C.", currency: "US dollar" },
  { name: "Cuba", continent: "americas", capital: "Havana", currency: "Cuban peso" },
  // Oceania
  { name: "Australia", continent: "oceania", capital: "Canberra", currency: "Australian dollar" },
  { name: "New Zealand", continent: "oceania", capital: "Wellington", currency: "New Zealand dollar" },
  { name: "Fiji", continent: "oceania", capital: "Suva", currency: "Fijian dollar" },
  { name: "Papua New Guinea", continent: "oceania", capital: "Port Moresby", currency: "Papua New Guinean kina" },
];
