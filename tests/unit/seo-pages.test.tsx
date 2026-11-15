import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
import { GAMES, WORLDS } from "@/lib/catalog";
import { metadata as landing } from "@/app/(landing)/about/page";
import { generateMetadata as gamesMeta } from "@/app/games/page";
import GamesIndex from "@/app/games/page";
import GamePage, { generateMetadata as gameMeta, generateStaticParams } from "@/app/games/[id]/page";
import { generateMetadata as worldMeta } from "@/app/world/[id]/page";
import { generateMetadata as howToPlayMeta } from "@/app/(info)/how-to-play/page";
import { metadata as fairPlay } from "@/app/(info)/fair-play/page";
import { metadata as privacy } from "@/app/(info)/privacy/page";
import { metadata as terms } from "@/app/(info)/terms/page";
import { metadata as contact } from "@/app/(info)/contact/page";
import TopicListPage, { generateMetadata as topicMeta, generateStaticParams as topicParams } from "@/app/topics/[slug]/page";
import GuidePage, { generateMetadata as guideMeta, generateStaticParams as guideParams } from "@/app/guides/[slug]/page";
import GuidesIndex, { metadata as guidesIndexMeta } from "@/app/guides/page";
import { GUIDE_SLUGS, TOPIC_SLUGS, publicTopics } from "@/lib/seo/topics";

/** Every public page names its canonical address and has its own title and description. */
const title = (m: Metadata) => (typeof m.title === "object" && m.title && "absolute" in m.title ? m.title.absolute : String(m.title));
const params = <T,>(v: T) => ({ params: Promise.resolve(v), searchParams: Promise.resolve({}) }) as never;

describe("public page metadata", () => {
  it("gives every public page a canonical, a unique title and a description", async () => {
    const pages: [string, Metadata][] = [
      ["/", landing],
      ["/games", await gamesMeta()],
      ["/how-to-play", await howToPlayMeta()],
      ["/fair-play", fairPlay],
      ["/privacy", privacy],
      ["/terms", terms],
      ["/contact", contact],
      ["/guides", guidesIndexMeta],
    ];
    for (const g of GAMES) pages.push([`/games/${g.id}`, await gameMeta(params({ id: g.id }))]);
    for (const p of publicTopics())
      pages.push([p.path, p.kind === "topic" ? await topicMeta(params({ slug: p.slug })) : await guideMeta(params({ slug: p.slug }))]);
    for (const w of WORLDS) pages.push([`/world/${w.id}`, await worldMeta(params({ id: w.id }))]);
    for (const [path, m] of pages) {
      expect(m.alternates?.canonical, path).toBe(path);
      expect(m.description?.length, path).toBeGreaterThan(40);
      expect((m.openGraph as { url?: string }).url, path).toBe(path);
    }
    // The catalogue's title counts the games that are On (all of them here).
    expect(title(await gamesMeta())).toBe(`All ${GAMES.filter((g) => !g.variantOf).length} free online puzzle games | SPUZL`);
    const titles = pages.map(([, m]) => title(m));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("builds a static page for every game that is not retired; the page answers only while the game is On", async () => {
    expect(generateStaticParams()).toEqual(GAMES.map((g) => ({ id: g.id })));
    // No database here: the switch is the default, every game On. A retired game never has a page.
    expect((await gameMeta(params({ id: "five" }))).alternates?.canonical).toBe("/games/five");
    expect(await gameMeta(params({ id: "blackout" }))).toEqual({});
    expect(await worldMeta(params({ id: "number" }))).toEqual({});
  });
});

describe("public page content", () => {
  const words = (html: string) =>
    html
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .split(/\s+/)
      .filter((w) => /\w/.test(w)).length;

  it("gives each game page one h1, JSON-LD, a play link and at least 250 words", async () => {
    for (const g of GAMES) {
      const html = renderToStaticMarkup(await GamePage(params({ id: g.id })));
      expect(html.match(/<h1[\s>]/g), g.id).toHaveLength(1);
      expect(html, g.id).toContain('type="application/ld+json"');
      expect(html, g.id).toContain(`href="/play/${g.id}"`);
      expect(words(html), g.id).toBeGreaterThanOrEqual(250);
    }
  });

  it("links every live game from the catalogue", async () => {
    const html = renderToStaticMarkup(await GamesIndex());
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    for (const g of GAMES.filter((x) => !x.variantOf)) expect(html, g.id).toContain(`href="/games/${g.id}"`);
  });
});

describe("guides and game lists (/guides, /topics/<slug>, /guides/<slug>)", () => {
  const words = (html: string) =>
    html
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .split(/\s+/)
      .filter((w) => /\w/.test(w)).length;
  const ld = (html: string) =>
    [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(
      (m) => (JSON.parse(m[1]) as { "@graph": { "@type": string }[] })["@graph"],
    );

  it("gives each page its own title; a slug of the other kind or an unknown one gets nothing", async () => {
    for (const p of publicTopics()) {
      const m = p.kind === "topic" ? await topicMeta(params({ slug: p.slug })) : await guideMeta(params({ slug: p.slug }));
      expect(title(m), p.slug).toBe(p.title);
    }
    expect(await topicMeta(params({ slug: "play-oware-online" }))).toEqual({});
    expect(await guideMeta(params({ slug: "logic-puzzles" }))).toEqual({});
    expect(await guideMeta(params({ slug: "nope" }))).toEqual({});
    expect(topicParams()).toEqual(TOPIC_SLUGS.map((slug) => ({ slug })));
    expect(guideParams()).toEqual(GUIDE_SLUGS.map((slug) => ({ slug })));
  });

  it("renders one h1, the page and breadcrumb JSON-LD, links to its games and at least 250 words", async () => {
    for (const p of publicTopics()) {
      const html = renderToStaticMarkup(
        p.kind === "topic" ? await TopicListPage(params({ slug: p.slug })) : await GuidePage(params({ slug: p.slug })),
      );
      expect(html.match(/<h1[\s>]/g), p.slug).toHaveLength(1);
      expect(html, p.slug).toContain(p.h1);
      const types = ld(html).map((n) => n["@type"]);
      for (const t of ["BreadcrumbList", "FAQPage", p.kind === "guide" ? "Article" : "CollectionPage"]) expect(types, p.slug).toContain(t);
      if (p.games.length) expect(types, p.slug).toContain("ItemList");
      for (const g of p.games) expect(html, `${p.slug}: ${g.id}`).toContain(`href="/games/${g.id}"`);
      expect(words(html), p.slug).toBeGreaterThanOrEqual(250);
    }
    const oware = renderToStaticMarkup(await GuidePage(params({ slug: "play-oware-online" })));
    expect(ld(oware).map((n) => n["@type"])).toContain("HowTo");
    expect(oware).toContain('href="/play/oware"');
  });

  it("the index lists every guide; game pages and /games link the guides", async () => {
    const html = renderToStaticMarkup(await GuidesIndex());
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    for (const p of publicTopics()) expect(html, p.slug).toContain(`href="${p.path}"`);
    expect(renderToStaticMarkup(await GamePage(params({ id: "oware" })))).toContain('href="/guides/play-oware-online"');
    expect(renderToStaticMarkup(await GamePage(params({ id: "sixer" })))).toContain('href="/topics/sudoku-online"');
    expect(renderToStaticMarkup(await GamesIndex())).toContain('href="/topics/free-puzzle-games-in-browser"');
  });
});
