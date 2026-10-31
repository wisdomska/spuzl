"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

export const NAV = [
  { href: "/", icon: "map-trifold", label: "Grid" },
  { href: "/leagues", icon: "trophy", label: "Leagues" },
  { href: "/friends", icon: "users", label: "Friends" },
  { href: "/shop", icon: "storefront", label: "Shop" },
  { href: "/me", icon: "user", label: "Me" },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // Leaderboards and quests live under the Leagues tab.
  if (href === "/leagues") return ["/leagues", "/leaderboards", "/quests"].some((p) => pathname.startsWith(p));
  return pathname.startsWith(href);
}

/** Mobile bottom nav: 80 px, 5 items, active lime (global chrome is always lime). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="safe-bottom border-line bg-surface fixed inset-x-0 bottom-0 z-30 grid h-20 grid-cols-5 border-t pb-3 lg:hidden"
    >
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center justify-center gap-[3px]"
            style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
          >
            <Icon name={n.icon} size={24} />
            <span className="text-[12px] font-semibold">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop ≥ 1024: 88 px left rail. */
export function DesktopRail() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="border-line bg-surface fixed inset-y-0 left-0 z-30 hidden w-[88px] flex-col items-center gap-2 border-r py-6 lg:flex"
    >
      <Link href="/" aria-label="SPUZL home" className="font-display mb-4 text-[15px] font-black tracking-tight">
        SPU<span className="text-accent">Z</span>L
      </Link>
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-[18px] transition-colors duration-150"
            style={{ color: active ? "var(--accent)" : "var(--text-muted)", background: active ? "var(--surface-raised)" : "transparent" }}
          >
            <Icon name={n.icon} size={24} />
            <span className="text-[12px] font-semibold">{n.label}</span>
          </Link>
        );
      })}
      <Link href="/settings" aria-label="Settings" className="text-muted mt-auto flex h-12 w-12 items-center justify-center rounded-[14px]">
        <Icon name="gear-six" size={22} />
      </Link>
    </nav>
  );
}
