import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { GAMES, LAB_GAMES, RETIRED_GAMES, WORLDS, type GameSwitch } from "@/lib/catalog";
import { seoMeta } from "@/lib/copy/seo";
import { TOPIC_LABELS, boardFriendsCopy, owareCopy, owareRules, topicsCopy } from "@/lib/copy/topics";
import { CYCLE_LIMIT } from "@/games/oware/rules";
import { PITS } from "@/games/oware/engine";
import { BAY_GAMES, CLOCK_MINUTES } from "@/lib/multiplayer/bay";
import { PARTY_MAX } from "@/lib/multiplayer/constants";
import { isRaceGame } from "@/lib/multiplayer/games";
import { gameTitle } from "./games";
import { sitemapEntries } from "./sitemap";
import { llmsFullTxt, llmsTxt } from "./llms";
import { SITE_URL, absoluteUrl } from "./site";
import { breadcrumbs, graph, howTo, jsonLdScript, organization, topicPageNode } from "./jsonld";
import { GUIDE_SLUGS, TOPIC_SLUGS, publicTopics, topicGroups, topicPage, topicsForGame } from "./topics";

const sw = (testing: string[] = [], off: string[] = [], noVersus: string[] = []): GameSwitch => ({
  "games.testing": testing,
  "games.off": off,
  "games.noVersus": noVersus,
});
const ALL = [...TOPIC_SLUGS, ...GUIDE_SLUGS];
const hidden = [...LAB_GAMES, ...RETIRED_GAMES].map((g) => g.id);

describe("guides and game lists: page data", () => {
  const pages = publicTopics();

  it("serves every page with every game On, each with a label and its own path", () => {
    expect(pages.map((p) => p.slug)).toEqual(ALL);
    for (const p of pages) {
      expect(TOPIC_LABELS[p.slug], p.slug).toBeTruthy();
      expect(p.path).toBe(`/${p.kind === "topic" ? "topics" : "guides"}/${p.slug}`);
    }
  });

  it("keeps titles under 60 characters and unique (with every other public title), descriptions under 155", () => {
    for (const p of pages) {
      expect(p.title.length, p.title).toBeLessThan(60);
      expect(p.title.endsWith("| SPUZL"), p.title).toBe(true);
      expect(p.description.length, p.slug).toBeLessThan(155);
      expect(p.description.length, p.slug).toBeGreaterThan(60);
    }
    const others = [seoMeta.landing, seoMeta.games, seoMeta.howToPlay, seoMeta.library, seoMeta.fairPlay].map((m) => m.title);
    const titles = [...pages.map((p) => p.title), topicsCopy.index.title, ...others, ...GAMES.map(gameTitle)];
    expect(new Set(titles).size).toBe(titles.length);
    expect(topicsCopy.index.title.length).toBeLessThan(60);
    expect(topicsCopy.index.description.length).toBeLessThan(155);
  });

  it("opens with a short answer, has an H1, sections and a 3 to 5 question FAQ", () => {
    for (const p of pages) {
      expect(p.h1.length, p.slug).toBeGreaterThan(10);
      expect(p.answer.length, p.slug).toBeGreaterThan(80);
      expect(p.answer.length, p.slug).toBeLessThan(400);
      expect(p.answer.split(/(?<=[.!?])\s+/).length, p.slug).toBeLessThanOrEqual(3);
      expect(p.sections.length, p.slug).toBeGreaterThan(0);
      expect(p.faq.length, p.slug).toBeGreaterThanOrEqual(3);
      expect(p.faq.length, p.slug).toBeLessThanOrEqual(5);
      for (const qa of p.faq) expect(qa.q.endsWith("?") && qa.a.length > 20, qa.q).toBe(true);
      for (const r of p.related) expect(ALL as readonly string[], r).toContain(r);
    }
  });

  it("names the target search phrases in the H1", () => {
    const h1 = (slug: string) => topicPage(slug)!.h1.toLowerCase();
    expect(h1("free-puzzle-games-in-browser")).toContain("free puzzle games in your browser");
    expect(h1("play-oware-online")).toContain("play oware online");
    expect(h1("made-in-ghana")).toContain("made in ghana");
    expect(h1("oware-vs-mancala")).toContain("oware vs mancala");
    expect(h1("sudoku-online")).toContain("sudoku online");
  });
});

describe("guides and game lists follow the catalog and the Games page state", () => {
  it("never list a retired, lab, In testing or Off game", () => {
    for (const p of publicTopics()) for (const g of p.games) expect(hidden, `${p.slug}: ${g.id}`).not.toContain(g.id);
    const s = sw(["quads"], ["crownfall", "chess"]);
    for (const p of publicTopics(s)) {
      const ids = [...p.games, ...p.sections.flatMap((x) => x.games ?? [])].map((g) => g.id);
      for (const id of ["quads", "crownfall", "chess"]) expect(ids, `${p.slug}: ${id}`).not.toContain(id);
      for (const l of p.sections.flatMap((x) => x.links ?? []))
        for (const id of ["quads", "crownfall", "chess"]) expect(l.href, p.slug).not.toBe(`/games/${id}`);
    }
  });

  it("drops a page whose games are gone: from the pages, the sitemap and llms.txt", () => {
    const s = sw([], ["oware"]);
    expect(topicPage("play-oware-online", s)).toBeUndefined();
    expect(topicPage("oware-vs-mancala", s)).toBeUndefined();
    const urls = sitemapEntries(s).map((e) => e.url);
    expect(urls).not.toContain(absoluteUrl("/guides/play-oware-online"));
    expect(llmsTxt(undefined, s)).not.toContain("/guides/play-oware-online");
    expect(llmsFullTxt(undefined, s)).not.toContain("/guides/play-oware-online");
    // a page that links one that is gone drops the link
    expect(topicPage("board-games-online", s)!.related).not.toContain("play-oware-online");
    expect(topicPage("board-games-online", s)!.games.map((g) => g.id)).not.toContain("oware");
    // sudoku needs both board sizes
    expect(topicPage("sudoku-online", sw([], ["nine"]))).toBeUndefined();
    // every board game Off: no board pages
    const noBoard = sw(
      [],
      GAMES.filter((g) => g.world === "board").map((g) => g.id),
    );
    for (const slug of ["board-games-online", "games-vs-computer", "ludo-online-4-players"])
      expect(topicPage(slug, noBoard), slug).toBeUndefined();
    expect(topicPage("unknown")).toBeUndefined();
  });

  it("derives the lists from the code: worlds, races, Board Bay and bots", () => {
    const t = topicGroups();
    expect(topicPage("logic-puzzles")!.games.every((g) => g.world === "logic")).toBe(true);
    expect(t.bay.map((g) => g.id)).toEqual([...BAY_GAMES]);
    expect(t.bots.every((g) => g.botPlay)).toBe(true);
    expect(t.races.every((g) => isRaceGame(g.id))).toBe(true);
    // a game kept out of Duels and Parties leaves the party and 2-player lists
    const race = t.races[0];
    expect(topicPage("party-games", sw([], [], [race.id]))!.games.map((g) => g.id)).not.toContain(race.id);
    expect(topicPage("party-games")!.title).toContain(`up to ${PARTY_MAX} players`);
    // the hub counts every game that is On
    expect(topicPage("free-puzzle-games-in-browser")!.answer).toContain(`${GAMES.filter((g) => !g.variantOf).length} short games`);
  });

  it("keeps Board Bay copy to Board Bay games (no Dara)", () => {
    const p = topicPage("board-games-online")!;
    expect(p.games.map((g) => g.id)).not.toContain("dara");
    expect(`${p.answer} ${p.description} ${boardFriendsCopy.how.join(" ")}`).not.toMatch(/dara/i);
  });

  it("links each game page to the guides about it, the dedicated guide first", () => {
    expect(topicsForGame("oware")[0].slug).toBe("play-oware-online");
    expect(topicsForGame("sixer")[0].slug).toBe("sudoku-online");
    expect(topicsForGame("chess").map((p) => p.slug)).toContain("board-games-online");
    expect(topicsForGame("oware", sw([], ["oware"]))).toEqual([]);
  });
});

describe("the oware guide matches the rules the game plays (games/oware)", () => {
  it("states the engine's numbers", () => {
    expect(owareRules.board).toContain(String(PITS * 4));
    expect(owareRules.board).toContain("six pits");
    expect(owareRules.lap).toContain(String(PITS));
    expect(owareRules.cycle).toContain(String(CYCLE_LIMIT));
    expect(owareRules.win).toContain("25");
    expect(owareRules.win).toContain("24 each is a draw");
    expect(owareRules.capture).toMatch(/2 or 3/);
    expect(owareRules.sow).toContain("anticlockwise");
  });

  it("offers the clocks the live game offers", () => {
    const play = topicPage("play-oware-online")!
      .sections.find((s) => s.id === "play")!
      .points!.join(" ");
    for (const m of CLOCK_MINUTES.oware) expect(play).toContain(String(m));
    expect(owareCopy.howToName).toMatch(/Abapa/);
  });
});

describe("guides: structured data", () => {
  const parse = (d: Record<string, unknown>) => JSON.parse(jsonLdScript(d)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  it("describes the oware guide as an Article with a HowTo of every step", () => {
    const p = topicPage("play-oware-online")!;
    const d = parse(graph(topicPageNode(p), howTo(p.howTo!.name, p.howTo!.steps), breadcrumbs([["SPUZL", "/"]])));
    const [article, how] = d["@graph"];
    expect(article).toMatchObject({ "@type": "Article", headline: p.h1, url: absoluteUrl(p.path), inLanguage: "en" });
    expect(article.about).toMatchObject({ "@type": "VideoGame", "@id": `${absoluteUrl("/games/oware")}#game` });
    expect(article.author.name).toBe("Senya");
    expect(how["@type"]).toBe("HowTo");
    expect(how.step).toHaveLength(p.howTo!.steps.length);
    for (const [i, s] of how.step.entries()) {
      expect(s).toMatchObject({ "@type": "HowToStep", position: i + 1 });
      expect(s.text.length).toBeGreaterThan(20);
    }
  });

  it("describes list pages as a CollectionPage", () => {
    const d = parse(topicPageNode(topicPage("logic-puzzles")!));
    expect(d["@type"]).toBe("CollectionPage");
    expect(d.isPartOf["@id"]).toBe(`${SITE_URL}/#website`);
  });

  it("names Ghana as where SPUZL was founded, and no areaServed", () => {
    const org = parse(organization());
    expect(org.foundingLocation).toMatchObject({ "@type": "Place", name: "Ghana" });
    expect(org.foundingLocation.address.addressCountry).toBe("GH");
    expect(org.areaServed).toBeUndefined();
  });
});

describe("sitemap and llms.txt carry the guides", () => {
  it("lists /guides and every served page", () => {
    const urls = sitemapEntries().map((e) => e.url);
    expect(urls).toContain(absoluteUrl("/guides"));
    for (const p of publicTopics()) expect(urls, p.slug).toContain(absoluteUrl(p.path));
  });

  it("gives AI answers each page's direct answer and the oware steps", () => {
    const short = llmsTxt();
    const full = llmsFullTxt();
    expect(short).toMatch(/^## Guides and game lists$/m);
    for (const p of publicTopics()) {
      expect(short, p.slug).toContain(`[${p.label}](${absoluteUrl(p.path)})`);
      expect(full, p.slug).toContain(`### ${p.h1}`);
      expect(full, p.slug).toContain(p.answer);
    }
    expect(full).toContain(owareRules.capture);
  });
});

/** Every sitemap URL resolves to a page file in app/ (route groups skipped, dynamic segments checked against data). */
describe("every sitemap URL resolves to a route", () => {
  const root = join(process.cwd(), "app");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : f === "page.tsx" ? [p] : [];
    });
  const routes = walk(root).map((f) =>
    relative(root, f)
      .split(sep)
      .slice(0, -1)
      .filter((s) => !/^\(.*\)$/.test(s)),
  );
  const known: Record<string, readonly string[]> = {
    "games/[id]": GAMES.map((g) => g.id),
    "world/[id]": WORLDS.map((w) => w.id),
    "topics/[slug]": TOPIC_SLUGS,
    "guides/[slug]": GUIDE_SLUGS,
  };

  const resolves = (path: string) => {
    const parts = path.split("/").filter(Boolean);
    if (path === "/about") return false;
    return routes.some((r) => {
      if (r.length !== parts.length) return false;
      const key = r.join("/");
      return r.every((seg, i) => (/^\[.+\]$/.test(seg) ? (known[key] ?? []).includes(parts[i]) : seg === parts[i]));
    });
  };

  it("has a page for each URL", () => {
    for (const e of sitemapEntries()) {
      const path = new URL(e.url).pathname;
      expect(resolves(path), path).toBe(true);
    }
  });
});
