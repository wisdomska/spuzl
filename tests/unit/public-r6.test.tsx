import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
import { GAMES, playerWorlds } from "@/lib/catalog";
import { LIVE_ONLY } from "@/lib/seo/games";
import GamesIndex from "@/app/games/page";
import Landing from "@/app/(landing)/about/page";
import GamePage from "@/app/games/[id]/page";
import { PublicWorld } from "@/components/seo/PublicWorld";
import { FaqAccordion } from "@/components/seo/FaqAccordion";
import { landingSeoCopy, siteFaq } from "@/lib/copy/seo";

const params = <T,>(v: T) => ({ params: Promise.resolve(v), searchParams: Promise.resolve({}) }) as never;

describe("public pages, R6", () => {
  it("/games: the worlds are an ARIA tablist, and every world's panel and game link is in the server HTML", async () => {
    const html = renderToStaticMarkup(await GamesIndex());
    expect(html).toContain('role="tablist"');
    const worlds = playerWorlds(LIVE_ONLY);
    expect(html.match(/role="tab"/g)).toHaveLength(worlds.length);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(worlds.length);
    for (const w of worlds) expect(html).toContain(`id="panel-${w.id}"`);
    // Before hydration no panel carries `hidden`: crawlers and no-JS visitors get every game.
    expect(html).not.toMatch(/role="tabpanel"[^>]*\shidden/);
    for (const g of GAMES.filter((x) => !x.variantOf)) expect(html, g.id).toContain(`href="/games/${g.id}"`);
    // Back to the landing page.
    expect(html).toMatch(/href="\/"[^>]*>.*?Back</);
  });

  it("game and world pages get a Back link to the catalogue", async () => {
    const game = renderToStaticMarkup(await GamePage(params({ id: "crownfall" })));
    expect(game).toMatch(/href="\/games"[^>]*>.*?Back</);
    const world = renderToStaticMarkup(<PublicWorld id="logic" />);
    expect(world).toMatch(/href="\/games"[^>]*>.*?Back</);
    expect(world).toContain("free games.");
  });

  it("landing: smooth same-page links, the sound switch on the demo, the FAQ heading, no Back link", async () => {
    const html = renderToStaticMarkup(await Landing());
    expect(html).toContain("data-smooth-scroll");
    expect(html).toMatch(/role="switch"[^>]*aria-label="Sound"|aria-label="Sound"[^>]*role="switch"/);
    expect(html).toContain("Frequently Asked.");
    expect(html).not.toContain("Good to know");
    expect(html).not.toMatch(/>\s*Back\s*</);
  });

  it("the FAQ is titled Frequently Asked and keeps every answer in the HTML", () => {
    expect(landingSeoCopy.faqTitle).toBe("Frequently Asked.");
    const faq = siteFaq();
    const html = renderToStaticMarkup(<FaqAccordion items={faq} />);
    expect(html.match(/<details/g)).toHaveLength(faq.length);
    for (const qa of faq) expect(html).toContain(qa.a.slice(0, 30).replace(/'/g, "&#x27;"));
    // Only the first starts open; no JS-only state in the server HTML.
    expect(html.match(/<details open=""/g)).toHaveLength(1);
    expect(html).not.toMatch(/\sdata-state="/);
  });
});
