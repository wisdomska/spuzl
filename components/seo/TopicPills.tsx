import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** Links to guides and game lists as a row of pills (landing page, /games, game pages, related guides). */
export function TopicPills({ pages, className = "" }: { pages: readonly { path: string; label: string }[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {pages.map((p) => (
        <li key={p.path}>
          <Link
            href={p.path}
            className="press bg-surface border-line hover:border-accent flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold"
          >
            {p.label}
            <Icon name="arrow-right" size={16} className="text-accent" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
