import type { Metadata } from "next";
import { FaqAccordion } from "@/components/seo/FaqAccordion";
import Link from "next/link";
import { playerWorlds } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { FreePlayRewards } from "@/components/info/FreePlayRewards";
import { JsonLd } from "@/components/seo/JsonLd";
import { freePlayCopy } from "@/lib/copy/free-play";
import { PLAY_NAV } from "@/lib/analytics/play-nav";
import { siteCopy } from "@/lib/copy/site";
import { CONTROLS, PHOTOSENSITIVE, SCORING, howToPlaySeoCopy as S, seoMeta, siteFaq } from "@/lib/copy/seo";
import { publicMetadata } from "@/lib/seo/site";
import { servedCopy } from "@/lib/games-meta/server";
import { servedGameSwitch } from "@/lib/game-settings/server";
import { publicCounts, publicGamesInWorld } from "@/lib/seo/games";
import { breadcrumbs, faqPage, graph } from "@/lib/seo/jsonld";

/** The description counts the games that are On (Games page state); rebuilt with the page. */
export async function generateMetadata(): Promise<Metadata> {
  return publicMetadata({ path: "/how-to-play", ...seoMeta.howToPlayFor(publicCounts(await servedGameSwitch()).games) });
}

/**
 * R4-10: the admin's rule and card copy (Library page) reach this page. Rebuilt at most hourly, and at once after a
 * copy change (the admin route revalidates it), so the page stays a fast cached file.
 */
export const revalidate = 3600;

// Copy for owner review before launch.
export default async function HowToPlay() {
  const copy = await servedCopy();
  const lab = await servedGameSwitch();
  const counts = publicCounts(lab);
  const faq = siteFaq(counts.games, counts.worlds, counts.names);
  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbs([
            ["SPUZL", "/"],
            [S.crumb, "/how-to-play"],
          ]),
          faqPage(faq),
        )}
      />
      <h1 data-wide>How to play</h1>
      <p className="lede max-w-[70ch]">{siteCopy.howToPlayLedeFor(counts.games, counts.worlds)}</p>

      <h2>The basics</h2>
      <div className="not-prose">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li className="bg-surface rounded-[18px] p-4 text-[15px] leading-relaxed">
            <strong className="font-display mb-1 block text-[16px] font-extrabold">{freePlayCopy.howToPlayLead}</strong> <FreePlayRewards />
          </li>
          <li className="bg-surface rounded-[18px] p-4 text-[15px] leading-relaxed">
            <strong className="font-display mb-1 block text-[16px] font-extrabold">First try.</strong> A short practice round with free
            hints. Skip it if you like.
          </li>
          <li className="bg-surface rounded-[18px] p-4 text-[15px] leading-relaxed">
            <strong className="font-display mb-1 block text-[16px] font-extrabold">Hints.</strong> Up to 3 a puzzle, each one safe next
            step. Half XP with hints.
          </li>
          <li className="bg-surface rounded-[18px] p-4 text-[15px] leading-relaxed">
            <strong className="font-display mb-1 block text-[16px] font-extrabold">Streaks.</strong> Clear one game a day. A Streak Freeze
            covers a missed day; hold up to 2.
          </li>
          <li className="bg-surface rounded-[18px] p-4 text-[15px] leading-relaxed">
            <strong className="font-display mb-1 block text-[16px] font-extrabold">Leagues.</strong> A new league of 30 every Monday. Your
            week&apos;s XP is your score. Top 7 move up, bottom 5 down.
          </li>
          <li className="bg-surface rounded-[18px] p-4 text-[15px] leading-relaxed">
            <strong className="font-display mb-1 block text-[16px] font-extrabold">Relaxed mode.</strong> Hide timers while you play, in{" "}
            <Link href="/settings" className="text-accent font-semibold underline underline-offset-3">
              Settings
            </Link>
            .
          </li>
        </ul>
      </div>

      {playerWorlds(lab).map((w) => (
        <section key={w.id} aria-labelledby={`world-${w.id}`} className="flex flex-col gap-3">
          <h2 id={`world-${w.id}`} className="flex items-center gap-2.5">
            <span
              className="flex size-8 items-center justify-center rounded-[10px]"
              style={{ background: w.color, color: "#0E0F1A" }}
              aria-hidden
            >
              <Icon name={w.icon} size={18} />
            </span>
            {w.name}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {publicGamesInWorld(w.id, lab)
              .map(copy)
              .map((g) => (
                <article key={g.id} className="bg-surface flex flex-col gap-1.5 rounded-[18px] p-4">
                  <h3 className="flex items-center gap-2">
                    <Icon name={g.icon} size={18} />
                    {g.name}
                  </h3>
                  <p>{g.rule}</p>
                  <p className="text-muted text-[14px]">{CONTROLS[g.engine]}</p>
                  <p className="text-muted text-[14px]">{SCORING[g.scoring]}</p>
                  {g.photosensitive && <p className="text-gold text-[14px]">{PHOTOSENSITIVE}</p>}
                  <div className="mt-auto flex flex-wrap gap-x-5 pt-1">
                    <Link href={`/play/${g.id}`} className="text-[15px]" {...PLAY_NAV}>
                      Play {g.name}
                    </Link>
                    <Link href={`/games/${g.id}`} className="text-[15px]">
                      {S.more(g.name)}
                    </Link>
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}

      <section aria-labelledby="faq" className="flex flex-col gap-3">
        <h2 id="faq">{S.faqTitle}</h2>
        <FaqAccordion items={faq} className="not-prose" />
      </section>
    </>
  );
}
