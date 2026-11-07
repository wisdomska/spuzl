import type { QuickfireItem } from "./content";

/**
 * 6 March Quiz (R2-P5 seasonal template "Ghana Independence Day"): 20 Ghana history questions for Quickfire,
 * played as four rounds of five while an event that features the set ("quiz": "ghana-1957") is live. Original
 * wording for SPUZL. Dates, places and people only, each a widely agreed fact; nothing contested and nothing about
 * present-day politics. Each row names its source; every fact was checked against at least one of:
 *
 *   - Encyclopaedia Britannica: "Ghana" (history: Gold Coast colony, 1948 riots and the Big Six, the 1951 election,
 *     independence on 6 March 1957, the republic on 1 July 1960, the Ghana-Guinea Union of 1958), "Kwame Nkrumah",
 *     "Convention People's Party", "Osei Tutu", "Yaa Asantewaa", "Togoland" (1956 plebiscite), "Tetteh Quarshie".
 *   - Government of Ghana portal (ghana.gov.gh), "National symbols": the flag (Theodosia Okoh; red, gold and green
 *     with a black star), the coat of arms (Amon Kotei; motto "Freedom and Justice"), the national anthem (music by
 *     Philip Gbeho).
 *   - Bank of Ghana, "History of the cedi": the cedi replaced the Ghana pound in July 1965.
 *   - University of Ghana, "Our history": founded in 1948 as the University College of the Gold Coast.
 *   - United Nations Trusteeship Council records: the British Togoland plebiscite of 9 May 1956.
 *
 * Wrong options are real names, places or years, never jokes, so a guess teaches something too. Owner review
 * applies as for the main bank (content.ts `needsReview`).
 */

type Row = [1 | 2 | 3, string, string, string, string, string, string];

const ROWS: Row[] = [
  // Round 1: independence
  [
    1,
    "On what date did Ghana become independent?",
    "6 March 1957",
    "1 July 1960",
    "24 February 1966",
    "7 January 1993",
    "Britannica, Ghana: independence",
  ],
  [1, "What was Ghana called before independence?", "Gold Coast", "Slave Coast", "Ivory Coast", "Grain Coast", "Britannica, Gold Coast"],
  [
    1,
    "Who led Ghana to independence and became its first president?",
    "Kwame Nkrumah",
    "J. B. Danquah",
    "Kofi Busia",
    "Ebenezer Ako-Adjei",
    "Britannica, Kwame Nkrumah",
  ],
  [
    2,
    "On what date did Ghana become a republic?",
    "1 July 1960",
    "6 March 1957",
    "13 January 1972",
    "24 September 1979",
    "Britannica, Ghana: the republic, 1960",
  ],
  [
    1,
    "Which country ruled the Gold Coast colony until independence?",
    "Britain",
    "France",
    "Portugal",
    "Germany",
    "Britannica, Gold Coast",
  ],
  // Round 2: national symbols
  [
    2,
    "Who designed Ghana's national flag?",
    "Theodosia Okoh",
    "Efua Sutherland",
    "Amon Kotei",
    "Ephraim Amu",
    "Government of Ghana, national symbols: the flag",
  ],
  [
    3,
    "Who designed Ghana's coat of arms?",
    "Amon Kotei",
    "Theodosia Okoh",
    "Kofi Antubam",
    "Philip Gbeho",
    "Government of Ghana, national symbols: coat of arms",
  ],
  [
    1,
    "What sits at the centre of Ghana's flag?",
    "A black star",
    "A golden eagle",
    "A red sun",
    "A green palm",
    "Government of Ghana, national symbols: the flag",
  ],
  [
    1,
    "What are the colours of Ghana's flag, top to bottom?",
    "Red, gold, green",
    "Green, gold, red",
    "Gold, red, green",
    "Red, green, gold",
    "Government of Ghana, national symbols: the flag",
  ],
  [
    2,
    "What is the motto on Ghana's coat of arms?",
    "Freedom and Justice",
    "Unity and Progress",
    "Peace and Plenty",
    "One People, One Nation",
    "Government of Ghana, national symbols: coat of arms",
  ],
  // Round 3: the road to 1957
  [
    3,
    "Who composed the music of Ghana's national anthem?",
    "Philip Gbeho",
    "Ephraim Amu",
    "E. T. Mensah",
    "J. H. Kwabena Nketia",
    "Government of Ghana, national symbols: national anthem",
  ],
  [
    2,
    "In which year were the Big Six arrested after the Accra riots?",
    "1948",
    "1951",
    "1957",
    "1945",
    "Britannica, Ghana: the 1948 riots and the Big Six",
  ],
  [
    2,
    "In which year did Kwame Nkrumah found the Convention People's Party?",
    "1949",
    "1947",
    "1954",
    "1960",
    "Britannica, Convention People's Party",
  ],
  [
    3,
    "In which year did the Gold Coast hold the general election that made Nkrumah Leader of Government Business?",
    "1951",
    "1948",
    "1956",
    "1957",
    "Britannica, Kwame Nkrumah: 1951 election",
  ],
  [
    3,
    "In 1956, which territory voted to join the Gold Coast and became part of Ghana?",
    "British Togoland",
    "French Togoland",
    "Upper Volta",
    "Northern Nigeria",
    "UN Trusteeship Council, British Togoland plebiscite, 9 May 1956",
  ],
  // Round 4: people and places
  [
    1,
    "Who led the 1900 War of the Golden Stool against British rule?",
    "Yaa Asantewaa",
    "Okomfo Anokye",
    "Prempeh I",
    "Osei Tutu",
    "Britannica, Yaa Asantewaa",
  ],
  [
    2,
    "Who founded the Asante Kingdom together with the priest Okomfo Anokye?",
    "Osei Tutu",
    "Opoku Ware",
    "Prempeh I",
    "Kwaku Dua",
    "Britannica, Osei Tutu",
  ],
  [
    1,
    "Tetteh Quarshie is remembered for bringing which crop to the Gold Coast in 1879?",
    "Cocoa",
    "Coffee",
    "Cassava",
    "Rubber",
    "Britannica, Tetteh Quarshie",
  ],
  [
    2,
    "The University of Ghana began in 1948 under which name?",
    "University College of the Gold Coast",
    "Achimota College",
    "Kumasi College of Technology",
    "Fourah Bay College",
    "University of Ghana, our history",
  ],
  [
    2,
    "In which year was the cedi first introduced as Ghana's currency?",
    "1965",
    "1957",
    "1960",
    "1972",
    "Bank of Ghana, history of the cedi",
  ],
];

/** The set as Quickfire items (ids gh1 to gh20), in round order. */
export const GHANA_HISTORY: QuickfireItem[] = ROWS.map(([level, q, answer, w1, w2, w3, source], i) => ({
  id: `gh${i + 1}`,
  cat: "africa",
  level,
  q,
  answer,
  wrong: [w1, w2, w3],
  source,
}));
