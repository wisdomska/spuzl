/**
 * Minicross grids. Original SPUZL content, needs owner review. Fills were found with a word list filler
 * (tool-assisted, then hand-picked); every clue is hand-written. "#" is a black square. Clues are listed in
 * numbering order. About 1 in 4 grids has a Ghanaian or West African answer or clue.
 */
export interface MinicrossEntry {
  rows: string[];
  across: string[];
  down: string[];
}

export const needsReview = true;

export const CONTENT: MinicrossEntry[] = [
  {
    rows: ["#ARCH", "SCORE", "ACTOR", "GROSS", "EARS#"],
    // 1A ARCH 5A SCORE 6A ACTOR 7A GROSS 8A EARS
    across: [
      "Curved top of a doorway",
      "Final result of a match",
      "Star of a Nollywood film",
      "144, as a quantity",
      "Things you hear with",
    ],
    // 1D ACCRA 2D ROTOR 3D CROSS 4D HERS 5D SAGE
    down: ["Ghana's capital", "Spinning part of a helicopter", "Angry", "Belonging to her", "Wise herb"],
  },
  {
    rows: ["TOAD#", "UTTER", "STOLE", "KENTE", "#READ"],
    // 1A TOAD 5A UTTER 7A STOLE 8A KENTE 9A READ
    across: ["Warty garden hopper", "Say out loud", "Took without asking", "Woven cloth of the Asante and Ewe", "Look at a book"],
    // 1D TUSK 2D OTTER 3D ATONE 4D DELTA 6D REED
    down: [
      "Elephant's long tooth",
      "River animal that floats on its back",
      "Make up for a mistake",
      "River mouth like the Volta's near Ada",
      "Tall marsh grass",
    ],
  },
  {
    rows: ["#SCAN", "STYLE", "COCOA", "ALLOT", "REEF#"],
    // 1A SCAN 5A STYLE 6A COCOA 7A ALLOT 8A REEF
    across: ["Look over quickly", "Way of dressing", "Ghana's top export bean", "Share out", "Coral ridge near the shore"],
    // 1D STOLE 2D CYCLE 3D ALOOF 4D NEAT 5D SCAR
    down: ["Took without asking", "Bike ride or wash run", "Distant and cool", "Tidy", "Mark after a cut heals"],
  },
  {
    rows: ["OKRA#", "INERT", "LEVEE", "SAUNA", "#DEAR"],
    // 1A OKRA 5A INERT 7A LEVEE 8A SAUNA 9A DEAR
    across: [
      "Slimy green pod in groundnut soup",
      "Not moving at all",
      "Bank built to stop a flood",
      "Very hot steam room",
      "Start of a letter",
    ],
    // 1D OILS 2D KNEAD 3D REVUE 4D ARENA 6D TEAR
    down: ["Palm and coconut, for two", "Work dough with your hands", "Show with songs and sketches", "Big stadium", "Rip"],
  },
  {
    rows: ["#GARI", "NAVAL", "EMAIL", "AMISS", "TALE#"],
    // 1A GARI 5A NAVAL 6A EMAIL 7A AMISS 8A TALE
    across: ["Cassava grains you soak with sugar", "Of the sea and ships", "Message in your inbox", "Wrong, out of place", "Story"],
    // 1D GAMMA 2D AVAIL 3D RAISE 4D ILLS 5D NEAT
    down: ["Third Greek letter", "Be of use", "Lift up", "Troubles", "Tidy"],
  },
  {
    rows: ["#REST", "CURIO", "AMONG", "RODEO", "DREW#"],
    // 1A REST 5A CURIO 6A AMONG 7A RODEO 8A DREW
    across: ["Have a lie down", "Odd little collector's object", "In the middle of", "Cowboy show", "Sketched"],
    // 1D RUMOR 2D ERODE 3D SINEW 4D TOGO 5D CARD
    down: ["Gossip", "Wear away slowly", "Tendon", "Ghana's neighbour to the east", "Birthday greeting"],
  },
  {
    rows: ["#CALF", "RURAL", "AROSE", "TIMED", "SOAR#"],
    // 1A CALF 5A RURAL 6A AROSE 7A TIMED 8A SOAR
    across: ["Baby cow", "Of the countryside", "Got up", "Measured with a stopwatch", "Fly high like an eagle"],
    // 1D CURIO 2D AROMA 3D LASER 4D FLED 5D RATS
    down: ["Odd little collector's object", "Sweet smell of fresh bread", "Beam of focused light", "Ran away", "Rodents"],
  },
  {
    rows: ["#CHOP", "BRAVO", "RAVEN", "EVERY", "DENT#"],
    // 1A CHOP 5A BRAVO 6A RAVEN 7A EVERY 8A DENT
    across: ["Cut into pieces", "Well done!", "Black bird", "Each and all", "Small dip in a car door"],
    // 1D CRAVE 2D HAVEN 3D OVERT 4D PONY 5D BRED
    down: ["Long for", "Safe place", "Open, not hidden", "Small horse", "Raised, like cattle"],
  },
  {
    rows: ["#CARE", "ALLAY", "VOICE", "INKED", "DEER#"],
    // 1A CARE 5A ALLAY 6A VOICE 7A INKED 8A DEER
    across: ["Look after", "Calm a fear", "Sound you speak with", "Signed in pen", "Animal with antlers"],
    // 1D CLONE 2D ALIKE 3D RACER 4D EYED 5D AVID
    down: ["Exact copy", "Much the same", "Fast runner", "Watched", "Keen"],
  },
  {
    rows: ["RIMS#", "ADOPT", "METRE", "SATIN", "#LOGS"],
    // 1A RIMS 5A ADOPT 7A METRE 8A SATIN 9A LOGS
    across: ["Edges of wheels", "Take in a child", "100 centimetres", "Shiny smooth cloth", "Bits of a tree trunk"],
    // 1D RAMS 2D IDEAL 3D MOTTO 4D SPRIG 6D TENS
    down: ["Male sheep", "Perfect", "Saying to live by", "Small shoot of rosemary", "Groups of ten"],
  },
  {
    rows: ["PARE#", "ABOVE", "TODAY", "SUEDE", "#TOES"],
    // 1A PARE 5A ABOVE 7A TODAY 8A SUEDE 9A TOES
    across: ["Peel a fruit", "Higher than", "This day", "Soft leather", "Ten on your feet"],
    // 1D PATS 2D ABOUT 3D RODEO 4D EVADE 6D EYES
    down: ["Light taps", "Roughly", "Cowboy show", "Dodge", "Things you see with"],
  },
  {
    rows: ["WHIM#", "HAVOC", "ABOVE", "TIRED", "#TYRE"],
    // 1A WHIM 5A HAVOC 7A ABOVE 8A TIRED 9A TYRE
    across: ["Sudden fancy", "Chaos", "Over", "Sleepy", "Rubber ring on a wheel"],
    // 1D WHAT 2D HABIT 3D IVORY 4D MOVER 6D CEDE
    down: ["Excuse me?", "Thing you do every day", "Elephant tusk material", "Removals worker", "Give up"],
  },
  {
    rows: ["COAT#", "ROBIN", "OZONE", "WEDGE", "#DEED"],
    // 1A COAT 5A ROBIN 7A OZONE 8A WEDGE 9A DEED
    across: ["Jacket", "Red breasted bird", "Gas layer high above the Earth", "Cheese shape", "Act or action"],
    // 1D CROW 2D OOZED 3D ABODE 4D TINGE 6D NEED
    down: ["Black bird that caws", "Leaked out slowly", "Home", "Slight colour", "Must have"],
  },
  {
    rows: ["#CORD", "VALUE", "AGILE", "SEVER", "EYED#"],
    // 1A CORD 5A VALUE 6A AGILE 7A SEVER 8A EYED
    across: ["String", "Worth", "Quick on your feet", "Cut off", "Watched closely"],
    // 1D CAGEY 2D OLIVE 3D RULED 4D DEER 5D VASE
    down: ["Shy and careful", "Green fruit for oil", "Drew lines on", "Animal in the forest", "Flower jar"],
  },
  {
    rows: ["#SPUR", "SCALE", "HENCE", "ENDED", "DEAR#"],
    // 1A SPUR 5A SCALE 6A HENCE 7A ENDED 8A DEAR
    across: ["Urge on, as a horse", "Fish skin plate", "For this reason", "Finished", "Kind person"],
    // 1D SCENE 2D PANDA 3D ULCER 4D REED 5D SHED
    down: ["View", "Black and white bear", "Stomach sore", "Tall marsh grass", "Hut for tools"],
  },
  {
    rows: ["PULP#", "APART", "SPREE", "SEVEN", "#RANT"],
    // 1A PULP 5A APART 7A SPREE 8A SEVEN 9A RANT
    across: ["Soft mush", "In pieces", "Shopping trip", "Number of days in a week", "Angry speech"],
    // 1D PASS 2D UPPER 3D LARVA 4D PREEN 6D TENT
    down: ["Hand the ball", "Top", "Young insect", "Fix your feathers", "Camping shelter"],
  },
  {
    rows: ["#TOIL", "SENSE", "AMISS", "SPOUT", "HONE#"],
    // 1A TOIL 5A SENSE 6A AMISS 7A SPOUT 8A HONE
    across: ["Hard work", "Feeling", "Wrong", "Water jet from a whale", "Sharpen a blade"],
    // 1D TEMPO 2D ONION 3D ISSUE 4D LEST 5D SASH
    down: ["Speed of a song", "Vegetable that makes you cry", "Edition of a magazine", "In case", "Belt for a dress"],
  },
  {
    rows: ["LOAD#", "OWNER", "ANGLE", "NERVE", "#DYED"],
    // 1A LOAD 5A OWNER 7A ANGLE 8A NERVE 9A DYED
    across: ["Pile on a trotro roof", "Person who has it", "Corner shape", "Courage", "Coloured with a stain"],
    // 1D LOAN 2D OWNED 3D ANGRY 4D DELVE 6D REED
    down: ["Money you must repay", "Had", "Cross", "Dig deep", "Tall marsh grass"],
  },
  {
    rows: ["#SURF", "MINOR", "UNDUE", "SCENT", "HERD#"],
    // 1A SURF 5A MINOR 6A UNDUE 7A SCENT 8A HERD
    across: ["Ride a wave at Busua", "Under 18", "More than needed", "Smell", "Group of cattle"],
    // 1D SINCE 2D UNDER 3D ROUND 4D FRET 5D MUSH
    down: ["From the time", "Below", "Circular", "Worry", "Soft porridge"],
  },
  {
    rows: ["MUGS#", "INNER", "STOVE", "TIMED", "#LENS"],
    // 1A MUGS 5A INNER 7A STOVE 8A TIMED 9A LENS
    across: ["Cups with handles", "Inside", "Cooker", "Clocked", "Glass part of a camera"],
    // 1D MIST 2D UNTIL 3D GNOME 4D SEVEN 6D REDS
    down: ["Light fog", "Up to", "Garden statue with a hat", "Number after six", "Colours like a stop sign"],
  },
  {
    rows: ["#PALE", "ALLAY", "GUIDE", "EMBED", "SPIN#"],
    // 1A PALE 5A ALLAY 6A GUIDE 7A EMBED 8A SPIN
    across: ["Light in colour", "Calm", "Show the way", "Fix firmly in", "Twirl"],
    // 1D PLUMP 2D ALIBI 3D LADEN 4D EYED 5D AGES
    down: ["Chubby", "Proof you were somewhere else", "Weighed down", "Watched", "Years"],
  },
  {
    rows: ["ACID#", "PUREE", "EBONY", "SENSE", "#DYES"],
    // 1A ACID 5A PUREE 7A EBONY 8A SENSE 9A DYES
    across: ["Lemon juice is one", "Smooth mash", "Black wood", "Feeling", "Colours"],
    // 1D APES 2D CUBED 3D IRONY 4D DENSE 6D EYES
    down: ["Gorillas, for example", "Cut into squares", "Opposite of what you expect", "Thick", "Things you see with"],
  },
  {
    rows: ["#SMOG", "SHAME", "LADEN", "ADAGE", "TEMA#"],
    // 1A SMOG 5A SHAME 6A LADEN 7A ADAGE 8A TEMA
    across: ["Haze over a city", "Feeling of disgrace", "Weighed down", "Wise saying", "Ghana's port city east of Accra"],
    // 1D SHADE 2D MADAM 3D OMEGA 4D GENE 5D SLAT
    down: ["Shadow", "Polite word for a lady", "Last Greek letter", "Unit of heredity", "Thin strip of wood"],
  },
  {
    rows: ["#PLOW", "LEAVE", "ANGER", "SCORE", "TEST#"],
    // 1A PLOW 5A LEAVE 6A ANGER 7A SCORE 8A TEST
    across: ["Farm tool for turning soil", "Go away", "Fury", "Points in a game", "Exam"],
    // 1D PENCE 2D LAGOS 3D OVERT 4D WERE 5D LAST
    down: ["Old pennies", "Nigeria's biggest city", "Open", "Used to be", "Final"],
  },
  {
    rows: ["#TANS", "BROIL", "LARGE", "ACTED", "BEAR#"],
    // 1A TANS 5A BROIL 6A LARGE 7A ACTED 8A BEAR
    across: ["Gets brown in the sun", "Grill", "Big", "Played a part", "Big furry animal"],
    // 1D TRACE 2D AORTA 3D NIGER 4D SLED 5D BLAB
    down: ["Copy by drawing over", "Main artery", "West African country and river", "Snow ride", "Tell a secret"],
  },
  {
    rows: ["#VEST", "SIXTH", "COCOA", "ALERT", "BALE#"],
    // 1A VEST 5A SIXTH 6A COCOA 7A ALERT 8A BALE
    across: ["Sleeveless top", "After fifth", "Bean for chocolate, from Ghana", "Watchful", "Bundle of hay"],
    // 1D VIOLA 2D EXCEL 3D STORE 4D THAT 5D SCAB
    down: ["Large violin", "Do very well", "Shop", "Not this one", "Crust on a cut"],
  },
  {
    rows: ["HARM#", "OCEAN", "GRAPE", "SIDLE", "#DYED"],
    // 1A HARM 5A OCEAN 7A GRAPE 8A SIDLE 9A DYED
    across: ["Hurt", "Atlantic or Pacific", "Fruit on a vine", "Edge along shyly", "Coloured"],
    // 1D HOGS 2D ACRID 3D READY 4D MAPLE 6D NEED
    down: ["Pigs", "Sharp and bitter", "Prepared", "Tree on Canada's flag", "Must have"],
  },
  {
    rows: ["BABY#", "ALLOW", "BLADE", "EASEL", "#YELL"],
    // 1A BABY 5A ALLOW 7A BLADE 8A EASEL 9A YELL
    across: ["Infant", "Let", "Knife edge", "Painter's stand", "Shout"],
    // 1D BABE 2D ALLAY 3D BLASE 4D YODEL 6D WELL
    down: ["Sweetheart", "Calm", "Not bothered", "Swiss mountain singing", "Water hole"],
  },
  {
    rows: ["CARD#", "ADORN", "RADII", "SPELT", "#TOYS"],
    // 1A CARD 5A ADORN 7A RADII 8A SPELT 9A TOYS
    across: ["Ace or king", "Decorate", "Lines from the centre of circles", "Wrote letter by letter", "Things for play"],
    // 1D CARS 2D ADAPT 3D RODEO 4D DRILY 6D NITS
    down: ["Vehicles", "Adjust", "Cowboy show", "In a dry way", "Lice eggs"],
  },
  {
    rows: ["SMOG#", "OOZED", "ALONE", "PANIC", "#REEK"],
    // 1A SMOG 5A OOZED 7A ALONE 8A PANIC 9A REEK
    across: ["Haze over a city", "Leaked slowly", "On your own", "Sudden fear", "Bad smell"],
    // 1D SOAP 2D MOLAR 3D OZONE 4D GENIE 6D DECK
    down: ["Something to wash with", "Back tooth", "Gas layer high above the Earth", "Lamp spirit who grants wishes", "Ship floor"],
  },
  {
    rows: ["#WISH", "MINCE", "UNDER", "SCENE", "TEXT#"],
    // 1A WISH 5A MINCE 6A UNDER 7A SCENE 8A TEXT
    across: ["Hope for", "Chop finely", "Below", "View", "Phone message"],
    // 1D WINCE 2D INDEX 3D SCENT 4D HERE 5D MUST
    down: ["Flinch", "List at the back of a book", "Smell", "In this place", "Have to"],
  },
  {
    rows: ["LIAR#", "ANGER", "CARVE", "KNEED", "#EELS"],
    // 1A LIAR 5A ANGER 7A CARVE 8A KNEED 9A EELS
    across: ["Fibber", "Rage", "Cut wood into a shape", "Pressed with the knee", "Long slippery fish"],
    // 1D LACK 2D INANE 3D AGREE 4D REVEL 6D REDS
    down: ["Not have", "Silly", "Say yes", "Party", "Colours"],
  },
  {
    rows: ["#SUED", "SALVE", "OFTEN", "FERRY", "TRAY#"],
    // 1A SUED 5A SALVE 6A OFTEN 7A FERRY 8A TRAY
    across: ["Took to court", "Soothing cream", "Many times", "Boat across the Volta at Yeji", "Food carrier"],
    // 1D SAFER 2D ULTRA 3D EVERY 4D DENY 5D SOFT
    down: ["Less risky", "Extremely", "Each", "Say no", "Not hard"],
  },
  {
    rows: ["EGGS#", "VALID", "IVORY", "LEVEE", "#LEND"],
    // 1A EGGS 5A VALID 7A IVORY 8A LEVEE 9A LEND
    across: ["Breakfast in a shell", "True", "Elephant tusk", "Bank by a river", "Let borrow"],
    // 1D EVIL 2D GAVEL 3D GLOVE 4D SIREN 6D DYED
    down: ["Wicked", "Judge's hammer", "Hand cover", "Ambulance alarm", "Coloured"],
  },
  {
    rows: ["#WASP", "DITTO", "ADORE", "TENET", "ANEW#"],
    // 1A WASP 5A DITTO 6A ADORE 7A TENET 8A ANEW
    across: ["Stinging insect", "The same again", "Love", "Belief", "Once more"],
    // 1D WIDEN 2D ATONE 3D STREW 4D POET 5D DATA
    down: ["Make broader", "Make up for", "Scatter", "Writer of verses", "Facts"],
  },
  {
    rows: ["#GRIN", "CLONE", "LATEX", "ADOPT", "PERT#"],
    // 1A GRIN 5A CLONE 6A LATEX 7A ADOPT 8A PERT
    across: ["Smile", "Exact copy", "Rubber for gloves", "Take in a child", "Cheeky"],
    // 1D GLADE 2D ROTOR 3D INEPT 4D NEXT 5D CLAP
    down: ["Clearing in a forest", "Helicopter blade", "Clumsy", "Following", "Hands together"],
  },
  {
    rows: ["#RANK", "BATON", "AROSE", "RENEW", "BRED#"],
    // 1A RANK 5A BATON 6A AROSE 7A RENEW 8A BRED
    across: ["Row or grade", "Relay stick", "Got up", "Make new again", "Raised"],
    // 1D RARER 2D ATONE 3D NOSED 4D KNEW 5D BARB
    down: ["More unusual", "Make amends", "Poked about", "Was aware", "Sharp hook"],
  },
  {
    rows: ["#REAL", "CURIO", "AROMA", "WADED", "SLED#"],
    // 1A REAL 5A CURIO 6A AROMA 7A WADED 8A SLED
    across: ["Genuine", "Odd little object", "Sweet smell", "Walked in water", "Snow vehicle"],
    // 1D RURAL 2D ERODE 3D AIMED 4D LOAD 5D CAWS
    down: ["Of the countryside", "Wear away", "Pointed", "Weight", "Crow sounds"],
  },
  {
    rows: ["#PIER", "LADLE", "ONION", "ADOPT", "NAME#"],
    // 1A PIER 5A LADLE 6A ONION 7A ADOPT 8A NAME
    across: ["Jetty at a beach", "Soup spoon", "Vegetable in every stew", "Take as your own", "What you are called"],
    // 1D PANDA 2D IDIOM 3D ELOPE 4D RENT 5D LOAN
    down: ["Black and white bear", "Saying", "Run off to marry", "Money for a room", "Money borrowed"],
  },
  {
    rows: ["DARN#", "ALOUD", "ULTRA", "BOOST", "#TREE"],
    // 1A DARN 5A ALOUD 7A ULTRA 8A BOOST 9A TREE
    across: ["Mend a sock", "Out loud", "Very, as a prefix", "Lift", "The baobab is one"],
    // 1D DAUB 2D ALLOT 3D ROTOR 4D NURSE 6D DATE
    down: ["Smear", "Give a share", "Spinning blade", "Hospital carer", "Day on a calendar"],
  },
  {
    rows: ["FAST#", "OPERA", "ARRAY", "MOVIE", "#NETS"],
    // 1A FAST 5A OPERA 7A ARRAY 8A MOVIE 9A NETS
    across: ["Quick", "Musical drama", "Neat display", "Film", "Goal frames"],
    // 1D FOAM 2D APRON 3D SERVE 4D TRAIT 6D AYES
    down: ["Bubbles on waves", "Kitchen cover up", "Wait on table", "Feature", "Yes votes"],
  },
  {
    rows: ["CEDE#", "OVERT", "DECRY", "SNOOP", "#TYRE"],
    // 1A CEDE 5A OVERT 7A DECRY 8A SNOOP 9A TYRE
    across: ["Give up", "Open", "Speak against", "Spy", "Wheel cover"],
    // 1D CODS 2D EVENT 3D DECOY 4D ERROR 6D TYPE
    down: ["Fish", "Happening", "Fake duck", "Mistake", "Kind"],
  },
  {
    rows: ["LOFT#", "APART", "MEDIA", "PREEN", "#ADDS"],
    // 1A LOFT 5A APART 7A MEDIA 8A PREEN 9A ADDS
    across: ["Attic room", "In pieces", "News outlets", "Fix feathers", "Puts on top"],
    // 1D LAMP 2D OPERA 3D FADED 4D TRIED 6D TANS
    down: ["Light", "Musical drama", "Lost colour", "Attempted", "Gets brown"],
  },
  {
    rows: ["BUGS#", "ALLOW", "SCALE", "SERVE", "#REED"],
    // 1A BUGS 5A ALLOW 7A SCALE 8A SERVE 9A REED
    across: ["Insects", "Let", "Fish skin plate", "Hand out food", "Tall marsh grass"],
    // 1D BASS 2D ULCER 3D GLARE 4D SOLVE 6D WEED
    down: ["Deep voice", "Sore inside", "Hard stare", "Work out", "Unwanted plant"],
  },
  {
    rows: ["#LOSS", "CELLO", "RADAR", "EVENT", "WENT#"],
    // 1A LOSS 5A CELLO 6A RADAR 7A EVENT 8A WENT
    across: ["Opposite of a win", "String instrument", "Air traffic tool", "Happening", "Left"],
    // 1D LEAVE 2D OLDEN 3D SLANT 4D SORT 5D CREW
    down: ["Go away", "Long ago", "Tilt", "Kind", "Ship workers"],
  },
  {
    rows: ["#HOST", "DELTA", "RADAR", "OVERT", "PYRE#"],
    // 1A HOST 5A DELTA 6A RADAR 7A OVERT 8A PYRE
    across: ["Party giver", "River mouth", "Air traffic tool", "Not hidden", "Fire for burning"],
    // 1D HEAVY 2D OLDER 3D STARE 4D TART 5D DROP
    down: ["Weighty", "More aged", "Gaze", "Sour", "Let fall"],
  },
  {
    rows: ["BUST#", "ASPEN", "SHINE", "SENSE", "#REED"],
    // 1A BUST 5A ASPEN 7A SHINE 8A SENSE 9A REED
    across: ["Broke, informally", "Tree with shaking leaves", "Gleam", "Feeling", "Tall marsh grass"],
    // 1D BASS 2D USHER 3D SPINE 4D TENSE 6D NEED
    down: ["Deep voice", "Seat guide at an event", "Backbone", "Stressed", "Must have"],
  },
  {
    rows: ["#FOWL", "PITHY", "USHER", "THERE", "TYRE#"],
    // 1A FOWL 5A PITHY 6A USHER 7A THERE 8A TYRE
    across: ["Chicken or guinea hen", "Short and clever", "Seat guide", "In that place", "Wheel cover"],
    // 1D FISHY 2D OTHER 3D WHERE 4D LYRE 5D PUTT
    down: ["Suspicious", "Not this one", "At which place", "Old harp", "Gentle golf stroke"],
  },
  {
    rows: ["#BEAM", "SOLVE", "PRIOR", "UNTIE", "DEED#"],
    // 1A BEAM 5A SOLVE 6A PRIOR 7A UNTIE 8A DEED
    across: ["Ray of light", "Work out", "Earlier", "Free a knot", "Act"],
    // 1D BORNE 2D ELITE 3D AVOID 4D MERE 5D SPUD
    down: ["Carried", "Top group", "Keep away from", "Only", "Potato"],
  },
  {
    rows: ["SLID#", "LUCID", "ARISE", "PIECE", "#DROP"],
    // 1A SLID 5A LUCID 7A ARISE 8A PIECE 9A DROP
    across: ["Glided", "Clear", "Get up", "Part", "Let fall"],
    // 1D SLAP 2D LURID 3D ICIER 4D DISCO 6D DEEP
    down: ["Smack", "Shocking", "Colder", "Dance party", "Not shallow"],
  },
  {
    rows: ["#BACK", "BUGLE", "ARRAY", "BLESS", "EYES#"],
    // 1A BACK 5A BUGLE 6A ARRAY 7A BLESS 8A EYES
    across: ["Rear", "Trumpet like horn", "Display", "Wish well", "Things you see with"],
    // 1D BURLY 2D AGREE 3D CLASS 4D KEYS 5D BABE
    down: ["Strong and broad", "Say yes", "School group", "Things on a ring", "Sweetheart"],
  },
  {
    rows: ["SANK#", "ARENA", "WOVEN", "SMELT", "#ARTS"],
    // 1A SANK 5A ARENA 7A WOVEN 8A SMELT 9A ARTS
    across: ["Went under", "Stadium", "Like kente on a loom", "Got the scent of", "Painting and music"],
    // 1D SAWS 2D AROMA 3D NEVER 4D KNELT 6D ANTS
    down: ["Cutting tools", "Pleasant smell", "Not ever", "Was on your knees", "Insects that farm"],
  },
  {
    rows: ["#FRET", "TIARA", "OLDEN", "STICK", "SHOT#"],
    // 1A FRET 5A TIARA 6A OLDEN 7A STICK 8A SHOT
    across: ["Worry", "Jewelled headband", "From long ago", "Branch", "Attempt at goal"],
    // 1D FILTH 2D RADIO 3D ERECT 4D TANK 5D TOSS
    down: ["Dirt", "It plays the morning news", "Upright", "Fish home", "Flip a coin"],
  },
  {
    rows: ["#PALS", "TULIP", "OLIVE", "ASKED", "DEED#"],
    // 1A PALS 5A TULIP 6A OLIVE 7A ASKED 8A DEED
    across: ["Friends", "Spring flower", "Green fruit", "Put a question", "Act"],
    // 1D PULSE 2D ALIKE 3D LIVED 4D SPED 5D TOAD
    down: ["Heartbeat", "Similar", "Was alive", "Went fast", "Warty garden hopper"],
  },
  {
    rows: ["#COSY", "SAUNA", "ACTOR", "STERN", "HIRE#"],
    // 1A COSY 5A SAUNA 6A ACTOR 7A STERN 8A HIRE
    across: ["Snug", "Very hot steam room", "Film star", "Back of a boat", "Rent"],
    // 1D CACTI 2D OUTER 3D SNORE 4D YARN 5D SASH
    down: ["Desert plants", "Outside", "Sleep sound", "Thread", "Belt of cloth"],
  },
  {
    rows: ["#ITCH", "SNORE", "ACTOR", "GUESS", "ARMS#"],
    // 1A ITCH 5A SNORE 6A ACTOR 7A GUESS 8A ARMS
    across: ["Scratch", "Sleep sound", "Film star", "Have a go at an answer", "Hands hold them"],
    // 1D INCUR 2D TOTEM 3D CROSS 4D HERS 5D SAGA
    down: ["Bring on yourself", "Tall carved pole", "Angry", "Belonging to her", "Long story"],
  },
  {
    rows: ["#GLIB", "BRINE", "RAVEN", "ADEPT", "GENT#"],
    // 1A GLIB 5A BRINE 6A RAVEN 7A ADEPT 8A GENT
    across: ["Smooth tongued", "Salty water", "Black bird", "Skilled", "Gentleman"],
    // 1D GRADE 2D LIVEN 3D INEPT 4D BENT 5D BRAG
    down: ["Mark on a test", "Brighten up", "Clumsy", "Not straight", "Boast"],
  },
  {
    rows: ["TIPS#", "ACUTE", "SIREN", "KNEAD", "#GEMS"],
    // 1A TIPS 5A ACUTE 7A SIREN 8A KNEAD 9A GEMS
    across: ["Hints", "Sharp", "Wailing alarm", "Work dough", "Jewels"],
    // 1D TASK 2D ICING 3D PUREE 4D STEAM 6D ENDS
    down: ["Job", "Cake topping", "Smooth mash", "Hot mist", "Finishes"],
  },
  {
    rows: ["#POTS", "METRE", "EATEN", "SCENT", "HERD#"],
    // 1A POTS 5A METRE 6A EATEN 7A SCENT 8A HERD
    across: ["Pans", "100 centimetres", "Had a meal", "Smell", "Group of animals"],
    // 1D PEACE 2D OTTER 3D TREND 4D SENT 5D MESH
    down: ["Calm", "River animal", "Fashion", "Posted", "Net"],
  },
  {
    rows: ["DUDS#", "USING", "PUREE", "EATEN", "#LYRE"],
    // 1A DUDS 5A USING 7A PUREE 8A EATEN 9A LYRE
    across: ["Clothes, informally", "With the help of", "Smooth mash", "Had a meal", "Old harp"],
    // 1D DUPE 2D USUAL 3D DIRTY 4D SNEER 6D GENE
    down: ["Trick", "Normal", "Muddy", "Look of scorn", "Unit of heredity"],
  },
];
