import type { Metadata } from "next";
import Link from "next/link";
import { WORLDS, gamesInWorld } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { Spuz } from "@/components/brand/Spuz";
import { Wordmark } from "@/components/brand/Wordmark";
import { TryIt } from "@/components/landing/TryIt";
import { aboutCopy as T } from "@/lib/copy/about";

export const metadata: Metadata = {
  title: { absolute: T.metaTitle },
  description: T.metaDescription,
};

const PRIMARY =
  "press bg-accent text-on-accent flex h-14 items-center justify-center gap-2 rounded-full px-7 text-[17px] font-bold shadow-[0_5px_0_var(--accent-depth)]";
const SECONDARY = "press border-line text-text flex h-14 items-center justify-center rounded-full border-2 px-7 text-[17px] font-bold";
const EYEBROW = "text-accent font-mono text-[13px] font-semibold tracking-[0.18em] uppercase";
const H2 = "font-display text-[32px] leading-[1.05] font-black tracking-[-0.03em] sm:text-[44px]";

/**
 * Public landing page. Signed-out visitors get it at "/" (proxy rewrite), so the homepage names the app, says what
 * it does and links the privacy policy without a login, as Google's OAuth branding review requires.
 */
export default function Landing() {
  return (
    <div className="safe-top min-h-dvh overflow-x-clip">
      {/* Nav */}
      <header className="sticky top-0 z-20 px-4 pt-3">
        <nav className="bg-surface/85 border-line mx-auto flex h-16 max-w-[1160px] items-center justify-between rounded-full border px-4 backdrop-blur-md sm:px-6">
          <Link href="/" aria-label="SPUZL home" className="flex h-11 items-center">
            <Wordmark size={26} />
          </Link>
          <div className="text-muted hidden items-center gap-7 text-[15px] font-semibold md:flex">
            <a href="#how" className="hover:text-text">
              {T.nav.how}
            </a>
            <a href="#worlds" className="hover:text-text">
              {T.nav.worlds}
            </a>
            <a href="#friends" className="hover:text-text">
              {T.nav.friends}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/welcome" className="text-text hidden h-11 items-center px-3 text-[15px] font-semibold sm:flex">
              {T.nav.signIn}
            </Link>
            <Link href="/intro" className="press bg-accent text-on-accent flex h-11 items-center rounded-full px-5 text-[15px] font-bold">
              {T.nav.play}
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto flex max-w-[1160px] flex-col px-4 sm:px-6">
        {/* Hero */}
        <section className="grid items-center gap-12 pt-10 pb-16 lg:grid-cols-[1.15fr_1fr] lg:pt-16 lg:pb-24">
          <div className="flex flex-col gap-6">
            <p className="bg-surface-raised text-muted flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold">
              <span className="text-text font-display font-black">{T.name}</span>
              <span aria-hidden>·</span>
              {T.eyebrow}
            </p>
            <h1 className="font-display text-[46px] leading-[0.98] font-black tracking-[-0.045em] text-balance sm:text-[64px] lg:text-[80px]">
              <span className="sr-only">{T.name}: </span>
              {T.headline[0]} {T.headline[1]} <span className="text-accent">{T.headlineAccent}</span>
            </h1>
            <p className="text-muted max-w-[540px] text-[17px] leading-relaxed sm:text-[18px]">{T.lede}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/intro" className={PRIMARY}>
                <Icon name="play" size={20} />
                {T.play}
              </Link>
              <Link href="/welcome" className={SECONDARY}>
                {T.signIn}
              </Link>
            </div>
            <p className="text-muted flex items-center gap-2 text-[14px]">
              <Icon name="lock-simple" size={16} />
              {T.trust}
            </p>
          </div>
          <TryIt />
        </section>

        {/* Stats */}
        <section aria-label="SPUZL in numbers" className="border-line grid grid-cols-3 border-y py-8">
          {T.stats.map(([n, label]) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span className="font-display text-[34px] leading-none font-black tracking-[-0.03em] sm:text-[48px]">{n}</span>
              <span className="text-muted text-[14px] font-semibold">{label}</span>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-24 py-16 sm:py-24">
          <p className={EYEBROW}>{T.howEyebrow}</p>
          <h2 className={`${H2} mt-3`}>{T.howTitle}</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {T.steps.map(([title, body], i) => (
              <li key={title} className={`border-t-2 pt-5 ${i === 2 ? "border-accent" : "border-text"}`}>
                <span className="text-muted font-mono text-[13px] font-semibold">0{i + 1}</span>
                <p
                  className={`font-display mt-2 text-[34px] leading-none font-black tracking-[-0.04em] sm:text-[40px] ${i === 2 ? "text-accent" : ""}`}
                >
                  {title}
                </p>
                <p className="text-muted mt-3 text-[16px] leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Worlds */}
        <section id="worlds" className="scroll-mt-24 pb-16 sm:pb-24">
          <p className={EYEBROW}>{T.worldsEyebrow}</p>
          <h2 className={`${H2} mt-3`}>{T.worldsTitle}</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORLDS.map((w) => {
              const games = gamesInWorld(w.id);
              return (
                <li key={w.id} className="bg-surface border-line flex flex-col gap-3 rounded-[24px] border p-5">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex size-11 items-center justify-center rounded-[14px]"
                      style={{ background: w.color, color: "var(--on-accent)" }}
                    >
                      <Icon name={w.icon} size={22} />
                    </span>
                    <div className="flex flex-col">
                      <p className="font-display text-[18px] leading-tight font-black">{w.name}</p>
                      <p className="text-muted text-[13px] font-semibold">
                        {w.tagline} · {T.gamesCount(games.length)}
                      </p>
                    </div>
                  </div>
                  <p className="text-muted text-[14px] leading-relaxed">{games.map((g) => g.name).join(" · ")}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Friends */}
        <section id="friends" className="scroll-mt-24 pb-16 sm:pb-24">
          <p className={EYEBROW}>{T.friendsEyebrow}</p>
          <h2 className={`${H2} mt-3`}>{T.friendsTitle}</h2>
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {T.friends.map(([icon, title, body]) => (
              <li key={title} className="bg-surface-raised flex flex-col gap-3 rounded-[24px] p-6">
                <Icon name={icon} size={28} className="text-accent" />
                <p className="font-display text-[22px] font-black">{title}</p>
                <p className="text-muted text-[15px] leading-relaxed">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Final call to action */}
        <section className="bg-accent text-on-accent relative mb-16 flex flex-col items-center gap-5 overflow-hidden rounded-[36px] px-6 py-12 text-center sm:py-16">
          <Spuz mood="wave" size={120} color="var(--surface)" decorative />
          <h2 className="font-display max-w-[640px] text-[30px] leading-[1.05] font-black tracking-[-0.03em] text-balance sm:text-[44px]">
            {T.ctaTitle}
          </h2>
          <p className="text-[17px] font-medium opacity-80">{T.ctaBody}</p>
          <Link
            href="/intro"
            className="press bg-bg text-text flex h-14 items-center gap-2 rounded-full px-8 text-[17px] font-bold shadow-[0_5px_0_var(--depth)]"
          >
            <Icon name="play" size={20} />
            {T.play}
          </Link>
        </section>

        {/* Accounts and data (required by Google's OAuth branding review) */}
        <section aria-labelledby="data" className="border-line max-w-[760px] border-t pt-10 pb-12">
          <h2 id="data" className="font-display flex items-center gap-2 text-[22px] font-black">
            <Icon name="shield-check" size={22} className="text-accent" />
            {T.accountTitle}
          </h2>
          <div className="text-muted mt-4 flex flex-col gap-3 text-[15px] leading-relaxed">
            {T.account.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p>
              <Link href="/privacy" className="text-text font-semibold underline underline-offset-4">
                {T.privacy}
              </Link>
              {" · "}
              <Link href="/terms" className="text-text font-semibold underline underline-offset-4">
                {T.terms}
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-line border-t px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <Wordmark size={22} />
              <span className="text-muted text-[14px] font-medium">{T.credit}</span>
            </div>
            <span className="text-muted text-[13px]">{T.made}</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
            {T.footer.map(([href, label]) => (
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
