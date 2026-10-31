import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

const LINKS = [
  ["/how-to-play", "How to play"],
  ["/fair-play", "Fair play"],
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
  ["/contact", "Contact"],
] as const;

/** Static pages: readable column (max 680 px), back to the Grid, footer links. */
export default function InfoLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="safe-top min-h-dvh px-4 pt-6 pb-16">
      <div className="mx-auto flex max-w-[680px] flex-col gap-6">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="Back to SPUZL" className="flex h-11 items-center">
            <Wordmark size={28} />
          </Link>
          <Link href="/settings" className="text-muted flex h-11 items-center text-[15px] font-medium">
            Settings
          </Link>
        </header>
        <main className="info-prose">{children}</main>
        <footer className="border-line flex flex-wrap gap-x-4 gap-y-2 border-t pt-5">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="text-muted flex h-11 items-center text-[14px] font-medium">
              {label}
            </Link>
          ))}
        </footer>
      </div>
    </div>
  );
}
