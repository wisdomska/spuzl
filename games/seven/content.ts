/**
 * Seven letter sets. Curated from the word list: each set has at least one Spuzl word (a common word using
 * all seven letters, shown here for review) and 18 to 55 answers. No S, so plurals never pad the list.
 * Answers come from games/_shared/words at runtime.
 */
export interface SevenEntry {
  /** the required centre letter */
  centre: string;
  /** the six outer letters */
  letters: string;
  /** a Spuzl word for the editor (not sent to players) */
  pangram: string;
}

export const needsReview = true;

export const CONTENT: SevenEntry[] = [
  { centre: "E", letters: "FNQRTU", pangram: "FREQUENT" },
  { centre: "C", letters: "GHIKNO", pangram: "CHOKING" },
  { centre: "H", letters: "DEILRT", pangram: "THRILLED" },
  { centre: "A", letters: "CEGINO", pangram: "CANOEING" },
  { centre: "I", letters: "DHLNOP", pangram: "DOLPHIN" },
  { centre: "N", letters: "GORTUW", pangram: "OUTGROWN" },
  { centre: "C", letters: "ENOQRU", pangram: "CONQUER" },
  { centre: "D", letters: "GINOPR", pangram: "DROOPING" },
  { centre: "C", letters: "EHIPRT", pangram: "PITCHER" },
  { centre: "I", letters: "DEJNRU", pangram: "INJURED" },
  { centre: "H", letters: "AGINPR", pangram: "HARPING" },
  { centre: "C", letters: "EGINOR", pangram: "COERCING" },
  { centre: "A", letters: "CEIOTV", pangram: "EVOCATIVE" },
  { centre: "Y", letters: "ADEGRT", pangram: "TRAGEDY" },
  { centre: "A", letters: "CEHIMN", pangram: "MECHANIC" },
  { centre: "G", letters: "ILNQTU", pangram: "QUILTING" },
  { centre: "H", letters: "ACEOPR", pangram: "POACHER" },
  { centre: "A", letters: "CELTUY", pangram: "ACUTELY" },
  { centre: "C", letters: "EIJNOT", pangram: "INJECTION" },
  { centre: "A", letters: "EMNPTY", pangram: "PAYMENT" },
  { centre: "D", letters: "CELNTY", pangram: "DECENTLY" },
  { centre: "C", letters: "AFILNU", pangram: "FANCIFUL" },
  { centre: "C", letters: "AEKLMR", pangram: "MACKEREL" },
  { centre: "A", letters: "BELMOZ", pangram: "BAMBOOZLE" },
  { centre: "E", letters: "CGIJNT", pangram: "EJECTING" },
  { centre: "E", letters: "ILMNOU", pangram: "LINOLEUM" },
  { centre: "F", letters: "DEINTY", pangram: "IDENTIFY" },
  { centre: "F", letters: "HLOTUY", pangram: "YOUTHFUL" },
  { centre: "Y", letters: "AGINRT", pangram: "GYRATING" },
  { centre: "W", letters: "DEOPRY", pangram: "POWDERY" },
  { centre: "H", letters: "AEPRTY", pangram: "THERAPY" },
  { centre: "C", letters: "AINQTU", pangram: "ACQUAINT" },
  { centre: "V", letters: "AEOPRT", pangram: "EVAPORATE" },
  { centre: "C", letters: "BGHINU", pangram: "BUNCHING" },
  { centre: "C", letters: "AGIKNR", pangram: "CRANKING" },
  { centre: "G", letters: "CINRUV", pangram: "CURVING" },
  { centre: "G", letters: "INORWY", pangram: "WORRYING" },
  { centre: "E", letters: "GINTUY", pangram: "INGENUITY" },
  { centre: "K", letters: "ADEMRT", pangram: "TRADEMARK" },
  { centre: "D", letters: "AINORT", pangram: "TRADITION" },
  { centre: "B", letters: "EFGINT", pangram: "BEFITTING" },
  { centre: "A", letters: "CNOPUY", pangram: "OCCUPANCY" },
  { centre: "B", letters: "DFILNO", pangram: "BLINDFOLD" },
  { centre: "G", letters: "DEINPX", pangram: "EXPENDING" },
  { centre: "C", letters: "EFINOT", pangram: "CONFETTI" },
  { centre: "D", letters: "FNORUY", pangram: "FOUNDRY" },
  { centre: "L", letters: "EGINRY", pangram: "GINGERLY" },
  { centre: "D", letters: "EFIOTU", pangram: "OUTFITTED" },
  { centre: "H", letters: "ADELNP", pangram: "PANHANDLE" },
  { centre: "A", letters: "DILMNU", pangram: "MAUDLIN" },
  { centre: "A", letters: "CEHIMP", pangram: "IMPEACH" },
  { centre: "V", letters: "CEINOT", pangram: "EVICTION" },
  { centre: "Y", letters: "ABDELT", pangram: "BELATEDLY" },
  { centre: "A", letters: "DEGHIN", pangram: "HEADING" },
  { centre: "W", letters: "ADELOP", pangram: "WALLOPED" },
  { centre: "C", letters: "DEILNU", pangram: "INCLUDED" },
  { centre: "B", letters: "DEHORT", pangram: "THROBBED" },
  { centre: "L", letters: "EMNOPT", pangram: "ELOPEMENT" },
  { centre: "C", letters: "EGINPR", pangram: "PIERCING" },
  { centre: "A", letters: "BLRTUY", pangram: "BRUTALLY" },
];
