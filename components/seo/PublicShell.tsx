import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { aboutCopy } from "@/lib/copy/about";
import { gamesCopy as T } from "@/lib/copy/seo";
import { MakerCredit } from "@/components/seo/MakerCredit";

/**
 * Frame of the public, crawlable pages (the game catalogue, game pages, public world pages): the landing page's nav
 * (home, games, how to play, Sign in, Play) and footer. Server-rendered with plain links, no client JS of its own.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="safe-top min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-20 px-4 pt-3">
        <nav className="bg-surface/85 border-line mx-auto flex h-16 max-w-[1160px] items-center justify-between gap-2 rounded-full border px-4 backdrop-blur-md sm:px-6">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load: visitors get the landing page at "/" (proxy.ts), players Home */}
          <a href="/" aria-label={T.nav.home} className="flex h-11 items-center">
            <Wordmark size={24} />
          </a>
          <div className="text-muted hidden items-center gap-6 text-[15px] font-semibold md:flex">
            <Link href="/games" className="hover:text-text flex h-11 items-center">
              {T.nav.games}
            </Link>
            <Link href="/how-to-play" className="hover:text-text flex h-11 items-center">
              {T.nav.how}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/welcome" className="text-text flex h-11 items-center px-2 text-[15px] font-semibold sm:px-3">
              {aboutCopy.nav.signIn}
            </Link>
            <Link
              href="/welcome/play"
              className="press bg-accent text-on-accent flex h-11 items-center rounded-full px-5 text-[15px] font-bold"
            >
              {aboutCopy.nav.play}
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto flex max-w-[1160px] flex-col px-4 pt-8 pb-16 sm:px-6">{children}</main>
      <footer className="border-line border-t px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3">
              <Wordmark size={22} />
              <MakerCredit />
            </div>
            <span className="text-muted text-[13px]">{aboutCopy.made}</span>
          </div>
          <nav aria-label={T.nav.footer} className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/games" className="text-muted hover:text-text flex h-11 items-center text-[14px] font-medium">
              {T.allGames}
            </Link>
            {aboutCopy.footer.map(([href, label]) => (
              <Link key={href} href={href} className="text-muted hover:text-text flex h-11 items-center text-[14px] font-medium">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
