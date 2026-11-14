import { describe, expect, it } from "vitest";
import { sitemapEntries as sitemap } from "./sitemap";
import robots from "@/app/robots";
import { ALL_GAMES, GAME_COUNT, GAMES, LAB_GAMES, MERGED_WORLDS, RETIRED_GAMES, WORLDS } from "@/lib/catalog";
import { GAME_SEO, SITE_FAQ, seoMeta, siteFaq } from "@/lib/copy/seo";
import { AI_CRAWLERS, PRIVATE_PATHS } from "./crawlers";
import { gameDescription, gameFacts, gameModes, gameTitle, publicCounts, publicGame, publicGames, publicGamesInWorld } from "./games";
import { llmsFullTxt, llmsTxt } from "./llms";
import { breadcrumbs, faqPage, graph, jsonLdScript, organization, videoGame, webApplication, website } from "./jsonld";
import { SITE_URL, absoluteUrl, publicMetadata } from "./site";
import { indexNowKeyResponse, isIndexNowKey } from "./indexnow";
import { isRaceGame } from "@/lib/multiplayer/games";
import { isLadderGame } from "@/lib/game/levels";

const hidden = [...LAB_GAMES, ...RETIRED_GAMES];

describe("sitemap", () => {
  const urls = sitemap().map((e) => e.url);

  it("lists the home page, the catalogue, every live game and the public pages, all absolute", () => {
    for (const path of ["/", "/games", "/library", "/how-to-play", "/fair-play", "/privacy", "/terms", "/contact"])
      expect(urls, path).toContain(absoluteUrl(path));
    for (const g of GAMES.filter((x) => !x.variantOf)) expect(urls, g.id).toContain(absoluteUrl(`/games/${g.id}`));
    for (const u of urls) expect(u.startsWith(`${SITE_URL}/`), u).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("never lists a folded (redirecting) world, a lab or retired game, or /about (canonical is /)", () => {
    for (const from of Object.keys(MERGED_WORLDS)) expect(urls).not.toContain(absoluteUrl(`/world/${from}`));
    for (const w of WORLDS) expect(urls).toContain(absoluteUrl(`/world/${w.id}`));
    for (const g of hidden) expect(urls, g.id).not.toContain(absoluteUrl(`/games/${g.id}`));
    expect(urls).not.toContain(absoluteUrl("/about"));
  });

  it("dates every entry", () => {
    for (const e of sitemap()) expect(e.lastModified).toBeInstanceOf(Date);
  });
});

describe("robots", () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];

  it("lets everyone crawl the public pages and keeps the private ones out", () => {
    const all = rules.find((x) => x.userAgent === "*")!;
    expect(all.allow).toBe("/");
    for (const p of ["/admin", "/api/", "/u/", "/bay/", "/party/", "/duel/", "/challenge/", "/i/"]) expect(all.disallow).toContain(p);
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("names the major AI crawlers with their own allow group (GEO), private paths still out", () => {
    const ai = rules.find((x) => Array.isArray(x.userAgent))!;
    for (const bot of [
      "GPTBot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "ClaudeBot",
      "Claude-Web",
      "PerplexityBot",
      "Google-Extended",
      "Applebot-Extended",
      "CCBot",
    ])
      expect(ai.userAgent).toContain(bot);
    expect(ai.userAgent).toEqual(AI_CRAWLERS);
    expect(ai.allow).toContain("/");
    expect(ai.disallow).toEqual(PRIVATE_PATHS);
  });
});

describe("llms.txt", () => {
  const short = llmsTxt();
  const full = llmsFullTxt();

  it("follows llmstxt.org: an H1, a summary blockquote, then sections of links", () => {
    const lines = short.split("\n");
    expect(lines[0]).toBe("# SPUZL");
    expect(lines[2].startsWith("> ")).toBe(true);
    expect(short).toMatch(/^## Games$/m);
    for (const path of ["/how-to-play", "/fair-play", "/privacy"]) expect(short).toContain(`(${absoluteUrl(path)})`);
  });

  it("links every live game's page, and never a lab or retired game", () => {
    for (const g of GAMES.filter((x) => !x.variantOf)) {
      expect(short, g.id).toContain(`[${g.name}](${absoluteUrl(`/games/${g.id}`)})`);
      expect(full, g.id).toContain(`#### ${g.name}`);
      expect(full, g.id).toContain(g.rule);
    }
    for (const g of hidden) {
      expect(short, g.id).not.toContain(`/games/${g.id})`);
      expect(full, g.id).not.toContain(`/games/${g.id}\n`);
    }
  });

  it("carries the FAQ and the under-16 safety rules in the full file", () => {
    for (const { q } of SITE_FAQ) expect(full).toContain(`### ${q}`);
    expect(full).toContain("13 and over");
    expect(full).toContain("Quick Match only ever pairs them with other 13 to 15 players");
    expect(full).toContain("preset phrases only");
  });
});

describe("public pages follow the Games page state", () => {
  const sw = (testing: string[] = [], off: string[] = [], noVersus: string[] = []) => ({
    "games.testing": testing,
    "games.off": off,
    "games.noVersus": noVersus,
  });
  const closed = sw(["flagged"], ["crownfall"]);

  it("never show a game In testing or Off: no page, sitemap entry, llms.txt line or count", () => {
    const urls = sitemap(closed).map((e) => e.url);
    const short = llmsTxt(undefined, closed);
    const full = llmsFullTxt(undefined, closed);
    for (const id of ["flagged", "crownfall"]) {
      const g = GAMES.find((x) => x.id === id)!;
      expect(publicGame(id, closed), id).toBeUndefined();
      expect(urls, id).not.toContain(absoluteUrl(`/games/${id}`));
      expect(short, id).not.toContain(absoluteUrl(`/games/${id}`));
      expect(full, id).not.toContain(`#### ${g.name}`);
      expect(
        publicGamesInWorld(g.world, closed).map((x) => x.id),
        id,
      ).not.toContain(id);
    }
    expect(publicGames(closed)).toHaveLength(GAME_COUNT - 2);
    expect(short).toContain(`All ${GAME_COUNT - 2} games`);
    expect(short).toContain(`with ${GAME_COUNT - 2} short games`);
    expect(full).toContain(`- Games: ${GAME_COUNT - 2} in ${WORLDS.length} worlds`);
    expect(publicCounts(closed)).toMatchObject({ games: GAME_COUNT - 2, worlds: WORLDS.length });
    for (const g of RETIRED_GAMES) expect(publicGame(g.id, sw()), g.id).toBeUndefined();
  });

  it("drops a world whose games are all Off, from the sitemap and the counts", () => {
    const board = GAMES.filter((g) => g.world === "board").map((g) => g.id);
    const s = sw([], board);
    expect(sitemap(s).map((e) => e.url)).not.toContain(absoluteUrl("/world/board"));
    expect(publicCounts(s).worlds).toBe(WORLDS.length - 1);
    expect(publicCounts(s).names).not.toContain("Board Games");
  });

  it("claims Duels and Parties only for a race game the admin lets players race", () => {
    const race = GAMES.find((g) => isRaceGame(g.id))!;
    expect(gameModes(race, sw())).toContain("duel");
    expect(gameModes(race, sw([], [], [race.id]))).not.toContain("duel");
    expect(gameModes(race, sw([], [], [race.id]))).not.toContain("party");
  });

  it("counts the On games in the FAQ and summaries where a page can follow them", () => {
    expect(siteFaq(3, 2, "A and B")[0].a).toContain("It has 3 short games in 2 worlds: A and B.");
    expect(SITE_FAQ[0].a).toContain(`${GAME_COUNT} short games`);
    expect(seoMeta.gamesFor(39).title).toBe("All 39 free online puzzle games | SPUZL");
    expect(seoMeta.howToPlayFor(39).description).toContain("all 39 SPUZL games");
  });
});

describe("lab games", () => {
  it("each have their own search wording, whole in the search description", () => {
    for (const g of LAB_GAMES) {
      expect(GAME_SEO[g.id], g.id).toBeTruthy();
      expect(gameDescription(g), g.id).toContain(GAME_SEO[g.id].where);
    }
  });
});

describe("game facts", () => {
  it("covers every live game, and only live games", () => {
    for (const g of GAMES) expect(GAME_SEO[g.id], g.id).toBeTruthy();
    for (const g of hidden) expect(publicGame(g.id), g.id).toBeUndefined();
    expect(publicGame("nope")).toBeUndefined();
    for (const g of GAMES) expect(publicGame(g.id)).toBe(g);
  });

  it("derives modes from the code: races, levels, matches and bots", () => {
    for (const g of GAMES) {
      const m = gameModes(g);
      expect(m[0]).toBe("free");
      expect(m.includes("duel"), g.id).toBe(isRaceGame(g.id));
      expect(m.includes("levels"), g.id).toBe(isLadderGame(g.id));
      expect(m.includes("bot"), g.id).toBe(!!g.botPlay);
    }
  });

  it("gives 3 to 5 questions per game, each answered", () => {
    for (const g of GAMES) {
      const f = gameFacts(g);
      expect(f.faq.length, g.id).toBeGreaterThanOrEqual(3);
      expect(f.faq.length, g.id).toBeLessThanOrEqual(5);
      for (const { q, a } of f.faq) expect(q.endsWith("?") && a.length > 20, g.id).toBe(true);
      expect(f.definition.startsWith(`${g.name} is a free online `), g.id).toBe(true);
      expect(f.related.every((x) => x.world === g.world && x.id !== g.id)).toBe(true);
    }
  });
});

describe("JSON-LD", () => {
  const parse = (d: Record<string, unknown>) => JSON.parse(jsonLdScript(d)) as Record<string, unknown>;

  it("escapes < so a value can never close the script tag", () => {
    const s = jsonLdScript({ name: "</script><b>" });
    expect(s).not.toContain("<");
    expect(JSON.parse(s).name).toBe("</script><b>");
  });

  it("describes each game as a free VideoGame for web browsers", () => {
    for (const g of GAMES) {
      const v = parse(graph(videoGame(gameFacts(g))))["@graph"] as Record<string, unknown>[];
      const game = v[0];
      expect(game["@type"]).toBe("VideoGame");
      expect(game.name).toBe(g.name);
      expect(game.url).toBe(absoluteUrl(`/games/${g.id}`));
      expect(game.gamePlatform).toBe("Web browser");
      expect(game.applicationCategory).toBe("Game");
      expect(game.inLanguage).toBe("en");
      expect((game.offers as Record<string, unknown>).price).toBe("0");
      expect((game.publisher as Record<string, unknown>)["@type"]).toBe("Organization");
      expect(String(game.image)).toMatch(/^https:\/\//);
      expect((game.genre as string[]).length).toBeGreaterThan(0);
      expect(String(game.description).length).toBeGreaterThan(40);
    }
  });

  it("builds the site, app, breadcrumb and FAQ nodes with their required fields", () => {
    const d = parse(graph(organization(), website(), webApplication(), breadcrumbs([["SPUZL", "/"]]), faqPage(SITE_FAQ)));
    expect(d["@context"]).toBe("https://schema.org");
    const [org, site, app, crumbs, faq] = d["@graph"] as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(org).toMatchObject({ "@type": "Organization", name: "SPUZL", url: `${SITE_URL}/` });
    expect(org.logo.url).toBe(`${SITE_URL}/icon.png`);
    expect(site).toMatchObject({ "@type": "WebSite", name: "SPUZL" });
    expect(app).toMatchObject({
      "@type": "WebApplication",
      applicationCategory: "GameApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
    });
    expect(app.offers.price).toBe("0");
    expect(crumbs.itemListElement[0]).toMatchObject({ "@type": "ListItem", position: 1, item: `${SITE_URL}/` });
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity).toHaveLength(SITE_FAQ.length);
    for (const q of faq.mainEntity) expect(q.acceptedAnswer.text.length).toBeGreaterThan(20);
  });
});

describe("metadata", () => {
  it("keeps every game title under 60 characters, unique, and every description under 155", () => {
    const titles = GAMES.map(gameTitle);
    for (const [i, t] of titles.entries()) {
      expect(t.length, t).toBeLessThan(60);
      expect(t, t).toContain(GAMES[i].name);
      expect(t.endsWith("| SPUZL"), t).toBe(true);
    }
    expect(new Set(titles).size).toBe(titles.length);
    for (const g of GAMES) {
      const d = gameDescription(g);
      expect(d.length, g.id).toBeLessThan(155);
      expect(d.length, g.id).toBeGreaterThan(60);
    }
  });

  it("gives the public pages unique titles under 60 and descriptions under 155", () => {
    const pages = [
      seoMeta.landing,
      seoMeta.games,
      seoMeta.library,
      seoMeta.howToPlay,
      seoMeta.fairPlay,
      seoMeta.privacy,
      seoMeta.terms,
      seoMeta.contact,
      ...WORLDS.map((w) => seoMeta.world(w.name, w.tagline, 9)),
    ];
    for (const p of pages) {
      expect(p.title.length, p.title).toBeLessThan(60);
      expect(p.description.length, p.description).toBeLessThan(155);
    }
    const titles = [...pages.map((p) => p.title), ...GAMES.map(gameTitle)];
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("sets a canonical, an absolute title and matching Open Graph tags", () => {
    const m = publicMetadata({ path: "/games", ...seoMeta.games });
    expect(m.alternates?.canonical).toBe("/games");
    expect(m.title).toEqual({ absolute: seoMeta.games.title });
    expect(m.openGraph).toMatchObject({ url: "/games", title: seoMeta.games.title, siteName: "SPUZL" });
    expect((m.openGraph as { images?: unknown[] }).images).toHaveLength(1);
    // A page with its own opengraph-image file leaves the image to it.
    expect(publicMetadata({ path: "/games/crownfall", title: "t", description: "d", image: false }).openGraph).not.toHaveProperty("images");
  });
});

describe("IndexNow key file", () => {
  it("serves the key at /<key>.txt only, and nothing when no valid key is set", async () => {
    const key = "0123456789abcdef0123456789abcdef";
    const r = indexNowKeyResponse(`/${key}.txt`, key)!;
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/plain");
    expect(await r.text()).toBe(key);
    expect(indexNowKeyResponse("/other.txt", key)).toBeNull();
    expect(indexNowKeyResponse(`/${key}.txt`, undefined)).toBeNull();
    expect(indexNowKeyResponse("/short.txt", "short")).toBeNull();
    expect(isIndexNowKey("bad key with spaces")).toBe(false);
  });
});

it("knows every game in code (sanity for the lists above)", () => {
  expect(GAMES.length + hidden.length).toBe(ALL_GAMES.length);
});
