import Link from "next/link";
import { GAMES, WORLDS, gamesInWorld } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { PublicShell } from "@/components/seo/PublicShell";
import { GameLinkCard } from "@/components/seo/GameLinkCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { gamesCopy as T, seoMeta } from "@/lib/copy/seo";
import { publicMetadata } from "@/lib/seo/site";
import { breadcrumbs, gameList, graph } from "@/lib/seo/jsonld";

export const metadata = publicMetadata({ path: "/games", ...seoMeta.games });

/** The crawlable game catalogue: every live game, grouped by world, each linking to its own page. Static. */
export default function GamesIndex() {
  return (
    <PublicShell>
      <JsonLd
        data={graph(
          breadcrumbs([
            ["SPUZL", "/"],
            [T.allGames, "/games"],
          ]),
          gameList(T.indexTitle, GAMES),
        )}
      />
      <h1 className="font-display text-[36px] leading-[1.02] font-black tracking-[-0.04em] text-balance sm:text-[56px]">{T.indexTitle}</h1>
      <p className="text-muted mt-4 max-w-[680px] text-[17px] leading-relaxed">{T.indexLede}</p>
      <ul className="mt-4 flex flex-col gap-1.5 text-[15px]">
        {T.indexPoints.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <Icon name="check-circle" size={18} className="text-accent" />
            {p}
          </li>
        ))}
      </ul>
      {WORLDS.map((w) => {
        const games = gamesInWorld(w.id);
        return (
          <section key={w.id} aria-labelledby={`world-${w.id}`} className="mt-12 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id={`world-${w.id}`}
                className="font-display flex items-center gap-3 text-[24px] font-black tracking-[-0.02em] sm:text-[30px]"
              >
                <span
                  className="flex size-10 items-center justify-center rounded-[12px]"
                  style={{ background: w.color, color: "var(--on-accent)" }}
                  aria-hidden
                >
                  <Icon name={w.icon} size={20} />
                </span>
                {w.name}
              </h2>
              <Link
                href={`/world/${w.id}`}
                className="text-muted hover:text-text flex h-11 items-center text-[14px] font-semibold underline underline-offset-4"
              >
                {T.worldsLink(w.name)}
              </Link>
            </div>
            <p className="text-muted text-[15px]">
              {w.tagline} · {T.worldCount(games.length)}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((g) => (
                <GameLinkCard key={g.id} game={g} />
              ))}
            </ul>
          </section>
        );
      })}
    </PublicShell>
  );
}
