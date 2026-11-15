import type { CSSProperties } from "react";
import Link from "next/link";
import type { GameMeta } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { PublicShell } from "@/components/seo/PublicShell";
import { GameLinkCard } from "@/components/seo/GameLinkCard";
import { FaqAccordion } from "@/components/seo/FaqAccordion";
import { JsonLd } from "@/components/seo/JsonLd";
import { Crumbs } from "@/components/seo/Crumbs";
import { TopicPills } from "@/components/seo/TopicPills";
import { topicsCopy as T, type TopicSection } from "@/lib/copy/topics";
import { breadcrumbs, faqPage, gameList, graph, howTo, topicPageNode } from "@/lib/seo/jsonld";
import type { TopicPage } from "@/lib/seo/topics";

const H2 = "font-display text-[24px] leading-tight font-black tracking-[-0.02em] sm:text-[28px]";
const CTA =
  "press bg-accent text-on-accent flex h-14 w-fit items-center justify-center gap-2 rounded-full px-7 text-[17px] font-bold shadow-[0_5px_0_var(--accent-depth)]";
const EYEBROW = "text-accent font-mono text-[13px] font-semibold tracking-[0.18em] uppercase";

/** The breadcrumb trail of a guide or list page: SPUZL, Guides, the page. */
export const topicCrumbs = (p: Pick<TopicPage, "label" | "path">) =>
  [
    ["SPUZL", "/"],
    [T.crumb, T.indexPath],
    [p.label, p.path],
  ] as const;

function Section({ s, copy }: { s: TopicSection; copy: <G extends GameMeta>(g: G) => G }) {
  return (
    <section aria-labelledby={s.id} data-reveal className="flex min-w-0 flex-col gap-3">
      <h2 id={s.id} className={H2}>
        {s.title}
      </h2>
      {s.body?.map((b) => (
        <p key={b} className="max-w-[70ch] text-[17px] leading-relaxed">
          {b}
        </p>
      ))}
      {s.steps && (
        <ol className="flex max-w-[70ch] list-decimal flex-col gap-2 pl-6 text-[16px] leading-relaxed marker:font-bold">
          {s.steps.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      )}
      {s.points && (
        <ul className="flex max-w-[70ch] list-disc flex-col gap-2 pl-6 text-[16px] leading-relaxed marker:text-[var(--accent)]">
          {s.points.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      {s.table && (
        // Scrolls inside its own box on a narrow phone, so the page never scrolls sideways.
        <div className="border-line max-w-full overflow-x-auto rounded-[18px] border">
          <table className="w-full border-collapse text-left text-[14px] sm:text-[15px]">
            <thead>
              <tr className="bg-surface">
                {s.table[0].map((h, i) => (
                  <th key={`${h}-${i}`} scope="col" className="px-3 py-3 font-bold sm:px-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.table.slice(1).map((row) => (
                <tr key={row[0]} className="border-line border-t">
                  <th scope="row" className="text-muted px-3 py-3 font-semibold sm:px-4">
                    {row[0]}
                  </th>
                  {row.slice(1).map((c, i) => (
                    <td key={`${c}-${i}`} className="px-3 py-3 sm:px-4">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.games && s.games.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {s.games.map((g, i) => (
            <GameLinkCard key={g.id} game={copy(g)} index={i} />
          ))}
        </ul>
      )}
      {s.links && s.links.length > 0 && (
        <ul className={s.links.some((l) => l.note) ? "grid gap-3 sm:grid-cols-2" : "flex flex-wrap gap-x-5"}>
          {s.links.map((l) =>
            l.note ? (
              <li key={l.href + l.label}>
                <Link
                  href={l.href}
                  className="lift bg-surface border-line hover:border-accent flex h-full flex-col gap-1 rounded-[20px] border p-4"
                >
                  <span className="font-display flex items-center gap-1.5 text-[17px] font-black">
                    {l.label}
                    <Icon name="arrow-right" size={16} className="text-accent" />
                  </span>
                  <span className="text-muted text-[15px] leading-snug">{l.note}</span>
                </Link>
              </li>
            ) : (
              <li key={l.href + l.label}>
                <Link
                  href={l.href}
                  className="text-accent flex min-h-11 items-center gap-1.5 text-[15px] font-bold underline underline-offset-4"
                >
                  {l.label}
                  <Icon name="arrow-right" size={16} />
                </Link>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

/**
 * A guide or list page (/topics/<slug>, /guides/<slug>): breadcrumbs, the H1 with its keyword, the answer-first intro,
 * scannable sections, the FAQ and links to related guides, with JSON-LD (the page, breadcrumbs, FAQ, the games as an
 * ItemList and, for the oware guide, HowTo). Server-rendered; the page file decides which games are On.
 */
export function TopicView({
  page: p,
  related,
  copy,
}: {
  page: TopicPage;
  related: readonly TopicPage[];
  copy: <G extends GameMeta>(g: G) => G;
}) {
  const crumbs = topicCrumbs(p);
  const ld = [
    topicPageNode(p),
    breadcrumbs(crumbs),
    faqPage(p.faq),
    ...(p.games.length ? [gameList(p.h1, p.games)] : []),
    ...(p.howTo ? [howTo(p.howTo.name, p.howTo.steps, p.description)] : []),
  ];
  return (
    <PublicShell back={T.indexPath}>
      <JsonLd data={graph(...ld)} />
      <Crumbs items={crumbs} />
      <article className="mt-6 flex flex-col gap-10">
        <header className="flex flex-col gap-5">
          <p className={`${EYEBROW} hero-in`}>{p.eyebrow}</p>
          <h1 className="font-display hero-in max-w-[22ch] text-[38px] leading-[1.02] font-black tracking-[-0.04em] text-balance sm:text-[56px]">
            {p.h1}
          </h1>
          <div
            className="hero-in bg-surface-raised border-accent flex max-w-[75ch] flex-col gap-1 rounded-[20px] border-l-4 p-5"
            style={{ "--i": 1 } as CSSProperties}
          >
            <p className="text-muted text-[13px] font-bold tracking-[0.12em] uppercase">{T.answerLabel}</p>
            <p className="text-[18px] leading-relaxed sm:text-[20px]">{p.answer}</p>
          </div>
          <div className="hero-in flex flex-col gap-2" style={{ "--i": 2 } as CSSProperties}>
            <Link href={p.cta.href} prefetch={false} className={CTA}>
              <Icon name="play" size={20} />
              {p.cta.label}
            </Link>
            <p className="text-muted flex items-center gap-2 text-[14px]">
              <Icon name="lock-simple" size={16} />
              {T.playNote}
            </p>
          </div>
        </header>

        {p.sections.map((s) => (
          <Section key={s.id} s={s} copy={copy} />
        ))}

        <section aria-labelledby="faq" data-reveal className="flex flex-col gap-3">
          <h2 id="faq" className={H2}>
            {T.faqTitle}
          </h2>
          <FaqAccordion items={p.faq} />
        </section>

        {related.length > 0 && (
          <section aria-labelledby="related" data-reveal className="flex flex-col gap-3">
            <h2 id="related" className={H2}>
              {T.relatedTitle}
            </h2>
            <TopicPills pages={related} />
          </section>
        )}
        <p className="text-muted text-[13px]">{T.updated}</p>
      </article>
    </PublicShell>
  );
}
