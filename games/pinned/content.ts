/**
 * Pinned landmarks. Original one-line descriptions stand in for photos (no licensed images).
 * Coordinates are decimal degrees to about 0.01 degree (roughly 1 km), which is far finer than the
 * scoring scale. Places of worship and political monuments are left out.
 * Needs owner review before scheduling (see /admin).
 */
export interface Landmark {
  name: string;
  line: string;
  lat: number;
  lon: number;
  map: "world" | "africa";
}

export const needsReview = true;

type Row = [string, string, number, number];

const AFRICA: Row[] = [
  ["Cape Coast Castle", "A whitewashed coastal fort on Ghana's Central Region shore", 5.104, -1.241],
  ["Elmina Castle", "The oldest European building in sub-Saharan Africa, in a Ghanaian fishing town", 5.083, -1.349],
  ["Kakum canopy walkway", "Rope bridges high in a Ghanaian rainforest", 5.35, -1.38],
  ["Mole National Park", "Ghana's largest wildlife park, elephants on the savanna", 9.26, -1.85],
  ["Lake Bosomtwe", "A round crater lake ringed by hills, south of Kumasi", 6.5, -1.41],
  ["Wli Waterfalls", "Ghana's tallest waterfall, near the Togo border", 7.12, 0.59],
  ["Akosombo Dam", "The dam that holds back Lake Volta", 6.3, 0.06],
  ["Kejetia Market", "One of West Africa's biggest markets, in Kumasi", 6.7, -1.62],
  ["Paga crocodile ponds", "Village ponds of famously calm crocodiles in Ghana's far north", 10.98, -1.11],
  ["Nzulezu stilt village", "A whole village built on stilts over a lagoon in western Ghana", 4.97, -2.33],
  ["Goree Island", "A small island of colourful houses off Senegal's capital", 14.667, -17.398],
  ["Lake Retba", "Senegal's pink lake, coloured by salt loving algae", 14.84, -17.23],
  ["Zuma Rock", "A giant granite dome beside the road into Abuja", 9.13, 7.23],
  ["Olumo Rock", "A climbable rock outcrop above the city of Abeokuta", 7.16, 3.35],
  ["Lekki canopy walkway", "A long treetop walkway in a Lagos nature reserve", 6.44, 3.53],
  ["Timbuktu", "A desert city on the edge of the Sahara, famed for old manuscripts", 16.77, -3.01],
  ["Bandiagara Escarpment", "Sandstone cliffs with villages built into them, in Mali", 14.35, -3.6],
  ["Mount Cameroon", "An active volcano rising straight from the Atlantic coast", 4.2, 9.17],
  ["Bijagos Islands", "An archipelago of mangroves and beaches off Guinea-Bissau", 11.25, -16.0],
  ["Bunce Island", "A river island fort in the estuary near Freetown", 8.57, -13.04],
  ["Pyramids of Giza", "The last standing wonder of the ancient world", 29.979, 31.134],
  ["Abu Simbel", "Colossal statues carved into a cliff beside Lake Nasser", 22.337, 31.626],
  ["Victoria Falls", "The smoke that thunders, on the Zambezi", -17.925, 25.857],
  ["Mount Kilimanjaro", "Africa's highest peak, a snow capped volcano", -3.067, 37.355],
  ["Table Mountain", "A flat topped mountain above a southern harbour city", -33.963, 18.409],
  ["Cape of Good Hope", "A rocky headland near Africa's southwestern tip", -34.357, 18.474],
  ["Serengeti", "Plains crossed each year by the great wildebeest migration", -2.33, 34.83],
  ["Ngorongoro Crater", "A vast collapsed volcano full of wildlife", -3.2, 35.5],
  ["Sossusvlei", "Towering red dunes in the Namib Desert", -24.73, 15.34],
  ["Okavango Delta", "A river that spreads into a green maze and never reaches the sea", -19.3, 22.9],
  ["Avenue of the Baobabs", "A dirt road lined with giant baobab trees in Madagascar", -20.25, 44.42],
  ["Source of the Nile", "Where the White Nile leaves Lake Victoria, at Jinja", 0.42, 33.2],
  ["Murchison Falls", "The Nile squeezes through a gap just 7 metres wide", 2.28, 31.69],
  ["Mount Kenya", "Africa's second highest mountain, right on the Equator", -0.15, 37.31],
  ["Stone Town", "Old coral stone streets on the island of Zanzibar", -6.16, 39.19],
  ["Ait Benhaddou", "A mud brick fortified village on the old Saharan caravan route", 31.05, -7.13],
  ["Carthage", "Ruins of an ancient trading city outside Tunis", 36.85, 10.33],
  ["Erg Chebbi", "Orange sand dunes on Morocco's edge of the Sahara", 31.15, -3.97],
  ["Fish River Canyon", "One of the largest canyons on Earth, in southern Namibia", -27.6, 17.6],
];

const WORLD: Row[] = [
  ["Eiffel Tower", "An iron lattice tower beside the Seine", 48.858, 2.294],
  ["Colosseum", "An ancient oval arena in the heart of Rome", 41.89, 12.492],
  ["Elizabeth Tower", "The clock tower that houses the bell Big Ben", 51.501, -0.125],
  ["Alhambra", "A red hilltop palace and fortress in southern Spain", 37.176, -3.588],
  ["Acropolis", "Ancient columns on a rocky hill above Athens", 37.972, 23.726],
  ["Stonehenge", "A prehistoric ring of standing stones on an English plain", 51.179, -1.826],
  ["Brandenburg Gate", "A neoclassical gateway in Berlin", 52.516, 13.378],
  ["Leaning Tower of Pisa", "A bell tower famous for its tilt", 43.723, 10.397],
  ["Neuschwanstein Castle", "A fairytale castle on a crag in the Bavarian Alps", 47.558, 10.75],
  ["Matterhorn", "A pyramid shaped peak on the Swiss Italian border", 45.976, 7.659],
  ["Geirangerfjord", "A deep blue fjord between waterfalls in western Norway", 62.1, 7.09],
  ["Cliffs of Moher", "Sea cliffs on Ireland's Atlantic coast", 52.972, -9.431],
  ["Giant's Causeway", "Thousands of six sided basalt columns by the sea", 55.241, -6.512],
  ["Edinburgh Castle", "A fortress on an old volcanic rock above a capital city", 55.949, -3.2],
  ["Gullfoss", "A two step waterfall in Iceland's highlands", 64.327, -20.12],
  ["Venice", "A city of canals built on a lagoon", 45.441, 12.316],
  ["Santorini", "White houses on the rim of a sunken volcano", 36.4, 25.46],
  ["Cappadocia", "Fairy chimney rocks and hot air balloons in central Turkey", 38.64, 34.83],
  ["Pamukkale", "White travertine terraces of warm spring water", 37.92, 29.12],
  ["Petra", "A city carved into rose coloured rock", 30.329, 35.444],
  ["Dead Sea", "The lowest point on land, water so salty you float", 31.5, 35.5],
  ["Burj Khalifa", "The world's tallest building, in Dubai", 25.197, 55.274],
  ["Taj Mahal", "A white marble mausoleum on the Yamuna river", 27.175, 78.042],
  ["Mount Everest", "The highest mountain above sea level", 27.988, 86.925],
  ["Great Wall at Badaling", "A restored stretch of the Great Wall north of Beijing", 40.36, 116.02],
  ["Forbidden City", "A vast palace complex, now a museum, in Beijing", 39.916, 116.397],
  ["Zhangjiajie", "Sandstone pillars that rise out of the forest like towers", 29.32, 110.43],
  ["Mount Fuji", "A snow capped volcano seen from Tokyo on clear days", 35.361, 138.727],
  ["Ha Long Bay", "Limestone islands rising from emerald water", 20.91, 107.18],
  ["Banaue Rice Terraces", "Mountain rice terraces carved by hand 2,000 years ago", 16.92, 121.06],
  ["Mount Kinabalu", "The highest peak on the island of Borneo", 6.075, 116.558],
  ["Komodo National Park", "Islands home to the world's largest lizard", -8.55, 119.49],
  ["Victoria Peak", "A lookout above a crowded harbour of skyscrapers", 22.276, 114.146],
  ["Lake Baikal", "The world's deepest lake, in Siberia", 53.5, 108.0],
  ["Sydney Opera House", "A harbourside theatre with roofs like sails", -33.857, 151.215],
  ["Uluru", "A giant red sandstone monolith in the outback", -25.344, 131.037],
  ["Great Barrier Reef", "The world's largest coral reef, off Cairns", -16.5, 146.3],
  ["Milford Sound", "A fjord walled by sheer cliffs and waterfalls", -44.641, 167.897],
  ["Statue of Liberty", "A copper statue holding a torch over a harbour", 40.689, -74.045],
  ["Golden Gate Bridge", "A red suspension bridge across a foggy strait", 37.82, -122.478],
  ["Grand Canyon", "A mile deep gorge carved by the Colorado River", 36.107, -112.113],
  ["Niagara Falls", "Thundering falls on the US and Canada border", 43.096, -79.038],
  ["Old Faithful", "A geyser that erupts like clockwork", 44.461, -110.828],
  ["CN Tower", "A needle shaped tower above Lake Ontario", 43.643, -79.387],
  ["Lake Louise", "A turquoise glacier lake in the Rocky Mountains", 51.425, -116.177],
  ["Chichen Itza", "A stepped Maya pyramid on the Yucatan peninsula", 20.684, -88.568],
  ["Teotihuacan", "The Pyramid of the Sun, north of Mexico City", 19.693, -98.844],
  ["Panama Canal", "Locks that lift ships between two oceans", 9.0, -79.59],
  ["Machu Picchu", "An Inca citadel high in the Andes", -13.163, -72.545],
  ["Sugarloaf Mountain", "A granite peak with a cable car over Guanabara Bay", -22.949, -43.157],
  ["Iguazu Falls", "Hundreds of waterfalls on the Argentina Brazil border", -25.695, -54.437],
  ["Salar de Uyuni", "The world's largest salt flat, a giant mirror after rain", -20.13, -67.49],
  ["Easter Island", "Giant stone heads on a remote Pacific island", -27.12, -109.37],
  ["Galapagos Islands", "Volcanic islands of giant tortoises", -0.8, -91.1],
  ["Angel Falls", "The world's tallest uninterrupted waterfall", 5.967, -62.535],
  ["Torres del Paine", "Granite towers above glacier lakes in Patagonia", -50.94, -73.41],
  ["Perito Moreno Glacier", "A wall of ice that cracks into a lake", -50.497, -73.138],
  ["Hermitage Museum", "A green and white palace full of art in St Petersburg", 59.94, 30.315],
];

export const CONTENT: Landmark[] = [
  ...AFRICA.map(([name, line, lat, lon]) => ({ name, line, lat, lon, map: "africa" as const })),
  ...WORLD.map(([name, line, lat, lon]) => ({ name, line, lat, lon, map: "world" as const })),
];
