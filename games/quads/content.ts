/**
 * Quads puzzles. Original SPUZL content, needs owner review. Four groups of four per puzzle, listed from
 * the most direct (level 0) to the trickiest (level 3). About 1 in 5 groups is Ghanaian or West African.
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
      { label: "Weekend plates", words: ["JOLLOF", "BANKU", "FUFU", "KENKEY"] },
      { label: "Ghanaian beats and moves", words: ["HIGHLIFE", "ADOWA", "AZONTO", "AFROBEATS"] },
      { label: "Ghana exports", words: ["COCOA", "TIMBER", "OIL", "BAUXITE"] },
      { label: "___ Coast", words: ["IVORY", "GOLD", "CAPE", "SKELETON"] },
    ],
  },
  {
    groups: [
      { label: "Fruits without a stone", words: ["APPLE", "BANANA", "PAWPAW", "PINEAPPLE"] },
      { label: "Shades of red", words: ["CRIMSON", "SCARLET", "RUBY", "MAROON"] },
      { label: "Fruits with a stone", words: ["DATE", "AVOCADO", "MANGO", "LYCHEE"] },
      { label: "Gemstones", words: ["EMERALD", "OPAL", "TOPAZ", "AMBER"] },
    ],
  },
  {
    groups: [
      { label: "Pets", words: ["DOG", "CAT", "HAMSTER", "PARROT"] },
      { label: "Card games", words: ["SNAP", "RUMMY", "POKER", "WHIST"] },
      { label: "Things that click", words: ["CAMERA", "MOUSE", "PEN", "TONGUE"] },
      { label: "Body parts with three letters", words: ["SHIN", "EAR", "ARM", "LEG"] },
    ],
  },
  {
    groups: [
      { label: "Planets", words: ["MARS", "VENUS", "SATURN", "EARTH"] },
      { label: "Words before BAR", words: ["CHOCOLATE", "SNACK", "SAND", "CROW"] },
      { label: "Greek letters", words: ["ALPHA", "BETA", "DELTA", "OMEGA"] },
      { label: "Things with rings", words: ["TREE", "CIRCUS", "ONION", "OLYMPICS"] },
    ],
  },
  {
    groups: [
      { label: "Kitchen tools", words: ["WHISK", "LADLE", "SPATULA", "TONGS"] },
      { label: "Dances", words: ["SALSA", "TANGO", "WALTZ", "RUMBA"] },
      { label: "Sauces", words: ["PESTO", "GRAVY", "SHITO", "KETCHUP"] },
      { label: "Hot drinks", words: ["TEA", "COFFEE", "COCOA", "CIDER"] },
    ],
  },
  {
    groups: [
      { label: "Breakfast foods", words: ["TOAST", "CEREAL", "PANCAKE", "OMELETTE"] },
      { label: "Bread types", words: ["BAGEL", "BAGUETTE", "PITTA", "NAAN"] },
      { label: "Sea creatures", words: ["CRAB", "SQUID", "OCTOPUS", "LOBSTER"] },
      { label: "Words before BALL", words: ["FOOT", "BASKET", "SNOW", "MEAT"] },
    ],
  },
  {
    groups: [
      { label: "Colours", words: ["RED", "BLUE", "GREEN", "YELLOW"] },
      { label: "Fish", words: ["TUNA", "SALMON", "TILAPIA", "COD"] },
      { label: "___ fly", words: ["BUTTER", "DRAGON", "FIRE", "HOUSE"] },
      { label: "Things with keys", words: ["PIANO", "LAPTOP", "MAP", "LOCK"] },
    ],
  },
  {
    groups: [
      { label: "Weather", words: ["RAIN", "SNOW", "HAIL", "SLEET"] },
      { label: "Ghana regions", words: ["ASHANTI", "VOLTA", "CENTRAL", "WESTERN"] },
      { label: "Points of the compass", words: ["NORTH", "SOUTH", "EAST", "WEST"] },
      { label: "Storms", words: ["HURRICANE", "CYCLONE", "TYPHOON", "TORNADO"] },
    ],
  },
  {
    groups: [
      { label: "Instruments", words: ["GUITAR", "VIOLIN", "FLUTE", "TRUMPET"] },
      { label: "West African instruments", words: ["DJEMBE", "KORA", "BALAFON", "SHEKERE"] },
      { label: "Things with strings", words: ["KITE", "PUPPET", "YOYO", "BOW"] },
      { label: "Orchestra sections", words: ["BRASS", "WIND", "STRINGS", "PERCUSSION"] },
    ],
  },
  {
    groups: [
      { label: "Shapes", words: ["CIRCLE", "SQUARE", "TRIANGLE", "OVAL"] },
      { label: "Round things", words: ["BALL", "COIN", "PLATE", "WHEEL"] },
      { label: "Card suits", words: ["HEARTS", "CLUBS", "SPADES", "DIAMONDS"] },
      { label: "Chess pieces", words: ["KING", "QUEEN", "BISHOP", "ROOK"] },
    ],
  },
  {
    groups: [
      { label: "School subjects", words: ["MATHS", "SCIENCE", "HISTORY", "ART"] },
      { label: "In a pencil case", words: ["RULER", "ERASER", "SHARPENER", "PROTRACTOR"] },
      { label: "Punctuation", words: ["COMMA", "COLON", "DASH", "HYPHEN"] },
      { label: "Parts of a book", words: ["SPINE", "COVER", "CHAPTER", "INDEX"] },
    ],
  },
  {
    groups: [
      { label: "Big cats", words: ["LION", "TIGER", "LEOPARD", "CHEETAH"] },
      { label: "Farm animals", words: ["COW", "GOAT", "SHEEP", "PIG"] },
      { label: "Animal homes", words: ["NEST", "DEN", "HIVE", "BURROW"] },
      { label: "Baby animals", words: ["KID", "CALF", "LAMB", "FOAL"] },
    ],
  },
  {
    groups: [
      { label: "Bodies of water", words: ["LAKE", "RIVER", "OCEAN", "LAGOON"] },
      { label: "Ghana lakes and rivers", words: ["VOLTA", "BOSUMTWI", "PRA", "DENSU"] },
      { label: "Bridge types", words: ["ARCH", "BEAM", "SUSPENSION", "CANTILEVER"] },
      { label: "Things that flow", words: ["LAVA", "TRAFFIC", "CONVERSATION", "TIME"] },
    ],
  },
  {
    groups: [
      { label: "Sports", words: ["TENNIS", "CRICKET", "HOCKEY", "BOXING"] },
      { label: "Football positions", words: ["STRIKER", "KEEPER", "DEFENDER", "MIDFIELDER"] },
      { label: "Things with a net", words: ["GOAL", "HAMMOCK", "TRAMPOLINE", "FISHERMAN"] },
      { label: "Things you kick", words: ["BALL", "HABIT", "BUCKET", "TYRES"] },
    ],
  },
  {
    groups: [
      { label: "Green vegetables", words: ["PEA", "CABBAGE", "BROCCOLI", "OKRA"] },
      { label: "Root crops", words: ["YAM", "CASSAVA", "COCOYAM", "CARROT"] },
      { label: "Leafy greens", words: ["LETTUCE", "SPINACH", "KALE", "KONTOMIRE"] },
      { label: "Things you peel", words: ["ORANGE", "BANANA", "STICKER", "PLANTAIN"] },
    ],
  },
  {
    groups: [
      { label: "Clothing", words: ["SHIRT", "SKIRT", "TROUSERS", "JACKET"] },
      { label: "West African dress", words: ["KENTE", "KABA", "DASHIKI", "AGBADA"] },
      { label: "Footwear", words: ["SANDAL", "BOOT", "SLIPPER", "TRAINER"] },
      { label: "Things with buttons", words: ["REMOTE", "LIFT", "CALCULATOR", "CONTROLLER"] },
    ],
  },
  {
    groups: [
      { label: "South American countries", words: ["BRAZIL", "PERU", "CHILE", "ARGENTINA"] },
      { label: "West African capitals", words: ["ACCRA", "ABUJA", "DAKAR", "LOME"] },
      { label: "Island nations", words: ["CUBA", "MALTA", "FIJI", "ICELAND"] },
      { label: "Countries that are also names", words: ["CHAD", "JORDAN", "GEORGIA", "INDIA"] },
    ],
  },
  {
    groups: [
      { label: "Sol fa notes", words: ["DO", "RE", "MI", "FA"] },
      { label: "Note lengths", words: ["MINIM", "CROTCHET", "QUAVER", "BREVE"] },
      { label: "Music genres", words: ["JAZZ", "REGGAE", "HIGHLIFE", "HIPHOP"] },
      { label: "Voice parts", words: ["SOPRANO", "ALTO", "TENOR", "BASS"] },
    ],
  },
  {
    groups: [
      { label: "Trees", words: ["OAK", "PINE", "BAOBAB", "MAHOGANY"] },
      { label: "Things with bark", words: ["TREE", "DOG", "SEAL", "FOX"] },
      { label: "Paper words", words: ["SHEET", "REAM", "PAGE", "PAD"] },
      { label: "Wooden things", words: ["SPOON", "CHAIR", "PENCIL", "TABLE"] },
    ],
  },
  {
    groups: [
      { label: "Months", words: ["MAY", "JUNE", "MARCH", "AUGUST"] },
      { label: "Days in short", words: ["MON", "TUE", "WED", "FRI"] },
      { label: "Seasons", words: ["SPRING", "SUMMER", "AUTUMN", "WINTER"] },
      { label: "Words before TIME", words: ["HALF", "BED", "LUNCH", "PRIME"] },
    ],
  },
  {
    groups: [
      { label: "Gems", words: ["RUBY", "EMERALD", "SAPPHIRE", "DIAMOND"] },
      { label: "Metals", words: ["IRON", "COPPER", "SILVER", "TIN"] },
      { label: "Old Gold Coast trade goods", words: ["GOLD", "KOLA", "SALT", "COWRIE"] },
      { label: "Things that sparkle", words: ["GLITTER", "SEQUIN", "TINSEL", "FROST"] },
    ],
  },
  {
    groups: [
      { label: "Birds", words: ["EAGLE", "OWL", "ROBIN", "HERON"] },
      { label: "Things that fly", words: ["KITE", "PLANE", "DRONE", "BALLOON"] },
      { label: "Birds that cannot fly", words: ["OSTRICH", "PENGUIN", "EMU", "KIWI"] },
      { label: "Things with feathers", words: ["PILLOW", "ARROW", "DUVET", "QUILL"] },
    ],
  },
  {
    groups: [
      { label: "Gym gear", words: ["DUMBBELL", "MAT", "ROPE", "KETTLEBELL"] },
      { label: "Exercises", words: ["SQUAT", "PLANK", "LUNGE", "BURPEE"] },
      { label: "Yoga words", words: ["POSE", "BREATH", "FLOW", "STRETCH"] },
      { label: "Words before BELL", words: ["DOOR", "BLUE", "COW", "BAR"] },
    ],
  },
  {
    groups: [
      { label: "Desserts", words: ["CAKE", "PIE", "PUDDING", "TRIFLE"] },
      { label: "Ghana street snacks", words: ["KELEWELE", "BOFROT", "KOOSE", "SUYA"] },
      { label: "Crunchy snacks", words: ["CRISPS", "POPCORN", "PRETZEL", "NUTS"] },
      { label: "Things that melt", words: ["ICE", "CHOCOLATE", "CANDLE", "BUTTER"] },
    ],
  },
  {
    groups: [
      { label: "Computer parts", words: ["MOUSE", "KEYBOARD", "SCREEN", "SPEAKER"] },
      { label: "Things that crash", words: ["WAVES", "CYMBALS", "COMPUTER", "STOCKS"] },
      { label: "Computer pests", words: ["BUG", "WORM", "VIRUS", "SPAM"] },
      { label: "Places to save a file", words: ["DISK", "CLOUD", "DRIVE", "STICK"] },
    ],
  },
  {
    groups: [
      { label: "Feelings", words: ["HAPPY", "SAD", "ANGRY", "CALM"] },
      { label: "Big", words: ["HUGE", "GIANT", "VAST", "MASSIVE"] },
      { label: "Small", words: ["TINY", "WEE", "MINI", "PETITE"] },
      { label: "Fast", words: ["QUICK", "RAPID", "SWIFT", "BRISK"] },
    ],
  },
  {
    groups: [
      { label: "Tools", words: ["HAMMER", "SAW", "DRILL", "WRENCH"] },
      { label: "Things with teeth", words: ["COMB", "ZIP", "GEAR", "SHARK"] },
      { label: "Things that cut", words: ["SCISSORS", "KNIFE", "MACHETE", "AXE"] },
      { label: "Things that hold", words: ["CLIP", "GLUE", "TAPE", "NAIL"] },
    ],
  },
  {
    groups: [
      { label: "Dinner party", words: ["HOST", "GUEST", "TOAST", "COURSE"] },
      { label: "Wedding words", words: ["VOW", "RING", "VEIL", "BOUQUET"] },
      { label: "Ghanaian celebrations", words: ["OUTDOORING", "DURBAR", "HOMOWO", "AKWASIDAE"] },
      { label: "Party things", words: ["BALLOON", "CAKE", "CANDLE", "CONFETTI"] },
    ],
  },
  {
    groups: [
      { label: "Space", words: ["STAR", "COMET", "GALAXY", "NEBULA"] },
      { label: "Moon words", words: ["CRATER", "PHASE", "ECLIPSE", "TIDE"] },
      { label: "Famous ships", words: ["TITANIC", "ENDEAVOUR", "BEAGLE", "MAYFLOWER"] },
      { label: "Space travellers", words: ["ASTRONAUT", "ROVER", "PROBE", "SATELLITE"] },
    ],
  },
  {
    groups: [
      { label: "Superpowers", words: ["FLIGHT", "STRENGTH", "SPEED", "INVISIBILITY"] },
      { label: "Things you cannot see", words: ["AIR", "WIND", "GRAVITY", "SOUND"] },
      { label: "Magic words", words: ["ABRACADABRA", "PRESTO", "ALAKAZAM", "HOCUSPOCUS"] },
      { label: "Magician props", words: ["WAND", "HAT", "CAPE", "CARDS"] },
    ],
  },
  {
    groups: [
      { label: "Drinks", words: ["WATER", "JUICE", "MILK", "SODA"] },
      { label: "West African drinks", words: ["SOBOLO", "ASANA", "BISSAP", "ZOMKOM"] },
      { label: "Things you pour", words: ["RAIN", "CONCRETE", "SAND", "HONEY"] },
      { label: "Fizzy things", words: ["TABLET", "SHERBET", "LEMONADE", "BUBBLY"] },
    ],
  },
  {
    groups: [
      { label: "Mountains", words: ["EVEREST", "KILIMANJARO", "ATLAS", "ALPS"] },
      { label: "Ghana highlands", words: ["AFADJATO", "KWAHU", "AKWAPIM", "GAMBAGA"] },
      { label: "Things with peaks", words: ["CAP", "GRAPH", "MOUNTAIN", "CAREER"] },
      { label: "Climbing gear", words: ["ROPE", "HARNESS", "CARABINER", "HELMET"] },
    ],
  },
  {
    groups: [
      { label: "Vehicles", words: ["CAR", "BUS", "TRAIN", "TRUCK"] },
      { label: "Getting around Ghana", words: ["TROTRO", "TAXI", "OKADA", "FERRY"] },
      { label: "Boats", words: ["CANOE", "YACHT", "KAYAK", "DINGHY"] },
      { label: "Parts of a car", words: ["BONNET", "BOOT", "WHEEL", "HORN"] },
    ],
  },
  {
    groups: [
      { label: "Bakery", words: ["BREAD", "BUN", "SCONE", "MUFFIN"] },
      { label: "Words before CAKE", words: ["PAN", "CUP", "CHEESE", "FISH"] },
      { label: "Words after SWEET", words: ["HEART", "CORN", "POTATO", "TOOTH"] },
      { label: "Words before BREAD", words: ["SHORT", "GINGER", "FLAT", "BROWN"] },
    ],
  },
  {
    groups: [
      { label: "Ocean words", words: ["TIDE", "WAVE", "CURRENT", "SWELL"] },
      { label: "Ghana beach towns", words: ["BUSUA", "KOKROBITE", "ADA", "ELMINA"] },
      { label: "Beach things", words: ["TOWEL", "UMBRELLA", "BUCKET", "SPADE"] },
      { label: "Shelled animals", words: ["SNAIL", "CRAB", "TORTOISE", "CLAM"] },
    ],
  },
  {
    groups: [
      { label: "In a classroom", words: ["BOARD", "DESK", "CHALK", "REGISTER"] },
      { label: "Teacher words", words: ["LESSON", "HOMEWORK", "TEST", "GRADE"] },
      { label: "Things you can draw", words: ["BATH", "CURTAINS", "SWORD", "BREATH"] },
      { label: "Things you can pass", words: ["EXAM", "BALL", "SALT", "TIME"] },
    ],
  },
  {
    groups: [
      { label: "Hats", words: ["CAP", "BERET", "BOWLER", "FEDORA"] },
      { label: "Worn on the head", words: ["CROWN", "HELMET", "TURBAN", "HEADWRAP"] },
      { label: "Royal things", words: ["THRONE", "SCEPTRE", "ORB", "PALACE"] },
      { label: "Asante royal regalia", words: ["STOOL", "KENTE", "UMBRELLA", "STAFF"] },
    ],
  },
  {
    groups: [
      { label: "Jungle animals", words: ["GORILLA", "PARROT", "JAGUAR", "SLOTH"] },
      { label: "Striped animals", words: ["ZEBRA", "TIGER", "BEE", "SKUNK"] },
      { label: "Spotted animals", words: ["LEOPARD", "LADYBIRD", "DALMATIAN", "HYENA"] },
      { label: "Animals with shells", words: ["TORTOISE", "SNAIL", "ARMADILLO", "CRAB"] },
    ],
  },
  {
    groups: [
      { label: "Detective words", words: ["CLUE", "SUSPECT", "ALIBI", "MOTIVE"] },
      { label: "Famous detectives", words: ["HOLMES", "POIROT", "MARPLE", "MORSE"] },
      { label: "Fingerprint patterns", words: ["ARCH", "LOOP", "WHORL", "TENTED"] },
      { label: "Things you solve", words: ["CASE", "PUZZLE", "RIDDLE", "EQUATION"] },
    ],
  },
  {
    groups: [
      { label: "Rain gear", words: ["UMBRELLA", "RAINCOAT", "WELLIES", "PONCHO"] },
      { label: "Things with handles", words: ["MUG", "DOOR", "BUCKET", "SUITCASE"] },
      { label: "Things that open and close", words: ["EYE", "STORE", "BOOK", "GATE"] },
      { label: "Things with ribs", words: ["BOAT", "CHEST", "CORDUROY", "LEAF"] },
    ],
  },
  {
    groups: [
      { label: "Cheeses", words: ["CHEDDAR", "BRIE", "FETA", "EDAM"] },
      { label: "Things with holes", words: ["SIEVE", "NET", "DONUT", "FLUTE"] },
      { label: "Pizza toppings", words: ["PEPPERONI", "MUSHROOM", "OLIVE", "ONION"] },
      { label: "Italian foods", words: ["PASTA", "RISOTTO", "LASAGNE", "GELATO"] },
    ],
  },
  {
    groups: [
      { label: "Ghana football clubs", words: ["HEARTS", "KOTOKO", "MEDEAMA", "ADUANA"] },
      { label: "Football words", words: ["GOAL", "PENALTY", "OFFSIDE", "CORNER"] },
      { label: "Card game words", words: ["DEAL", "SHUFFLE", "TRICK", "SUIT"] },
      { label: "Words before STAR", words: ["SHOOTING", "ROCK", "FILM", "NORTH"] },
    ],
  },
  {
    groups: [
      { label: "Cooking methods", words: ["BOIL", "FRY", "ROAST", "STEAM"] },
      { label: "In a pot of light soup", words: ["GOAT", "TOMATO", "PEPPER", "GINGER"] },
      { label: "Cuts of meat", words: ["LOIN", "RUMP", "BRISKET", "SHANK"] },
      { label: "Things that boil", words: ["KETTLE", "BLOOD", "ANGER", "WATER"] },
    ],
  },
  {
    groups: [
      { label: "Furniture", words: ["SOFA", "TABLE", "WARDROBE", "STOOL"] },
      { label: "Rooms", words: ["KITCHEN", "BEDROOM", "STUDY", "HALL"] },
      { label: "In a bathroom", words: ["SOAP", "TOWEL", "MIRROR", "SPONGE"] },
      { label: "In a garden", words: ["SHED", "HEDGE", "LAWN", "POND"] },
    ],
  },
  {
    groups: [
      { label: "Painters", words: ["MONET", "PICASSO", "KAHLO", "VANGOGH"] },
      { label: "Art supplies", words: ["EASEL", "CANVAS", "PALETTE", "BRUSH"] },
      { label: "Ghanaian crafts", words: ["KENTE", "ADINKRA", "BEADS", "POTTERY"] },
      { label: "Colours of Ghana's flag", words: ["RED", "GOLD", "GREEN", "BLACK"] },
    ],
  },
  {
    groups: [
      { label: "Time words", words: ["SECOND", "MINUTE", "HOUR", "DAY"] },
      { label: "Things with hands", words: ["CLOCK", "POKER", "CREW", "FARM"] },
      { label: "Things with faces", words: ["COIN", "DICE", "CLIFF", "WATCH"] },
      { label: "Things that tick", words: ["BOX", "BOMB", "METRONOME", "CHECKLIST"] },
    ],
  },
  {
    groups: [
      { label: "Phone features", words: ["CAMERA", "TORCH", "ALARM", "CALCULATOR"] },
      { label: "Social words", words: ["POST", "LIKE", "SHARE", "FOLLOW"] },
      { label: "Ways to send a message", words: ["TEXT", "EMAIL", "LETTER", "VOICENOTE"] },
      { label: "Things with a screen", words: ["PHONE", "TELEVISION", "LAPTOP", "CINEMA"] },
    ],
  },
  {
    groups: [
      { label: "Grains", words: ["RICE", "MAIZE", "MILLET", "SORGHUM"] },
      { label: "Made from maize", words: ["KENKEY", "BANKU", "POPCORN", "TORTILLA"] },
      { label: "Made from cassava", words: ["GARI", "FUFU", "TAPIOCA", "KOKONTE"] },
      { label: "Made from milk", words: ["CHEESE", "YOGHURT", "BUTTER", "CREAM"] },
    ],
  },
  {
    groups: [
      { label: "Weather tools", words: ["BAROMETER", "THERMOMETER", "WINDVANE", "RAINGAUGE"] },
      { label: "Wind words", words: ["BREEZE", "GUST", "GALE", "HARMATTAN"] },
      { label: "Very hot", words: ["BOILING", "SCORCHING", "BAKING", "ROASTING"] },
      { label: "Very cold", words: ["FREEZING", "CHILLY", "ICY", "FROSTY"] },
    ],
  },
  {
    groups: [
      { label: "Writing tools", words: ["PEN", "PENCIL", "CRAYON", "MARKER"] },
      { label: "Ways to write", words: ["PRINT", "SCRIBBLE", "TYPE", "SCRAWL"] },
      { label: "Ghanaian writers", words: ["AIDOO", "ARMAH", "AWOONOR", "ANYIDOHO"] },
      { label: "Poem types", words: ["SONNET", "HAIKU", "LIMERICK", "ODE"] },
    ],
  },
  {
    groups: [
      { label: "Kitchen appliances", words: ["OVEN", "FRIDGE", "TOASTER", "BLENDER"] },
      { label: "Things that whistle", words: ["KETTLE", "REFEREE", "TRAIN", "WIND"] },
      { label: "Things that ring", words: ["BELL", "PHONE", "ALARM", "EARS"] },
      { label: "Things that beep", words: ["MICROWAVE", "TRUCK", "SCANNER", "ROBOT"] },
    ],
  },
  {
    groups: [
      { label: "Things that flash", words: ["CAMERA", "LIGHTNING", "SIREN", "TORCH"] },
      { label: "Bat things", words: ["CAVE", "WING", "CRICKET", "BASEBALL"] },
      { label: "Weather words", words: ["STORM", "THUNDER", "FROST", "TORNADO"] },
      { label: "Dog breeds", words: ["BOXER", "POODLE", "BEAGLE", "HUSKY"] },
    ],
  },
  {
    groups: [
      { label: "Ghana market fruit", words: ["PAWPAW", "PINEAPPLE", "WATERMELON", "SOURSOP"] },
      { label: "Citrus", words: ["LEMON", "LIME", "GRAPEFRUIT", "ORANGE"] },
      { label: "Berries", words: ["STRAWBERRY", "BLUEBERRY", "RASPBERRY", "BLACKBERRY"] },
      { label: "Dried fruit", words: ["RAISIN", "PRUNE", "DATE", "APRICOT"] },
    ],
  },
  {
    groups: [
      { label: "Reading words", words: ["NOVEL", "CHAPTER", "PAGE", "PLOT"] },
      { label: "Library words", words: ["SHELF", "LOAN", "CATALOGUE", "FINE"] },
      { label: "Story genres", words: ["MYSTERY", "ROMANCE", "FANTASY", "ADVENTURE"] },
      { label: "Folktale tricksters", words: ["ANANSE", "TORTOISE", "HARE", "FOX"] },
    ],
  },
  {
    groups: [
      { label: "Animals in Ananse tales", words: ["SPIDER", "PYTHON", "LEOPARD", "HORNET"] },
      { label: "Eight legs", words: ["OCTOPUS", "SCORPION", "TICK", "MITE"] },
      { label: "Web words", words: ["SITE", "PAGE", "BROWSER", "LINK"] },
      { label: "Things that spin", words: ["TOP", "WHEEL", "FAN", "PLANET"] },
    ],
  },
  {
    groups: [
      { label: "Moons", words: ["TITAN", "EUROPA", "IO", "PHOBOS"] },
      { label: "Constellations", words: ["ORION", "PLOUGH", "CASSIOPEIA", "PEGASUS"] },
      { label: "Mythical creatures", words: ["DRAGON", "UNICORN", "PHOENIX", "GRIFFIN"] },
      { label: "Horse words", words: ["MANE", "HOOF", "SADDLE", "STABLE"] },
    ],
  },
  {
    groups: [
      { label: "Instruments you hit", words: ["DRUM", "CYMBAL", "XYLOPHONE", "GONG"] },
      { label: "Things that are struck", words: ["MATCH", "BELL", "DEAL", "POSE"] },
      { label: "Parts of a bell", words: ["CLAPPER", "CROWN", "LIP", "WAIST"] },
      { label: "Ghanaian drums", words: ["ATUMPAN", "DONNO", "FONTOMFROM", "KETE"] },
    ],
  },
  {
    groups: [
      { label: "Units of length", words: ["METRE", "INCH", "MILE", "FOOT"] },
      { label: "Units of weight", words: ["GRAM", "POUND", "OUNCE", "TONNE"] },
      { label: "Money", words: ["CEDI", "NAIRA", "DOLLAR", "EURO"] },
      { label: "Small coins", words: ["PENNY", "SHILLING", "PESEWA", "FARTHING"] },
    ],
  },
  {
    groups: [
      { label: "Toys", words: ["DOLL", "KITE", "YOYO", "PUZZLE"] },
      { label: "Board games", words: ["CHESS", "LUDO", "OWARE", "DRAUGHTS"] },
      { label: "Playground", words: ["SWING", "SLIDE", "SEESAW", "ROUNDABOUT"] },
      { label: "Children's games", words: ["TAG", "HOPSCOTCH", "SKIPPING", "AMPE"] },
    ],
  },
  {
    groups: [
      { label: "Garden creatures", words: ["SNAIL", "WORM", "ANT", "BEETLE"] },
      { label: "Pollinators", words: ["BEE", "BUTTERFLY", "MOTH", "HUMMINGBIRD"] },
      { label: "Things that sting", words: ["WASP", "NETTLE", "JELLYFISH", "SCORPION"] },
      { label: "Things that buzz", words: ["FLY", "DOORBELL", "PHONE", "KAZOO"] },
    ],
  },
  {
    groups: [
      { label: "Rivers", words: ["NILE", "AMAZON", "DANUBE", "THAMES"] },
      { label: "Waterfalls", words: ["VICTORIA", "NIAGARA", "ANGEL", "WLI"] },
      { label: "Deserts", words: ["SAHARA", "GOBI", "KALAHARI", "NAMIB"] },
      { label: "Words before WALL", words: ["SEA", "FIRE", "STONE", "DRY"] },
    ],
  },
  {
    groups: [
      { label: "Cleaning things", words: ["MOP", "BROOM", "SPONGE", "DUSTER"] },
      { label: "Things that sweep", words: ["WIND", "SEARCHLIGHT", "CHIMNEY", "RADAR"] },
      { label: "Words before PAN", words: ["FRYING", "DUST", "PETER", "SAUCE"] },
      { label: "Things with bristles", words: ["BRUSH", "HEDGEHOG", "TOOTHBRUSH", "BEARD"] },
    ],
  },
  {
    groups: [
      { label: "Tall things", words: ["GIRAFFE", "TOWER", "REDWOOD", "SKYSCRAPER"] },
      { label: "Things with floors", words: ["BUILDING", "OCEAN", "FOREST", "DANCE"] },
      { label: "Lift words", words: ["UP", "DOWN", "DOOR", "BUTTON"] },
      { label: "Words before TOWER", words: ["WATCH", "CONTROL", "BELL", "CLOCK"] },
    ],
  },
  {
    groups: [
      { label: "Ghana farm crops", words: ["COCOA", "PLANTAIN", "YAM", "MAIZE"] },
      { label: "Farm tools", words: ["HOE", "CUTLASS", "RAKE", "PLOUGH"] },
      { label: "Things that grow", words: ["PLANT", "HAIR", "NAIL", "SAVINGS"] },
      { label: "Seed words", words: ["SOW", "SPROUT", "GERMINATE", "HARVEST"] },
    ],
  },
  {
    groups: [
      { label: "Maths words", words: ["SUM", "PRODUCT", "ANGLE", "FRACTION"] },
      { label: "Shapes with corners", words: ["SQUARE", "CUBE", "PYRAMID", "PENTAGON"] },
      { label: "Things with points", words: ["STAR", "ARROW", "PENCIL", "NEEDLE"] },
      { label: "Ways to score", words: ["POINT", "GOAL", "TRY", "RUN"] },
    ],
  },
  {
    groups: [
      { label: "Ghana landmarks", words: ["LARABANGA", "AKOSOMBO", "MOLE", "NZULEZO"] },
      { label: "Castles", words: ["ELMINA", "WINDSOR", "EDINBURGH", "OSU"] },
      { label: "Castle parts", words: ["MOAT", "TOWER", "KEEP", "DRAWBRIDGE"] },
      { label: "Animals in Mole park", words: ["ELEPHANT", "BABOON", "WARTHOG", "ANTELOPE"] },
    ],
  },
];
