/**
 * Coil themes. Original SPUZL content, needs owner review. Every entry uses exactly 30 letters (the 6 x 5
 * grid) in words of 4+ letters; the generator lays them out per difficulty. About 1 in 4 themes is
 * Ghanaian or West African.
 */
export interface CoilEntry {
  theme: string;
  words: string[];
}

export const needsReview = true;

export const CONTENT: CoilEntry[] = [
  { theme: "Market day", words: ["BEADS", "KENTE", "YAMS", "SHEA", "PALM", "OKRA", "SALT"] },
  { theme: "In the kitchen", words: ["KETTLE", "SPOON", "WHISK", "LADLE", "TONGS", "OVEN"] },
  { theme: "Wild weather", words: ["THUNDER", "RAIN", "SLEET", "STORM", "HAIL", "CLOUD"] },
  { theme: "Ghanaian plates", words: ["JOLLOF", "BANKU", "FUFU", "KENKEY", "GARI", "SHITO"] },
  { theme: "Made by hand", words: ["KENTE", "BEADS", "POTTERY", "BASKET", "CARVING"] },
  { theme: "Things with wings", words: ["EAGLE", "PLANE", "MOTH", "PARROT", "BEETLE", "KITE"] },
  { theme: "At the beach", words: ["SAND", "WAVES", "SHELLS", "TOWEL", "CRAB", "BUCKET"] },
  { theme: "Drum circle", words: ["DJEMBE", "KORA", "BALAFON", "BELLS", "GONG", "HORN"] },
  { theme: "Night sky", words: ["MOON", "STARS", "COMET", "PLANET", "METEOR", "NOVA"] },
  { theme: "Garden tools", words: ["SPADE", "RAKE", "HOSE", "SHEARS", "TROWEL", "FORKS"] },
  { theme: "Dance floor", words: ["AZONTO", "ADOWA", "HIGHLIFE", "BALLET", "WALTZ"] },
  { theme: "Shades of blue", words: ["NAVY", "COBALT", "AZURE", "TEAL", "INDIGO", "ROYAL"] },
  { theme: "Around Ghana", words: ["ACCRA", "KUMASI", "TEMA", "VOLTA", "TAMALE", "AXIM"] },
  { theme: "Board games", words: ["CHESS", "LUDO", "OWARE", "DRAUGHTS", "SCRABBLE"] },
  { theme: "Breakfast", words: ["TOAST", "MILLET", "PORRIDGE", "BACON", "CEREAL"] },
  { theme: "Cocoa farm", words: ["COCOA", "BEANS", "MACHETE", "HARVEST", "FARMER"] },
  { theme: "Wild Africa", words: ["LION", "ZEBRA", "GIRAFFE", "HIPPO", "RHINO", "KUDU"] },
  { theme: "Music class", words: ["PIANO", "VIOLIN", "CLARINET", "GUITAR", "CELLO"] },
  { theme: "Dry season", words: ["HARMATTAN", "DUST", "HAZE", "WIND", "SHEA", "CHILL"] },
  { theme: "Rainforest", words: ["CANOPY", "SLOTHS", "JAGUAR", "ORCHID", "TOUCAN"] },
  { theme: "Football", words: ["GOAL", "WHISTLE", "STRIKER", "KEEPER", "CORNER"] },
  { theme: "Kente colours", words: ["GOLD", "GREEN", "BLACK", "MAROON", "SILVER", "BLUE"] },
  { theme: "Street food", words: ["SUYA", "KELEWELE", "KOOSE", "AKARA", "CHINCHIN"] },
  { theme: "Rivers of Africa", words: ["NILE", "NIGER", "VOLTA", "CONGO", "ZAMBEZI", "TANA"] },
  { theme: "Fruit bowl", words: ["MANGO", "PAPAYA", "GUAVA", "LEMON", "APPLE", "LIME"] },
  { theme: "Ocean life", words: ["WHALE", "SHARK", "OCTOPUS", "SQUID", "STARFISH"] },
  { theme: "Camping trip", words: ["TENTS", "LANTERN", "COMPASS", "KETTLE", "TORCH"] },
  { theme: "Body parts", words: ["ELBOW", "ANKLE", "KNEE", "SHOULDER", "HEEL", "CHIN"] },
  { theme: "Gemstones", words: ["RUBY", "EMERALD", "OPAL", "TOPAZ", "AMBER", "PEARL"] },
  { theme: "Birds", words: ["ROBIN", "HERON", "FALCON", "PELICAN", "SPARROW"] },
  { theme: "In the toolbox", words: ["HAMMER", "WRENCH", "PLIERS", "CHISEL", "MALLET"] },
  { theme: "Planets", words: ["JUPITER", "MERCURY", "SATURN", "URANUS", "MARS"] },
  { theme: "On the farm", words: ["TRACTOR", "GOATS", "SHEEP", "CHICKEN", "CATTLE"] },
  { theme: "School bag", words: ["PENCILS", "RULER", "ERASER", "CRAYONS", "BOOKS"] },
  { theme: "Trotro ride", words: ["DRIVER", "FARE", "STATION", "HORN", "MATE", "SEATS"] },
  { theme: "Sweet treats", words: ["BROWNIE", "COOKIE", "TOFFEE", "MUFFIN", "DONUT"] },
  { theme: "Insects", words: ["BEETLE", "CRICKET", "LOCUST", "TERMITE", "WASP"] },
  { theme: "Pets", words: ["PUPPY", "KITTEN", "HAMSTER", "PARROT", "RABBIT"] },
  { theme: "Fabrics", words: ["COTTON", "SILK", "WOOL", "DENIM", "LINEN", "VELVET"] },
  { theme: "Herbs and spices", words: ["GINGER", "PEPPER", "GARLIC", "CLOVES", "NUTMEG"] },
  { theme: "Things that spin", words: ["TOPS", "PROPELLER", "GLOBE", "WINDMILL", "YOYO"] },
  { theme: "Hats", words: ["BONNET", "BOWLER", "FEDORA", "TURBAN", "BEANIE"] },
  { theme: "Celebrations", words: ["WEDDING", "BIRTHDAY", "PARADE", "FEAST", "GALA"] },
  { theme: "Card games", words: ["POKER", "RUMMY", "WHIST", "SOLITAIRE", "BRIDGE"] },
  { theme: "Pasta shapes", words: ["PENNE", "FUSILLI", "RAVIOLI", "LASAGNE", "ORZO"] },
  { theme: "Chess pieces", words: ["KING", "QUEEN", "BISHOP", "KNIGHT", "ROOK", "PAWNS"] },
  { theme: "Reading corner", words: ["NOVEL", "POEM", "BOOKMARK", "CHAPTER", "AUTHOR"] },
  { theme: "Cool drinks", words: ["SOBOLO", "LEMONADE", "SMOOTHIE", "SODA", "MILK"] },
  { theme: "Feelings", words: ["HAPPY", "PROUD", "NERVOUS", "BORED", "CALM", "GLAD"] },
  { theme: "Up in the clouds", words: ["CIRRUS", "CUMULUS", "STRATUS", "NIMBUS", "MIST"] },
  { theme: "Getting around", words: ["BRIDGE", "TUNNEL", "HIGHWAY", "AVENUE", "ROUTE"] },
  { theme: "Shapes", words: ["CIRCLE", "SQUARE", "TRIANGLE", "SPHERE", "STAR"] },
  { theme: "Ghana festivals", words: ["HOMOWO", "ABOAKYER", "ODWIRA", "KUNDUM", "FETU"] },
  { theme: "Time", words: ["SECOND", "MINUTE", "HOUR", "WEEK", "MONTH", "EPOCH"] },
  { theme: "Snacks", words: ["POPCORN", "CRISPS", "NUTS", "PLANTAIN", "DATES"] },
  { theme: "Ghana's waters", words: ["BOSUMTWI", "KINTAMPO", "VOLTA", "BOTI", "DENSU"] },
  { theme: "Orchestra", words: ["FLUTE", "TUBA", "OBOE", "HARP", "BASSOON", "VIOLIN"] },
  { theme: "Colours of fire", words: ["ORANGE", "YELLOW", "CRIMSON", "SCARLET", "GOLD"] },
  { theme: "Opposites", words: ["EARLY", "LATE", "ASLEEP", "AWAKE", "ABOVE", "BELOW"] },
  { theme: "Bakery", words: ["LOAF", "BREAD", "SCONE", "CROISSANT", "PRETZEL"] },
];
