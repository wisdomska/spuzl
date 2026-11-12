import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { MakerCredit } from "@/components/seo/MakerCredit";
import { BackLink } from "@/components/seo/BackLink";

const LINKS = [
  ["/games", "All games"],
  ["/how-to-play", "How to play"],
  ["/fair-play", "Fair play"],
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
  ["/contact", "Contact"],
] as const;

/**
 * Static pages: a readable 680 px column for prose; a page that marks an element `data-wide` (How to play, a card
 * catalogue) gets the full 1112 px public width. R6: Back (the previous page, or "/"), smooth same-page scrolling and
 * a short entrance for the page.
 */
export default function InfoLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-smooth-scroll className="safe-top min-h-dvh px-4 pt-6 pb-16">
      <div className="mx-auto flex max-w-[680px] flex-col gap-6 has-[[data-wide]]:max-w-[1112px]">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BackLink fallback="/" />
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load: visitors get the landing page at "/" (proxy.ts) */}
            <a href="/" aria-label="SPUZL home" className="flex h-11 items-center">
              <Wordmark size={24} />
            </a>
          </div>
          <Link href="/settings" className="text-muted flex h-11 items-center text-[15px] font-medium">
            Settings
          </Link>
        </header>
        <main className="info-prose hero-in">{children}</main>
        <footer className="border-line flex flex-col gap-2 border-t pt-5">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
            {LINKS.map(([href, label]) => (
              <Link key={href} href={href} className="text-muted flex h-11 items-center text-[14px] font-medium">
                {label}
              </Link>
            ))}
          </nav>
          <MakerCredit className="self-start" />
        </footer>
      </div>
    </div>
  );
}
