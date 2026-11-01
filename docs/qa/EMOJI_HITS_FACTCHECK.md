# Emoji Hits fact-check

Scope: every entry in `games/emojihits/content.ts` (songs in full, plus every film and TV entry so the
`needsReview` marker could come off). For each entry we checked the title, the `by` credit, the `year`
(or the hand-written `clue`), the `from` region, and whether the title or the song is suitable for young
players. Checked 2026-11-01 with web search; the main source is the English Wikipedia article for each
work, cross-checked against the other sources named.

How the hint reads: `A <year> <kind> by <by>.` unless a `clue` is set. Where sources disagree on a year
(album vs single, first release vs breakout), we kept the year the song or show first came out, or swapped
to a `clue` that states the history plainly.

Result: 91 entries (count kept off a multiple of 5). 1 removed, 1 added, 9 corrected, the rest confirmed.
`needsReview` export removed from `content.ts` (and from `logic.test.ts`). Emoji Hits is not in the admin
review desk (`lib/admin/content-files.ts`), so nothing else reads it.

## Changes

| Entry                 | Change                                                                                                              | Why / source                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kwaku the Traveller   | **Removed**                                                                                                         | Title and year (Black Sherif, 31 Mar 2022) are right, but the lyrics contain profanity (a review quoted on Wikipedia "Kwaku the Traveller"; streaming playlists tag it explicit). Not suitable for young players.        |
| Azonto                | **Added** (song, Fuse ODG, Ghana, clue only: "A Fuse ODG song named after a Ghanaian dance craze.")                 | Replaces the removed Ghanaian song and keeps the count at 91. Clean dance song. Wikipedia "Azonto (Fuse ODG song)"; Starr FM. Release dating differs (Ghana breakout vs UK release 29 Sep 2013), so no year in the hint. |
| Wish Me Well          | `clue` "A feel-good song by Kuami Eugene." replaced by `by: "Kuami Eugene"`, `year: 2018`                           | Released June 2018 (Wikipedia "Kuami Eugene"; on the album Rockstar, Dec 2018).                                                                                                                                          |
| Already               | year 2020 to **2019**                                                                                               | Released 19 Jul 2019 on The Lion King: The Gift; 2020 was the Black Is King video. Wikipedia "Already (song)"; Rolling Stone; OkayAfrica.                                                                                |
| Antenna               | year 2013 to **2012**                                                                                               | First released 23 Aug 2012 (premiered on BBC Radio 1Xtra); UK chart hit and re-release in 2013. Wikipedia "Fuse ODG", "Antenna (song)", "T.I.N.A. (album)".                                                              |
| Sunshine Day          | `by: "Osibisa"`, `year: 1976` replaced by clue "A 1976 UK hit for Osibisa, a band founded by Ghanaian musicians."   | On the 1975 album Welcome Home; the single reached UK No. 17 in Jan 1976. A bare "1976 song" was ambiguous. Wikipedia "Osibisa", "Welcome Home (Osibisa album)".                                                         |
| Osuofia in London     | by "Nkem Owoh" to **"Kingsley Ogoro"**                                                                              | Ogoro wrote, produced and directed it; Owoh is the star. Wikipedia "Osuofia in London", "Kingsley Ogoro".                                                                                                                |
| Aki and Pawpaw        | by "Chinedu Ikedieze and Osita Iheme" to **"Biodun Stephen"**                                                       | Directed by Biodun Stephen; Ikedieze and Iheme are the stars. Released 15 Dec 2021. Wikipedia "Aki and Pawpaw".                                                                                                          |
| Efiewura              | clue now says "from 2001"                                                                                           | Akan-language sitcom on TV3 Ghana, started 2001, about a landlord and his tenants. Wikipedia "Efiewura".                                                                                                                 |
| Things We Do for Love | clue "about senior high school students, from the early 2000s" to "from 2003 about teenagers at school and at home" | Aired on GTV in 2003 (began as a Joy FM radio drama), school and home life of young people. Wikipedia "Things We Do for Love (TV series)"; Citi Newsroom.                                                                |

## Songs (all checked)

| Title               | Hint data (after fixes)                           | From   | Checked / source                                                                                                                       | Change      |
| ------------------- | ------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Happy               | Pharrell Williams, 2013                           | world  | Despicable Me 2 soundtrack 2013, single Nov 2013. Wikipedia "Happy (Pharrell Williams song)"                                           | none        |
| Hello               | Adele, 2015                                       | world  | Released 23 Oct 2015. Wikipedia "Hello (Adele song)"                                                                                   | none        |
| Let It Go           | Idina Menzel, from Frozen, 2013                   | world  | Frozen (Nov 2013); Menzel single Jan 2014. Wikipedia "Let It Go", "Frozen (soundtrack)"                                                | none        |
| Thriller            | Michael Jackson, 1982                             | world  | Album track Nov 1982 (single 1983/84). Wikipedia "Thriller (song)"                                                                     | none        |
| Umbrella            | Rihanna, 2007                                     | world  | Released 29 Mar 2007. Wikipedia "Umbrella (song)"                                                                                      | none        |
| Firework            | Katy Perry, 2010                                  | world  | Single 26 Oct 2010. Wikipedia "Firework (song)"                                                                                        | none        |
| Yellow              | Coldplay, 2000                                    | world  | Single 26 Jun 2000. Wikipedia "Yellow (Coldplay song)"                                                                                 | none        |
| Halo                | Beyoncé, 2008                                     | world  | On I Am... Sasha Fierce (Nov 2008); single Jan 2009. Wikipedia "Halo (Beyoncé song)"                                                   | none        |
| Imagine             | John Lennon, 1971                                 | world  | Single 11 Oct 1971. Wikipedia "Imagine (song)"; History.com                                                                            | none        |
| Here Comes the Sun  | The Beatles, 1969                                 | world  | On Abbey Road (1969), by George Harrison. Wikipedia "Here Comes the Sun"                                                               | none        |
| Over the Rainbow    | Judy Garland, 1939                                | world  | The Wizard of Oz (1939); Arlen and Harburg. Wikipedia "Over the Rainbow"; Library of Congress                                          | none        |
| Uptown Funk         | Mark Ronson and Bruno Mars, 2014                  | world  | Released 10 Nov 2014. Wikipedia "Uptown Funk"                                                                                          | none        |
| Baby Shark          | Pinkfong, 2016                                    | world  | "Baby Shark Dance" 17 Jun 2016 (earlier Korean video Nov 2015). Wikipedia "Baby Shark"; Official Charts                                | none        |
| Dancing Queen       | ABBA, 1976                                        | world  | Single Aug 1976. Wikipedia "Dancing Queen"                                                                                             | none        |
| Blinding Lights     | The Weeknd, 2019                                  | world  | Single 29 Nov 2019. The Fader                                                                                                          | none        |
| Roar                | Katy Perry, 2013                                  | world  | Released 12 Aug 2013. Wikipedia "Roar (song)"; Rolling Stone                                                                           | none        |
| We Will Rock You    | Queen, 1977                                       | world  | Single 7 Oct 1977, News of the World. Wikipedia "We Will Rock You"                                                                     | none        |
| Africa              | Toto, 1982                                        | world  | Toto IV (1982), single 1982. Wikipedia "Africa (song)"                                                                                 | none        |
| Waka Waka           | Shakira, 2010                                     | world  | May 2010, 2010 World Cup song (feat. Freshlyground). Wikipedia; Sony press release                                                     | none        |
| Wavin' Flag         | K'naan, 2009                                      | africa | On Troubadour (Feb 2009). Wikipedia "Wavin' Flag"                                                                                      | none        |
| Jerusalema          | Master KG and Nomcebo Zikode, 2019                | africa | Released 29 Nov 2019. Wikipedia "Jerusalema"; Spotify newsroom                                                                         | none        |
| Pata Pata           | Miriam Makeba, 1967                               | africa | 1967 Reprise single/album (first recorded 1957). Wikipedia "Pata Pata"                                                                 | none        |
| Malaika             | clue (Swahili love song; Fadhili William, Makeba) | africa | Authorship disputed, so the clue names singers, not a writer or year. Wikipedia "Malaika"; Nation                                      | none        |
| Sweet Mother        | Prince Nico Mbarga, 1976                          | africa | Released Dec 1976 (Rogers All Stars). Wikipedia "Sweet Mother"                                                                         | none        |
| Water No Get Enemy  | Fela Kuti, 1975                                   | africa | Side B of Expensive Shit (1975). Wikipedia "Expensive Shit". Song title and lyrics are clean (the album title is not; it is not shown) | none        |
| Sunshine Day        | clue (1976 UK hit, Osibisa)                       | ghana  | See Changes                                                                                                                            | clue        |
| Forever             | Gyakie, 2020                                      | ghana  | 7 Aug 2020 on the Seed EP. Wikipedia "Forever (Gyakie song)"                                                                           | none        |
| Antenna             | Fuse ODG, 2012                                    | ghana  | See Changes                                                                                                                            | year        |
| Azonto              | clue (Fuse ODG, dance craze)                      | ghana  | See Changes                                                                                                                            | added       |
| Adonai              | Sarkodie and Castro, 2014                         | ghana  | 2014 (Sarkology era; remix video at Sarkcess Music launch). Wikipedia "Sarkodie (rapper)"; Graphic Online. Gospel-flavoured            | none        |
| Wish Me Well        | Kuami Eugene, 2018                                | ghana  | See Changes                                                                                                                            | by/year     |
| Already             | Beyoncé, Shatta Wale and Major Lazer, 2019        | ghana  | See Changes                                                                                                                            | year        |
| Terminator          | King Promise, 2023                                | ghana  | Released 5 May 2023. Wikipedia "Terminator (King Promise song)"                                                                        | none        |
| Calm Down           | Rema, 2022                                        | africa | Released 11 Feb 2022. The Fader                                                                                                        | none        |
| Free Mind           | Tems, 2020                                        | africa | On For Broken Ears, Sep 2020. Wikipedia "Free Mind"                                                                                    | none        |
| Lonely at the Top   | Asake, 2023                                       | africa | Released 16 Jun 2023 on Work of Art. Wikipedia "Lonely at the Top (song)". Themes: success and loneliness                              | none        |
| Rush                | Ayra Starr, 2022                                  | africa | Released 16 Sep 2022. Wikipedia "Rush (Ayra Starr song)"                                                                               | none        |
| Kwaku the Traveller | (Black Sherif, 2022)                              | ghana  | See Changes                                                                                                                            | **removed** |

## Films (all checked, by/year)

| Title                          | Hint data              | Source                                                                 | Change |
| ------------------------------ | ---------------------- | ---------------------------------------------------------------------- | ------ |
| The Lion King                  | Disney, 1994           | Wikipedia "The Lion King" (15 Jun 1994)                                | none   |
| Frozen                         | Disney, 2013           | h2g2; LoveToKnow                                                       | none   |
| Finding Nemo                   | Pixar, 2003            | Box Office Mojo                                                        | none   |
| Toy Story                      | Pixar, 1995            | Box Office Mojo / Disney                                               | none   |
| Jurassic Park                  | Steven Spielberg, 1993 | Box Office Pro                                                         | none   |
| Titanic                        | James Cameron, 1997    | Wikipedia; AFI Catalog                                                 | none   |
| Harry Potter                   | Warner Bros., 2001     | Wikipedia "...Philosopher's Stone (film)"                              | none   |
| Spider-Man                     | Marvel, 2002           | Wikipedia; Screen Daily (Marvel Enterprises co-produced)               | none   |
| Cars                           | Pixar, 2006            | Box Office Mojo                                                        | none   |
| Up                             | Pixar, 2009            | Box Office Mojo                                                        | none   |
| Shrek                          | DreamWorks, 2001       | multiple (18 May 2001)                                                 | none   |
| Moana                          | Disney, 2016           | Animation Magazine; AWN                                                | none   |
| The Little Mermaid             | Disney, 1989           | Disney release listings (17 Nov 1989)                                  | none   |
| Beauty and the Beast           | Disney, 1991           | Disney release listings                                                | none   |
| Kung Fu Panda                  | DreamWorks, 2008       | Animation Magazine                                                     | none   |
| Madagascar                     | DreamWorks, 2005       | DreamWorks filmography                                                 | none   |
| Star Wars                      | George Lucas, 1977     | Wikipedia "Star Wars (film)"; AFI                                      | none   |
| Home Alone                     | Chris Columbus, 1990   | Wikipedia; Britannica; AFI                                             | none   |
| The Wizard of Oz               | MGM, 1939              | Wikipedia; Box Office Mojo; History.com                                | none   |
| Despicable Me                  | Illumination, 2010     | Wikipedia "Despicable Me (film)"                                       | none   |
| Encanto                        | Disney, 2021           | release listings (24 Nov 2021)                                         | none   |
| Inside Out                     | Pixar, 2015            | Box Office Mojo                                                        | none   |
| Zootopia                       | Disney, 2016           | Animation Magazine; AWN                                                | none   |
| Ratatouille                    | Pixar, 2007            | Box Office Mojo                                                        | none   |
| Paddington                     | Paul King, 2014        | Wikipedia "Paddington (film)"                                          | none   |
| The Jungle Book                | Disney, 1967           | LoveToKnow chronological list                                          | none   |
| Aladdin                        | Disney, 1992           | Disney release listings                                                | none   |
| Black Panther                  | Marvel, 2018           | Screen Daily; release listings (16 Feb 2018)                           | none   |
| Queen of Katwe                 | Mira Nair, 2016        | Wikipedia "Queen of Katwe"                                             | none   |
| The Boy Who Harnessed the Wind | Chiwetel Ejiofor, 2019 | Wikipedia; RogerEbert.com                                              | none   |
| Kirikou and the Sorceress      | Michel Ocelot, 1998    | Wikipedia                                                              | none   |
| Love Brewed in the African Pot | Kwaw Ansah, 1980       | Wikipedia (one festival listing says 1981)                             | none   |
| The Wedding Party              | Kemi Adetiba, 2016     | Wikipedia "The Wedding Party (2016 film)"                              | none   |
| Lionheart                      | Genevieve Nnaji, 2018  | Wikipedia "Lionheart (2018 film)" (TIFF Sep 2018)                      | none   |
| Chief Daddy                    | Niyi Akinmolayan, 2018 | Wikipedia "Chief Daddy"                                                | none   |
| Battle on Buka Street          | Funke Akindele, 2022   | Wikipedia (co-directed with Tobi Makinde; she also produced and stars) | none   |
| Osuofia in London              | Kingsley Ogoro, 2003   | Wikipedia                                                              | by     |
| Aki and Pawpaw                 | Biodun Stephen, 2021   | Wikipedia                                                              | by     |

## TV (all checked)

| Title                 | Hint data                       | Source                                       | Change |
| --------------------- | ------------------------------- | -------------------------------------------- | ------ |
| The Simpsons          | Matt Groening, 1989             | Wikipedia (17 Dec 1989)                      | none   |
| SpongeBob SquarePants | Nickelodeon, 1999               | Wikipedia (1 May 1999)                       | none   |
| Peppa Pig             | Astley Baker Davies, 2004       | Wikipedia (31 May 2004)                      | none   |
| Bluey                 | Ludo Studio, 2018               | Wikipedia; Screen Queensland (1 Oct 2018)    | none   |
| Doctor Who            | the BBC, 1963                   | Wikipedia (23 Nov 1963)                      | none   |
| Sesame Street         | clue: 1969, the Muppets         | multiple (10 Nov 1969)                       | none   |
| Tom and Jerry         | clue: 1940, Hanna and Barbera   | Wikipedia "Puss Gets the Boot" (10 Feb 1940) | none   |
| Mr. Bean              | Rowan Atkinson, 1990            | Wikipedia; British Comedy Guide (1 Jan 1990) | none   |
| PAW Patrol            | Spin Master, 2013               | Wikipedia (12 Aug 2013)                      | none   |
| Pokémon               | Nintendo and Game Freak, 1997   | Wikipedia (1 Apr 1997, TV Tokyo)             | none   |
| Efiewura              | clue: Ghanaian comedy from 2001 | Wikipedia                                    | clue   |
| Things We Do for Love | clue: Ghanaian drama from 2003  | Wikipedia; Citi Newsroom                     | clue   |
| Tinga Tinga Tales     | Tiger Aspect and Homeboyz, 2010 | Wikipedia (Feb 2010, CBeebies)               | none   |
| Supa Strikas          | Strika Entertainment, 2008      | Wikipedia; TheTVDB (6 Dec 2008, SABC 1)      | none   |
| Iwájú                 | Kugali and Disney, 2024         | Disney+ press (28 Feb 2024)                  | none   |
| Jenifa's Diary        | Funke Akindele, 2015            | Wikipedia (15 Apr 2015)                      | none   |

## Left as judgement calls

- **Lonely at the Top** (Asake): no official explicit rating found; user playlists list it untagged and
  the lyrics are about success and loneliness. Kept.
- **Uptown Funk** and **Blinding Lights**: mainstream, not marked explicit; kept.
- **Baby Shark** 2016 vs 2015: kept 2016, the "Baby Shark Dance" release that made it famous.
- **Pokémon** "by Nintendo and Game Freak": the anime is made by OLM for TV Tokyo, but the franchise
  credit is reasonable for a hint. Kept.
- Mix after changes: 37 songs, 38 films, 16 TV; 11 Ghana, 23 rest of Africa, 57 world.
