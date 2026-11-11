import type { Metadata } from "next";
import { FaqAccordion } from "@/components/seo/FaqAccordion";
import Link from "next/link";
import { WORLDS } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { FreePlayRewards } from "@/components/info/FreePlayRewards";
import { JsonLd } from "@/components/seo/JsonLd";
import { freePlayCopy } from "@/lib/copy/free-play";
import { PLAY_NAV } from "@/lib/analytics/play-nav";
import { siteCopy } from "@/lib/copy/site";
import { CONTROLS, PHOTOSENSITIVE, SCORING, SITE_FAQ, howToPlaySeoCopy as S, seoMeta } from "@/lib/copy/seo";
import { publicMetadata } from "@/lib/seo/site";
import { servedCopy } from "@/lib/games-meta/server";
import { servedLabSwitch } from "@/lib/game-settings/server";
import { publicGamesInWorld } from "@/lib/seo/games";
import { breadcrumbs, faqPage, graph } from "@/lib/seo/jsonld";

export const metadata: Metadata = publicMetadata({ path: "/how-to-play", ...seoMeta.howToPlay });

/**
 * R4-10: the admin's rule and card copy (Library page) reach this page. Rebuilt at most hourly, and at once after a
 * copy change (the admin route revalidates it), so the page stays a fast cached file.
 */
export const revalidate = 3600;

// Copy for owner review before launch.
export default async function HowToPlay() {
  const copy = await servedCopy();
  const lab = await servedLabSwitch();
  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbs([
            ["SPUZL", "/"],
            [S.crumb, "/how-to-play"],
          ]),
          faqPage(SITE_FAQ),
        )}
      />
      <h1 data-wide>How to play</h1>
      <p className="lede max-w-[70ch]">{siteCopy.howToPlayLede}</p>

      <h2>The basics</h2>
      <div className="not-prose">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li className="bg-surface rounded-[18px] p-4 text-[15px] leading-relaxed">
            <strong className="font-display mb-1 block text-[16px] font-extrabold">{freePlayCopy.howToPlayLead}</strong> <FreePlayRewards />
          </li>
          <li className="bg-surface rounded-[18px] p-4 text-[15px] leading-relaxed">
            <strong className="font-display mb-1 block text-[16px] font-extrabold">First try.</strong> The first time you open a game, a
            short practice round with free hints shows you how it works. You can skip it.
          </li>
          <li className="bg-surface rounded-[18px] p-4 text-[15px] leading-relaxed">
            <strong className="font-display mb-1 block text-[16px] font-extrabold">Hints.</strong> Up to 3 per puzzle. Each one shows a
            single safe next step. A clear with hints earns half the XP.
          </li>
          <li className="bg-surface rounded-[18px] p-4 text-[15px] leading-relaxed">
            <strong className="font-display mb-1 block text-[16px] font-extrabold">Streaks.</strong> Clear at least one game a day to keep
            your streak. A Streak Freeze covers one missed day. You can hold 2.
          </li>
          <li className="bg-surface rounded-[18px] p-4 text-[15px] leading-relaxed">
            <strong className="font-display mb-1 block text-[16px] font-extrabold">Leagues.</strong> Every Monday you join a league of 30.
            XP you earn in the week is your score. The top 7 move up, the bottom 5 move down.
          </li>
          <li className="bg-surface rounded-[18px] p-4 text-[15px] leading-relaxed">
            <strong className="font-display mb-1 block text-[16px] font-extrabold">Relaxed mode.</strong> Turn it on in{" "}
            <Link href="/settings" className="text-accent font-semibold underline underline-offset-3">
              Settings
            </Link>{" "}
            to hide timers while you play. Your time still shows on the results screen.
          </li>
        </ul>
      </div>

      {WORLDS.map((w) => (
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
        <FaqAccordion items={SITE_FAQ} className="not-prose" />
      </section>
    </>
  );
}
