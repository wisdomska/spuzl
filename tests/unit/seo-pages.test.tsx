import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
import { GAMES, WORLDS } from "@/lib/catalog";
import { metadata as landing } from "@/app/(landing)/about/page";
import { metadata as games } from "@/app/games/page";
import GamesIndex from "@/app/games/page";
import GamePage, { generateMetadata as gameMeta, generateStaticParams } from "@/app/games/[id]/page";
import { generateMetadata as worldMeta } from "@/app/world/[id]/page";
import { metadata as howToPlay } from "@/app/(info)/how-to-play/page";
import { metadata as fairPlay } from "@/app/(info)/fair-play/page";
import { metadata as privacy } from "@/app/(info)/privacy/page";
import { metadata as terms } from "@/app/(info)/terms/page";
import { metadata as contact } from "@/app/(info)/contact/page";

/** Every public page names its canonical address and has its own title and description. */
const title = (m: Metadata) => (typeof m.title === "object" && m.title && "absolute" in m.title ? m.title.absolute : String(m.title));
const params = <T,>(v: T) => ({ params: Promise.resolve(v), searchParams: Promise.resolve({}) }) as never;

describe("public page metadata", () => {
  it("gives every public page a canonical, a unique title and a description", async () => {
    const pages: [string, Metadata][] = [
      ["/", landing],
      ["/games", games],
      ["/how-to-play", howToPlay],
      ["/fair-play", fairPlay],
      ["/privacy", privacy],
      ["/terms", terms],
      ["/contact", contact],
    ];
    for (const g of GAMES) pages.push([`/games/${g.id}`, await gameMeta(params({ id: g.id }))]);
    for (const w of WORLDS) pages.push([`/world/${w.id}`, await worldMeta(params({ id: w.id }))]);
    for (const [path, m] of pages) {
      expect(m.alternates?.canonical, path).toBe(path);
      expect(m.description?.length, path).toBeGreaterThan(40);
      expect((m.openGraph as { url?: string }).url, path).toBe(path);
    }
    const titles = pages.map(([, m]) => title(m));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("builds a static page for every live game only", async () => {
    expect(generateStaticParams()).toEqual(GAMES.map((g) => ({ id: g.id })));
    expect(await gameMeta(params({ id: "five" }))).toEqual({});
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

  it("links every live game from the catalogue", () => {
    const html = renderToStaticMarkup(GamesIndex());
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    for (const g of GAMES) expect(html, g.id).toContain(`href="/games/${g.id}"`);
  });
});
