import type { Metadata } from "next";
import Link from "next/link";
import { WORLDS, gamesInWorld } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { aboutCopy as T } from "@/lib/copy/about";

export const metadata: Metadata = {
  title: { absolute: T.metaTitle },
  description: T.metaDescription,
};

/**
 * Public About page. Signed-out visitors get it at "/" (proxy rewrite), so the homepage names the app and says
 * what it does without a login, as Google's OAuth branding review requires.
 */
export default function About() {
  return (
    <>
      <h1>{T.name}</h1>
      <p className="lede">{T.lede}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/intro"
          className="press bg-accent flex h-12 items-center gap-2 rounded-[16px] px-5 text-[16px] font-bold"
          style={{ color: "var(--on-accent)", textDecoration: "none" }}
        >
          <Icon name="play" size={18} />
          {T.play}
        </Link>
        <Link
          href="/welcome"
          className="press bg-surface-raised flex h-12 items-center rounded-[16px] px-5 text-[16px] font-semibold"
          style={{ color: "var(--text)", textDecoration: "none" }}
        >
          {T.signIn}
        </Link>
      </div>

      <h2>{T.whatTitle}</h2>
      <ul>
        {T.what.map(([title, body]) => (
          <li key={title}>
            <strong>{title}.</strong> {body}
          </li>
        ))}
      </ul>

      <h2>{T.worldsTitle}</h2>
      <ul>
        {WORLDS.map((w) => (
          <li key={w.id}>
            <strong>{w.name}:</strong>{" "}
            {gamesInWorld(w.id)
              .map((g) => g.name)
              .join(", ")}
          </li>
        ))}
      </ul>

      <h2>{T.accountTitle}</h2>
      {T.account.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <p>
        <Link href="/privacy">{T.privacy}</Link> · <Link href="/terms">{T.terms}</Link> · <Link href="/contact">{T.contact}</Link>
      </p>
      <p className="text-muted">{T.made}</p>
    </>
  );
}
