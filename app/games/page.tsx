import type { CSSProperties } from "react";
import Link from "next/link";
import { playerWorlds } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { PublicShell } from "@/components/seo/PublicShell";
import { GameLinkCard } from "@/components/seo/GameLinkCard";
import { WorldTabs } from "@/components/seo/WorldTabs";
import { JsonLd } from "@/components/seo/JsonLd";
import { gamesCopy as T, seoMeta } from "@/lib/copy/seo";
import { publicMetadata } from "@/lib/seo/site";
import { servedCopy } from "@/lib/games-meta/server";
import { servedGameSwitch } from "@/lib/game-settings/server";
import { publicCounts, publicGames, publicGamesInWorld } from "@/lib/seo/games";
import { breadcrumbs, gameList, graph } from "@/lib/seo/jsonld";

/** The title counts the games that are On (Games page state); rebuilt with the page. */
export async function generateMetadata() {
  return publicMetadata({ path: "/games", ...seoMeta.gamesFor(publicCounts(await servedGameSwitch()).games) });
}
/**
 * R4-10: the admin's rule and card copy (Library page) reach this page. Rebuilt at most hourly, and at once after a
 * copy change (the admin route revalidates it), so the page stays a fast cached file.
 */
export const revalidate = 3600;

/**
 * The crawlable game catalogue: every game players can open, grouped by world, each linking to its own page. Static.
 * R6: the worlds are tabs (components/seo/WorldTabs), with every world's games still in the server HTML.
 */
export default async function GamesIndex() {
  const copy = await servedCopy();
  const lab = await servedGameSwitch();
  const counts = publicCounts(lab);
  return (
    <PublicShell back="/">
      <JsonLd
        data={graph(
          breadcrumbs([
            ["SPUZL", "/"],
            [T.allGames, "/games"],
          ]),
          gameList(T.indexTitle, publicGames(lab)),
        )}
      />
      <h1 className="font-display hero-in text-[36px] leading-[1.02] font-black tracking-[-0.04em] text-balance sm:text-[56px]">
        {T.indexTitle}
      </h1>
      <p className="text-muted hero-in mt-3 text-[17px] leading-relaxed" style={{ "--i": 1 } as CSSProperties}>
        {T.indexLedeFor(counts.games, counts.worlds)}
      </p>
      <ul className="hero-in mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[15px]" style={{ "--i": 2 } as CSSProperties}>
        {T.indexPoints.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <Icon name="check-circle" size={18} className="text-accent" />
            {p}
          </li>
        ))}
      </ul>
      <section aria-label={T.worldsLabel} className="hero-in mt-8" style={{ "--i": 3 } as CSSProperties}>
        <WorldTabs
          label={T.worldsLabel}
          tabs={playerWorlds(lab).map((w) => {
            const games = publicGamesInWorld(w.id, lab).map(copy);
            return {
              id: w.id,
              name: w.name,
              color: w.color,
              icon: w.icon,
              count: String(games.length),
              panel: (
                <>
                  {/* The tab names the world; the heading is for screen readers, and shows when JS is off (no tabs). */}
                  <h2
                    id={`world-${w.id}`}
                    className="font-display sr-only text-[24px] font-black tracking-[-0.02em] [@media(scripting:none)]:not-sr-only"
                  >
                    {w.name}
                  </h2>
                  <div className="flex flex-wrap items-center justify-between gap-x-4">
                    <p className="text-muted text-[15px]">
                      {w.tagline} · {T.worldCount(games.length)}
                    </p>
                    <Link
                      href={`/world/${w.id}`}
                      className="text-muted hover:text-text flex h-11 items-center gap-1 text-[14px] font-semibold underline underline-offset-4"
                    >
                      {T.worldsLink(w.name)}
                    </Link>
                  </div>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {games.map((g, i) => (
                      <GameLinkCard key={g.id} game={g} index={i} />
                    ))}
                  </ul>
                </>
              ),
            };
          })}
        />
      </section>
    </PublicShell>
  );
}
