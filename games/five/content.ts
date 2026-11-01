/**
 * Five answers: 580 common, family-friendly 5-letter words picked by hand (banku included), each one checked
 * against the shared dictionary (games/_shared/words) in logic.test.ts. Any dictionary word is a valid guess;
 * only these can be the hidden word. Server only: the board never imports this file.
 */
export const needsReview = true;

const LIST = `
about above actor acute adult after again agree ahead alarm album alert alike alive allow alone along amaze
angle angry apple apply apron arena argue arise arrow aside audio award aware awful bacon badge baker banku
basic basin batch beach beard beast begin being belly below bench berry birth black blade blame blank blast
blaze blend bless blind block bloom board boast bonus boost booth bound brain brake brand brave bread break
brick bride brief bring broad brook brown brush build bunch burst cabin cable camel candy canoe cargo carry
catch cause chain chair chalk charm chart chase cheap check cheek cheer chess chest chick chief child chill
choir civic claim class clean clear clerk click cliff climb clock close cloth cloud clown coach coast cocoa
color coral couch count court cover craft crane crash cream creek crisp cross crowd crown crumb crust curve
cycle daily dairy daisy dance delay depth diary digit dizzy dough draft drain drama drawn dream dress dried
drift drink drive eager eagle early earth eight elbow elder empty enjoy enter entry equal error essay event
every exact exist extra fable faint fairy faith false fancy feast fence ferry fetch fever field fifth fifty
final flame flash fleet float flock flood floor flour fluid flute focus force forge forth forty forum found
frame fresh front frost fruit fudge funny gauge ghost giant given glass globe glory glove goose grace grade
grain grand grape graph grass great green greet grill group grove guard guess guest guide habit happy harsh
heart heavy hedge hello hobby honey horse hotel house human humor hurry ideal image index inner input issue
ivory jelly jewel joint jolly judge juice jumbo kayak knife knock label laser later laugh layer learn lemon
level light limit linen liver lodge logic loose lucky lunar lunch magic major mango maple march marsh match
maybe mayor medal melon mercy merry metal meter might minor mixer model money month moral motor mount mouse
mouth movie music nerve never night noble noise north novel nurse ocean offer often olive onion opera orbit
order other otter ought outer owner paint panel paper party pasta patch pause peace peach pearl pedal penny
phone photo piano piece pilot pitch pizza place plain plane plant plate plaza point polar porch pouch power
press price pride prize proof proud pulse punch puppy queen quest quick quiet quilt quite quote radio rainy
raise rally ranch range rapid raven reach ready relax reply rider ridge right river roast robin robot rocky
round route royal ruler rural salad salty sandy sauce scale scarf scene scent scoop score scout screw seven
shade shake shape share shark sharp sheep shelf shell shine shirt shock shore short shout sight silky silly
since skate skill skirt slate sleep slice slide slope smart smile smoke snack snake solar solid solve sound
south space spare spark speak speed spell spend spice spine spoon sport spray squad stack staff stage stair
stamp stand stare start state steam steel stick still stone stool storm story stove straw strip study style
sugar sunny super swamp sweet swift swing table taste teach teeth thank theme thick thing think third three
throw thumb tiger timer toast today token topic torch total touch towel tower track trade trail train treat
trend trial trick truck truly trunk trust truth tulip twice twist uncle under unity until upper urban usual
vapor video vital vivid vocal voice wagon watch water whale wheat wheel where while whole woman world write
yacht young youth zebra
`;

/** Uppercase, alphabetical. Days pick from a fixed shuffle of this list (logic.ts). */
export const ANSWERS: readonly string[] = LIST.trim().toUpperCase().split(/\s+/);
