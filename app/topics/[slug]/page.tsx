import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopicView } from "@/components/seo/TopicView";
import { publicMetadata } from "@/lib/seo/site";
import { servedCopy } from "@/lib/games-meta/server";
import { servedGameSwitch } from "@/lib/game-settings/server";
import { TOPIC_SLUGS, topicPage } from "@/lib/seo/topics";

/**
 * Game lists by type (/topics/<slug>, lib/seo/topics.ts): one static page per slug, with only the games that are On.
 * A list with no game left is a 404; unknown slugs are a real 404. Rebuilt at most hourly, and at once after an admin
 * changes a game's state or copy (lib/seo/revalidate).
 */
export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return TOPIC_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/topics/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = topicPage(slug, await servedGameSwitch());
  if (!p || p.kind !== "topic") return {};
  return publicMetadata({ path: p.path, title: p.title, description: p.description });
}

export default async function TopicListPage({ params }: PageProps<"/topics/[slug]">) {
  const { slug } = await params;
  const lab = await servedGameSwitch();
  const p = topicPage(slug, lab);
  if (!p || p.kind !== "topic") notFound();
  const related = p.related.flatMap((r) => topicPage(r, lab) ?? []);
  return <TopicView page={p} related={related} copy={await servedCopy()} />;
}
