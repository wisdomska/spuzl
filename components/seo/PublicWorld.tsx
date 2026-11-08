import Link from "next/link";
import { WORLDS, WORLD_BY_ID, gamesInWorld, type WorldId } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { PublicShell } from "./PublicShell";
import { GameLinkCard } from "./GameLinkCard";
import { JsonLd } from "./JsonLd";
import { gamesCopy, worldSeoCopy as T } from "@/lib/copy/seo";
import { breadcrumbs, gameList, graph } from "@/lib/seo/jsonld";

/**
 * A world for visitors and search engines (no session): what the world is, its games (each linking to its page),
 * Play now, and the other worlds. Server-rendered; players with a session get the World screen instead.
 */
export function PublicWorld({ id }: { id: WorldId }) {
  const w = WORLD_BY_ID[id];
  const games = gamesInWorld(id);
  return (
    <PublicShell>
      <JsonLd
        data={graph(
          breadcrumbs([
            ["SPUZL", "/"],
            [gamesCopy.allGames, "/games"],
            [w.name, `/world/${w.id}`],
          ]),
          gameList(T.gamesTitle(w.name), games),
        )}
      />
      <header
        className="dotgrid flex flex-col gap-4 rounded-[28px] p-6 sm:p-10"
        style={{ backgroundColor: `color-mix(in srgb, ${w.color} 18%, var(--bg))` }}
      >
        <span
          className="flex size-14 items-center justify-center rounded-[18px]"
          style={{ background: w.color, color: "var(--on-accent)" }}
          aria-hidden
        >
          <Icon name={w.icon} size={28} />
        </span>
        <h1 className="font-display text-[40px] leading-none font-black tracking-[-0.04em] sm:text-[56px]">{w.name}</h1>
        <p className="max-w-[640px] text-[17px] leading-relaxed">{T.lede(w.name, w.tagline, games.length)}</p>
        <Link
          href="/welcome/play"
          className="press bg-accent text-on-accent flex h-14 w-fit items-center gap-2 rounded-full px-7 text-[17px] font-bold shadow-[0_5px_0_var(--accent-depth)]"
        >
          <Icon name="play" size={20} />
          {T.play}
        </Link>
      </header>
      <section aria-labelledby="games" className="mt-10 flex flex-col gap-4">
        <h2 id="games" className="font-display text-[24px] font-black tracking-[-0.02em] sm:text-[30px]">
          {T.gamesTitle(w.name)}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => (
            <GameLinkCard key={g.id} game={g} />
          ))}
        </ul>
      </section>
      <section aria-labelledby="worlds" className="mt-12 flex flex-col gap-4">
        <h2 id="worlds" className="font-display text-[22px] font-black">
          {T.otherWorlds}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {WORLDS.filter((x) => x.id !== id).map((x) => (
            <li key={x.id}>
              <Link
                href={`/world/${x.id}`}
                className="press bg-surface border-line flex h-11 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold"
              >
                <span className="size-3 rounded-full" style={{ background: x.color }} aria-hidden />
                {x.name}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/games"
              className="text-muted hover:text-text flex h-11 items-center px-2 text-[15px] font-semibold underline underline-offset-4"
            >
              {gamesCopy.seeAll}
            </Link>
          </li>
        </ul>
      </section>
    </PublicShell>
  );
}
