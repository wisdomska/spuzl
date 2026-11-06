/**
 * Quads puzzles: original SPUZL content in its own voice, Ghanaian and West African life mixed with global pop
 * culture, family friendly and fair for 13+. Each puzzle is four groups of four, listed by difficulty:
 * level 0 Easy (yellow), 1 Medium (green), 2 Hard (blue), 3 Tricky (purple: wordplay such as hidden words or
 * "___ fish"). Red herrings are welcome, but every puzzle has exactly one way to sort it: a word that fits two
 * groups is always forced by a group with no other choice. Checked by logic.test.ts; reviewed by the owner in
 * the admin console (Content, content.ts entries), which is what `needsReview` asks for.
 */
export interface QuadsGroup {
  label: string;
  words: [string, string, string, string];
}

export interface QuadsEntry {
  groups: [QuadsGroup, QuadsGroup, QuadsGroup, QuadsGroup];
}

export const needsReview = true;

export const CONTENT: QuadsEntry[] = [
  {
    groups: [
      { label: "Ghanaian dishes", words: ["JOLLOF", "BANKU", "FUFU", "KENKEY"] },
      { label: "Ghanaian dances", words: ["ADOWA", "AZONTO", "KPANLOGO", "AGBADZA"] },
      { label: "Ghana exports", words: ["COCOA", "TIMBER", "OIL", "BAUXITE"] },
      { label: "___ Coast", words: ["IVORY", "GOLD", "CAPE", "SKELETON"] },
    ],
  },
  {
    groups: [
      { label: "Weather", words: ["HAIL", "SLEET", "DRIZZLE", "FOG"] },
      { label: "Marvel heroes", words: ["THOR", "HULK", "GROOT", "STORM"] },
      { label: "Things with an eye", words: ["NEEDLE", "POTATO", "HURRICANE", "PEACOCK"] },
      { label: "Hidden body parts", words: ["CHINA", "SHIPYARD", "EARTH", "CHARM"] },
    ],
  },
  {
    groups: [
      { label: "Football positions", words: ["KEEPER", "STRIKER", "WINGER", "DEFENDER"] },
      { label: "Card suits", words: ["SPADES", "CLUBS", "DIAMONDS", "HEARTS"] },
      { label: "Ghana Premier League clubs", words: ["KOTOKO", "MEDEAMA", "ADUANA", "DREAMS"] },
      { label: "___keeper", words: ["GOAL", "BEE", "TIME", "SHOP"] },
    ],
  },
  {
    groups: [
      { label: "West African instruments", words: ["DJEMBE", "KORA", "BALAFON", "SHEKERE"] },
      { label: "Music genres", words: ["HIGHLIFE", "REGGAE", "JAZZ", "GOSPEL"] },
      { label: "Afrobeats stars", words: ["WIZKID", "SARKODIE", "TEMS", "STONEBWOY"] },
      { label: "___star", words: ["ROCK", "POP", "SUPER", "SHOOTING"] },
    ],
  },
  {
    groups: [
      { label: "Pizza toppings", words: ["PEPPERONI", "MUSHROOM", "OLIVE", "PINEAPPLE"] },
      { label: "Italian food", words: ["PASTA", "RISOTTO", "GELATO", "PESTO"] },
      { label: "Cheeses", words: ["CHEDDAR", "BRIE", "FETA", "EDAM"] },
      { label: "They have layers (ask Shrek)", words: ["ONION", "LASAGNE", "CAKE", "OGRE"] },
    ],
  },
  {
    groups: [
      { label: "Pokémon", words: ["PIKACHU", "EEVEE", "SNORLAX", "BULBASAUR"] },
      { label: "Yellow things", words: ["BANANA", "LEMON", "SUNFLOWER", "CUSTARD"] },
      { label: "A short sleep", words: ["NAP", "DOZE", "SNOOZE", "KIP"] },
      { label: "Hidden numbers", words: ["OFTEN", "CANINE", "WEIGHT", "STONE"] },
    ],
  },
  {
    groups: [
      { label: "Planets", words: ["VENUS", "JUPITER", "NEPTUNE", "MERCURY"] },
      { label: "Chocolate bars", words: ["MARS", "GALAXY", "BOUNTY", "TWIX"] },
      { label: "Greek letters", words: ["ALPHA", "BETA", "DELTA", "OMEGA"] },
      { label: "Things with rings", words: ["SATURN", "TREE", "CIRCUS", "OLYMPICS"] },
    ],
  },
  {
    groups: [
      { label: "Points of the compass", words: ["NORTH", "SOUTH", "EAST", "WEST"] },
      { label: "Ghana regions", words: ["ASHANTI", "VOLTA", "BONO", "OTI"] },
      { label: "Lakes", words: ["BOSUMTWI", "VICTORIA", "CHAD", "TITICACA"] },
      { label: "___pole", words: ["TAD", "FLAG", "MAY", "BEAN"] },
    ],
  },
  {
    groups: [
      { label: "Hogwarts houses", words: ["GRYFFINDOR", "SLYTHERIN", "HUFFLEPUFF", "RAVENCLAW"] },
      { label: "A wizard's kit", words: ["WAND", "BROOM", "CLOAK", "CAULDRON"] },
      { label: "Cleaning things", words: ["MOP", "SPONGE", "DUSTER", "SQUEEGEE"] },
      { label: "Hidden animals", words: ["SCATTER", "BEARD", "CARPET", "PIGMENT"] },
    ],
  },
  {
    groups: [
      { label: "In a pencil case", words: ["RULER", "ERASER", "SHARPENER", "COMPASS"] },
      { label: "Punctuation", words: ["COMMA", "COLON", "HYPHEN", "DASH"] },
      { label: "Parts of a book", words: ["SPINE", "COVER", "CHAPTER", "INDEX"] },
      { label: "___line", words: ["DEAD", "PUNCH", "HEAD", "TIME"] },
    ],
  },
  {
    groups: [
      { label: "Big cats", words: ["LEOPARD", "CHEETAH", "JAGUAR", "PUMA"] },
      { label: "Lion King characters", words: ["SIMBA", "NALA", "TIMON", "SCAR"] },
      { label: "Baby animals", words: ["KID", "CALF", "LAMB", "CUB"] },
      { label: "___fish", words: ["LION", "CAT", "SWORD", "STAR"] },
    ],
  },
  {
    groups: [
      { label: "West African capitals", words: ["ACCRA", "ABUJA", "DAKAR", "LOME"] },
      { label: "South American countries", words: ["BRAZIL", "PERU", "CHILE", "ARGENTINA"] },
      { label: "Island nations", words: ["CUBA", "MALTA", "FIJI", "ICELAND"] },
      { label: "Countries that are also names", words: ["CHAD", "JORDAN", "GEORGIA", "INDIA"] },
    ],
  },
  {
    groups: [
      { label: "West African street food", words: ["KELEWELE", "BOFROT", "KOOSE", "SUYA"] },
      { label: "Fast food", words: ["BURGER", "PIZZA", "NUGGETS", "FRIES"] },
      { label: "Things that melt", words: ["ICE", "CANDLE", "BUTTER", "SNOWMAN"] },
      { label: "___cake", words: ["PAN", "CUP", "FISH", "OAT"] },
    ],
  },
  {
    groups: [
      { label: "Made from cassava", words: ["GARI", "TAPIOCA", "KOKONTE", "ATTIEKE"] },
      { label: "Made from maize", words: ["KENKEY", "BANKU", "POPCORN", "TORTILLA"] },
      { label: "Made from milk", words: ["CHEESE", "YOGHURT", "BUTTER", "CREAM"] },
      { label: "Sound like letters", words: ["PEA", "TEA", "EYE", "SEA"] },
    ],
  },
  {
    groups: [
      { label: "Footwear", words: ["SANDAL", "SLIPPER", "TRAINER", "CHALEWOTE"] },
      { label: "West African dress", words: ["KENTE", "KABA", "DASHIKI", "AGBADA"] },
      { label: "Car parts", words: ["BONNET", "BOOT", "BUMPER", "EXHAUST"] },
      { label: "___suit", words: ["SPACE", "WET", "LAW", "TRACK"] },
    ],
  },
  {
    groups: [
      { label: "Social media words", words: ["LIKE", "SHARE", "FOLLOW", "STORY"] },
      { label: "Ways to send a message", words: ["TEXT", "EMAIL", "LETTER", "VOICENOTE"] },
      { label: "Things with a screen", words: ["PHONE", "LAPTOP", "CINEMA", "ATM"] },
      { label: "___code", words: ["ZIP", "DRESS", "MORSE", "POST"] },
    ],
  },
  {
    groups: [
      { label: "Sol-fa notes", words: ["DO", "RE", "MI", "FA"] },
      { label: "Voice parts", words: ["SOPRANO", "ALTO", "TENOR", "BARITONE"] },
      { label: "Note lengths", words: ["MINIM", "CROTCHET", "QUAVER", "BREVE"] },
      { label: "Fish", words: ["BASS", "SOLE", "CARP", "PIKE"] },
    ],
  },
  {
    groups: [
      { label: "Star Wars characters", words: ["YODA", "LEIA", "VADER", "REY"] },
      { label: "Out in space", words: ["GALAXY", "NEBULA", "ASTEROID", "QUASAR"] },
      { label: "Moons", words: ["TITAN", "EUROPA", "IO", "PHOBOS"] },
      { label: "Things with tails", words: ["COMET", "KITE", "COIN", "TADPOLE"] },
    ],
  },
  {
    groups: [
      { label: "Party things", words: ["CAKE", "CONFETTI", "BUNTING", "PRESENTS"] },
      { label: "Wedding words", words: ["VOW", "RING", "VEIL", "BOUQUET"] },
      { label: "Ghanaian festivals", words: ["HOMOWO", "AKWASIDAE", "ABOAKYER", "ODWIRA"] },
      { label: "Things you can blow", words: ["WHISTLE", "KISS", "FUSE", "CANDLE"] },
    ],
  },
  {
    groups: [
      { label: "Detective words", words: ["CLUE", "SUSPECT", "ALIBI", "MOTIVE"] },
      { label: "Famous detectives", words: ["HOLMES", "POIROT", "MARPLE", "SCOOBY"] },
      { label: "Things you solve", words: ["PUZZLE", "RIDDLE", "EQUATION", "SUDOKU"] },
      { label: "___hole", words: ["LOOP", "KEY", "PEEP", "PORT"] },
    ],
  },
  {
    groups: [
      { label: "Kitchen tools", words: ["WHISK", "LADLE", "SPATULA", "TONGS"] },
      { label: "Dances", words: ["SALSA", "TANGO", "WALTZ", "RUMBA"] },
      { label: "Sauces", words: ["PESTO", "GRAVY", "SHITO", "KETCHUP"] },
      { label: "___pot", words: ["TEA", "JACK", "HOT", "FLOWER"] },
    ],
  },
  {
    groups: [
      { label: "Disney heroines", words: ["ELSA", "MOANA", "BELLE", "MULAN"] },
      { label: "Ocean words", words: ["WAVE", "CURRENT", "REEF", "SWELL"] },
      { label: "Washing powders", words: ["ARIEL", "TIDE", "OMO", "PERSIL"] },
      { label: "___bell", words: ["DOOR", "COW", "BAR", "BLUE"] },
    ],
  },
  {
    groups: [
      { label: "Cooking methods", words: ["BAKE", "ROAST", "STEW", "GRILL"] },
      { label: "Very hot", words: ["SCORCHING", "SWELTERING", "BLAZING", "BOILING"] },
      { label: "Wind words", words: ["BREEZE", "GUST", "GALE", "HARMATTAN"] },
      { label: "___storm", words: ["BRAIN", "SNOW", "SAND", "THUNDER"] },
    ],
  },
  {
    groups: [
      { label: "Things that spin", words: ["TOP", "WHEEL", "FAN", "PLANET"] },
      { label: "Web words", words: ["SITE", "PAGE", "BROWSER", "LINK"] },
      { label: "Eight legs", words: ["OCTOPUS", "SCORPION", "TICK", "MITE"] },
      { label: "Animals in Ananse stories", words: ["SPIDER", "PYTHON", "LEOPARD", "HORNET"] },
    ],
  },
  {
    groups: [
      { label: "Toys", words: ["DOLL", "KITE", "YOYO", "PUZZLE"] },
      { label: "Board games", words: ["CHESS", "LUDO", "OWARE", "DRAUGHTS"] },
      { label: "In the playground", words: ["SWING", "SLIDE", "SEESAW", "ROUNDABOUT"] },
      { label: "Children's games", words: ["TAG", "HOPSCOTCH", "SKIPPING", "AMPE"] },
    ],
  },
  {
    groups: [
      { label: "Currencies", words: ["CEDI", "NAIRA", "DOLLAR", "EURO"] },
      { label: "Units of length", words: ["METRE", "INCH", "MILE", "FOOT"] },
      { label: "Units of weight", words: ["GRAM", "POUND", "OUNCE", "TONNE"] },
      { label: "Small coins", words: ["PENNY", "SHILLING", "PESEWA", "FARTHING"] },
    ],
  },
  {
    groups: [
      { label: "Dog breeds", words: ["POODLE", "BEAGLE", "HUSKY", "BOXER"] },
      { label: "Boxing words", words: ["JAB", "HOOK", "UPPERCUT", "ROPES"] },
      { label: "Played with a bat", words: ["CRICKET", "BASEBALL", "ROUNDERS", "PINGPONG"] },
      { label: "Bat___", words: ["MAN", "CAVE", "MOBILE", "SIGNAL"] },
    ],
  },
  {
    groups: [
      { label: "Tools", words: ["HAMMER", "SAW", "DRILL", "SPANNER"] },
      { label: "Things that cut", words: ["SCISSORS", "KNIFE", "CUTLASS", "RAZOR"] },
      { label: "Things with teeth", words: ["COMB", "ZIP", "GEAR", "SHARK"] },
      { label: "Things that hold", words: ["CLIP", "GLUE", "TAPE", "NAIL"] },
    ],
  },
  {
    groups: [
      { label: "Animals in Mole park", words: ["ELEPHANT", "BABOON", "WARTHOG", "ANTELOPE"] },
      { label: "Castle parts", words: ["MOAT", "TOWER", "KEEP", "DRAWBRIDGE"] },
      { label: "Castles", words: ["ELMINA", "WINDSOR", "EDINBURGH", "OSU"] },
      { label: "Ghana landmarks", words: ["LARABANGA", "AKOSOMBO", "MOLE", "NZULEZO"] },
    ],
  },
  {
    groups: [
      { label: "Breakfast", words: ["KOKO", "CEREAL", "PANCAKE", "OMELETTE"] },
      { label: "Breads", words: ["BAGEL", "BAGUETTE", "NAAN", "SUGARBREAD"] },
      { label: "Sea creatures", words: ["CRAB", "SQUID", "OCTOPUS", "LOBSTER"] },
      { label: "___ball", words: ["FOOT", "BASKET", "SNOW", "MEAT"] },
    ],
  },
  {
    groups: [
      { label: "Superpowers", words: ["FLIGHT", "STRENGTH", "SPEED", "INVISIBILITY"] },
      { label: "Magician props", words: ["WAND", "HAT", "CAPE", "CARDS"] },
      { label: "Things you cannot see", words: ["AIR", "WIND", "GRAVITY", "SOUND"] },
      { label: "Magic words", words: ["ABRACADABRA", "PRESTO", "ALAKAZAM", "HOCUSPOCUS"] },
    ],
  },
  {
    groups: [
      { label: "Ways to say hello", words: ["HELLO", "HOLA", "BONJOUR", "JAMBO"] },
      { label: "Ways to say thank you", words: ["MERCI", "GRACIAS", "DANKE", "MEDAASE"] },
      { label: "Ghanaian words", words: ["AKWAABA", "CHALE", "AYEKOO", "KOKONSA"] },
      { label: "Palindromes", words: ["LEVEL", "KAYAK", "RADAR", "NOON"] },
    ],
  },
  {
    groups: [
      { label: "Inside Out feelings", words: ["JOY", "FEAR", "ANGER", "DISGUST"] },
      { label: "Pixar films", words: ["CARS", "UP", "LUCA", "BRAVE"] },
      { label: "___mate", words: ["SOUL", "CHECK", "ROOM", "CLASS"] },
      { label: "___nut", words: ["COCO", "PEA", "DOUGH", "CHEST"] },
    ],
  },
  {
    groups: [
      { label: "Black Stars legends", words: ["ESSIEN", "GYAN", "ABEDI", "MUNTARI"] },
      { label: "Referee calls", words: ["OFFSIDE", "PENALTY", "FOUL", "HANDBALL"] },
      { label: "___kick", words: ["FREE", "SIDE", "BICYCLE", "SCISSOR"] },
      { label: "Start with an animal", words: ["CATWALK", "RATTLE", "BATTERY", "ANTHEM"] },
    ],
  },
  {
    groups: [
      { label: "Colours of Ghana's flag", words: ["RED", "GOLD", "GREEN", "BLACK"] },
      { label: "Ghanaian crafts", words: ["KENTE", "BEADS", "POTTERY", "BASKETRY"] },
      { label: "___smith", words: ["WORD", "LOCK", "SILVER", "TIN"] },
      { label: "Adinkra symbols", words: ["SANKOFA", "GYENYAME", "DWENNIMMEN", "ADINKRAHENE"] },
    ],
  },
  {
    groups: [
      { label: "Rivers", words: ["NILE", "AMAZON", "DANUBE", "THAMES"] },
      { label: "Deserts", words: ["SAHARA", "GOBI", "KALAHARI", "NAMIB"] },
      { label: "Waterfalls", words: ["VICTORIA", "NIAGARA", "ANGEL", "WLI"] },
      { label: "___wall", words: ["SEA", "FIRE", "STONE", "DRY"] },
    ],
  },
  {
    groups: [
      { label: "Time words", words: ["MINUTE", "HOUR", "WEEK", "DAY"] },
      { label: "Things with faces", words: ["COIN", "DICE", "CLIFF", "CLOCK"] },
      { label: "Things that tick", words: ["BOX", "METRONOME", "CHECKLIST", "TIMER"] },
      { label: "___hand", words: ["SECOND", "FARM", "DECK", "STAGE"] },
    ],
  },
  {
    groups: [
      { label: "Ghana farm crops", words: ["COCOA", "PLANTAIN", "YAM", "MAIZE"] },
      { label: "Farm tools", words: ["HOE", "CUTLASS", "RAKE", "PLOUGH"] },
      { label: "Seed words", words: ["SOW", "SPROUT", "GERMINATE", "HARVEST"] },
      { label: "Things that grow, not on a farm", words: ["HAIR", "NAILS", "SAVINGS", "QUEUES"] },
    ],
  },
];
