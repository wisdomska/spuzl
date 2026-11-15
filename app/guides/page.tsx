import type { CSSProperties } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { PublicShell } from "@/components/seo/PublicShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { Crumbs } from "@/components/seo/Crumbs";
import { topicsCopy as T } from "@/lib/copy/topics";
import { publicMetadata } from "@/lib/seo/site";
import { servedGameSwitch } from "@/lib/game-settings/server";
import { breadcrumbs, graph, pageList } from "@/lib/seo/jsonld";
import { publicTopics, type TopicPage } from "@/lib/seo/topics";

export const metadata = publicMetadata({ path: T.indexPath, title: T.index.title, description: T.index.description });
/** Lists only the guides served now (Games page state); rebuilt with them. */
export const revalidate = 3600;

const H2 = "font-display text-[24px] leading-tight font-black tracking-[-0.02em] sm:text-[28px]";

function Cards({ pages }: { pages: readonly TopicPage[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {pages.map((p, i) => (
        <li key={p.slug} data-reveal style={{ "--i": i % 3 } as CSSProperties}>
          <Link
            href={p.path}
            className="lift bg-surface border-line hover:border-accent flex h-full flex-col gap-1.5 rounded-[20px] border p-4"
          >
            <span className="font-display flex items-center gap-1.5 text-[18px] leading-tight font-black">
              {p.label}
              <Icon name="arrow-right" size={16} className="text-accent shrink-0" />
            </span>
            <span className="text-muted text-[15px] leading-snug">{p.description}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Every guide and game list in one place (crawlable index, linked from the footers and the game pages). */
export default async function GuidesIndex() {
  const lab = await servedGameSwitch();
  const topics = publicTopics(lab, "topic");
  const guides = publicTopics(lab, "guide");
  const crumbs = [
    ["SPUZL", "/"],
    [T.crumb, T.indexPath],
  ] as const;
  return (
    <PublicShell back="/">
      <JsonLd
        data={graph(
          breadcrumbs(crumbs),
          pageList(
            T.index.h1,
            [...topics, ...guides].map((p) => [p.label, p.path] as const),
          ),
        )}
      />
      <Crumbs items={crumbs} />
      <h1 className="font-display hero-in mt-6 text-[38px] leading-[1.02] font-black tracking-[-0.04em] text-balance sm:text-[56px]">
        {T.index.h1}
      </h1>
      <p className="hero-in mt-3 max-w-[70ch] text-[18px] leading-relaxed" style={{ "--i": 1 } as CSSProperties}>
        {T.index.answer}
      </p>
      <section aria-labelledby="guides" className="mt-10 flex flex-col gap-4">
        <h2 id="guides" className={H2}>
          {T.index.guides}
        </h2>
        <Cards pages={guides} />
      </section>
      <section aria-labelledby="lists" className="mt-10 flex flex-col gap-4">
        <h2 id="lists" className={H2}>
          {T.index.topics}
        </h2>
        <Cards pages={topics} />
      </section>
    </PublicShell>
  );
}
