import type { Metadata } from "next";
import { FaqAccordion } from "@/components/seo/FaqAccordion";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES, WORLD_BY_ID } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { PublicShell } from "@/components/seo/PublicShell";
import { GameLinkCard } from "@/components/seo/GameLinkCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { gamesCopy as T } from "@/lib/copy/seo";
import { gameDescription, gameFacts, gameTitle, publicGame } from "@/lib/seo/games";
import { publicMetadata } from "@/lib/seo/site";
import { breadcrumbs, faqPage, graph, videoGame } from "@/lib/seo/jsonld";

/** One static page per live game. Lab and retired games have no public page (any other id is a real 404). */
export const dynamicParams = false;

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: PageProps<"/games/[id]">): Promise<Metadata> {
  const { id } = await params;
  const g = publicGame(id);
  if (!g) return {};
  // The page's own opengraph-image.tsx fills in the share image (and Twitter inherits it).
  return publicMetadata({ path: `/games/${g.id}`, title: gameTitle(g), description: gameDescription(g), image: false });
}

const CTA =
  "press bg-accent text-on-accent flex h-14 w-fit items-center justify-center gap-2 rounded-full px-7 text-[17px] font-bold shadow-[0_5px_0_var(--accent-depth)]";
const H2 = "font-display text-[24px] leading-tight font-black tracking-[-0.02em] sm:text-[28px]";

export default async function GamePage({ params }: PageProps<"/games/[id]">) {
  const { id } = await params;
  const g = publicGame(id);
  if (!g) notFound();
  const f = gameFacts(g);
  const world = WORLD_BY_ID[g.world];
  const crumbs = [
    ["SPUZL", "/"],
    [T.allGames, "/games"],
    [world.name, `/world/${world.id}`],
    [g.name, `/games/${g.id}`],
  ] as const;
  const facts: [string, string][] = [
    [T.facts.world, world.name],
    [T.facts.time, f.typicalLabel],
    [T.facts.scoring, f.scoring],
    ...(f.levels !== undefined
      ? [[T.facts.levels, f.levels ? T.facts.levelsPool(f.levels) : T.facts.levelsEndless] as [string, string]]
      : []),
    ...(f.difficulty ? [[T.facts.difficulty, T.facts.difficultyValue] as [string, string]] : []),
    [T.facts.price, T.facts.priceValue],
    [T.facts.plays, T.facts.playsValue],
  ];
  return (
    <PublicShell>
      <JsonLd data={graph(videoGame(f), breadcrumbs(crumbs), faqPage(f.faq))} />
      <nav aria-label={T.nav.breadcrumb} className="text-muted text-[14px]">
        <ol className="flex flex-wrap items-center gap-1.5">
          {crumbs.slice(0, -1).map(([name, href]) => (
            <li key={href} className="flex items-center gap-1.5">
              {/* "/" is a full page load (the landing page for visitors, proxy.ts) */}
              {href === "/" ? (
                <a href={href} className="hover:text-text flex min-h-11 items-center underline underline-offset-4">
                  {name}
                </a>
              ) : (
                <Link href={href} className="hover:text-text flex min-h-11 items-center underline underline-offset-4">
                  {name}
                </Link>
              )}
              <Icon name="caret-right" size={12} />
            </li>
          ))}
          <li aria-current="page" className="text-text font-semibold">
            {g.name}
          </li>
        </ol>
      </nav>

      <article className="mt-6 flex flex-col gap-10">
        <header className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Image src={`/3d/icons/${g.id}.webp`} alt={`${g.name} game icon`} width={88} height={88} priority className="rounded-[22px]" />
            <div className="flex flex-col gap-2">
              <h1 className="font-display text-[40px] leading-none font-black tracking-[-0.04em] sm:text-[56px]">{g.name}</h1>
              <Link
                href={`/world/${world.id}`}
                className="flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold"
                style={{ background: world.color, color: "var(--on-accent)" }}
              >
                <Icon name={world.icon} size={14} />
                {world.name}
              </Link>
            </div>
          </div>
          <p className="max-w-[70ch] text-[18px] leading-relaxed sm:text-[20px]">{f.definition}</p>
          <div className="flex flex-col gap-2">
            <Link href={`/play/${g.id}`} prefetch={false} className={CTA}>
              <Icon name="play" size={20} />
              {T.cta(g.name)}
            </Link>
            <p className="text-muted flex items-center gap-2 text-[14px]">
              <Icon name="lock-simple" size={16} />
              {T.ctaNote}
            </p>
          </div>
        </header>

        {/* Full width: the guide on the left, the quick facts and Play on the right (sticky) on wide screens; stacked on phones */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-14">
          <div className="flex min-w-0 flex-col gap-10">
            <section aria-labelledby="rule" className="flex flex-col gap-3">
              <h2 id="rule" className={H2}>
                {T.ruleTitle}
              </h2>
              <p className="bg-surface border-line rounded-[18px] border p-4 text-[17px] leading-relaxed">{g.rule}</p>
              {g.photosensitive && <p className="text-gold text-[14px]">{T.photosensitive}</p>}
            </section>
            <section aria-labelledby="how" className="flex flex-col gap-3">
              <h2 id="how" className={H2}>
                {T.howTitle(g.name)}
              </h2>
              <ol className="flex list-decimal flex-col gap-2 pl-6 text-[16px] leading-relaxed">
                {T.howSteps(g).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
            <section aria-labelledby="modes" className="flex flex-col gap-3">
              <h2 id="modes" className={H2}>
                {T.modesTitle}
              </h2>
              <ul className="flex list-disc flex-col gap-2 pl-6 text-[16px] leading-relaxed">
                {f.modeLines.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="faq" className="flex flex-col gap-3">
              <h2 id="faq" className={H2}>
                {T.faqTitle(g.name)}
              </h2>
              <FaqAccordion items={f.faq} />
            </section>
          </div>
          <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-24">
            <section aria-labelledby="facts" className="flex flex-col gap-3">
              <h2 id="facts" className={H2}>
                {T.factsTitle}
              </h2>
              <dl className="border-line divide-line grid divide-y rounded-[18px] border">
                {facts.map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
                    <dt className="text-muted w-36 shrink-0 text-[14px] font-semibold">{k}</dt>
                    <dd className="text-[15px]">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <div className="bg-surface-raised flex flex-col items-start gap-3 rounded-[24px] p-6">
              <p className="font-display text-[22px] font-black">{T.ctaTitle(g.name)}</p>
              <p className="text-muted text-[15px]">{T.ctaNote}</p>
              <Link href={`/play/${g.id}`} prefetch={false} className={CTA}>
                <Icon name="play" size={20} />
                {T.cta(g.name)}
              </Link>
            </div>
          </aside>
        </div>
      </article>

      {f.related.length > 0 && (
        <section aria-labelledby="more" className="mt-14 flex flex-col gap-4">
          <h2 id="more" className={H2}>
            {T.moreTitle(world.name)}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {f.related.map((x) => (
              <GameLinkCard key={x.id} game={x} />
            ))}
          </ul>
        </section>
      )}
    </PublicShell>
  );
}
