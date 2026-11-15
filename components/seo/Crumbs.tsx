import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { gamesCopy as T } from "@/lib/copy/seo";

/** Visible breadcrumbs for a public page, first to last ([name, path]); the last is the current page. */
export function Crumbs({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <nav aria-label={T.nav.breadcrumb} className="text-muted text-[14px]">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.slice(0, -1).map(([name, href]) => (
          <li key={href} className="flex items-center gap-1.5">
            {/* "/" is a full page load (the landing page for visitors, proxy.ts) */}
            {href === "/" ? (
              <a href={href} className="hover:text-text flex min-h-11 items-center underline underline-offset-4">
                {name}
              </a>
            ) : (
              <Link href={href} className="hover:text-text flex min-h-11 items-center underline underline-offset-4">
                {name}
              </Link>
            )}
            <Icon name="caret-right" size={12} />
          </li>
        ))}
        <li aria-current="page" className="text-text font-semibold">
          {items.at(-1)?.[0]}
        </li>
      </ol>
    </nav>
  );
}
