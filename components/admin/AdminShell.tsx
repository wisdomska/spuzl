"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { can, ROLE_LABEL, type Permission, type Role } from "@/lib/admin/roles";
import { useAdminMe } from "@/lib/client/admin";
import { adminSignOut } from "@/lib/client/admin-auth";
import { adminCopy } from "@/lib/copy/admin";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  perm: Permission;
  badge?: "puzzles" | "moderation" | "schools";
}

const S = adminCopy.shell;
const N = S.nav;

/** Design order first (Calendar to Shop and events), then the console's other tools. */
const NAV: NavItem[] = [
  { href: "/admin/calendar", label: N.calendar, icon: "calendar-blank", perm: "calendar.read" },
  { href: "/admin/puzzles", label: N.puzzles, icon: "puzzle-piece", perm: "calendar.read", badge: "puzzles" },
  { href: "/admin/moderation", label: N.moderation, icon: "shield-check", perm: "moderation.read", badge: "moderation" },
  { href: "/admin/liveops", label: N.liveops, icon: "pulse", perm: "liveops.read" },
  { href: "/admin/metrics", label: N.metrics, icon: "chart-bar", perm: "metrics.read" },
  { href: "/admin/schools", label: N.schools, icon: "graduation-cap", perm: "schools.read", badge: "schools" },
  { href: "/admin/shop", label: N.shop, icon: "storefront", perm: "catalog.read" },
  { href: "/admin/events", label: N.events, icon: "confetti", perm: "events.read" },
  { href: "/admin/content", label: N.content, icon: "note-pencil", perm: "content.read" },
  { href: "/admin/flags", label: N.flags, icon: "toggle-right", perm: "flags.read" },
  { href: "/admin/settings", label: N.settings, icon: "sliders-horizontal", perm: "settings.read" },
  { href: "/admin/library", label: N.library, icon: "list", perm: "content.read" },
  { href: "/admin/audit", label: N.audit, icon: "clock-counter-clockwise", perm: "audit.read" },
  { href: "/admin/team", label: N.team, icon: "users-three", perm: "team.manage" },
];

const BADGE_COLOR = { puzzles: "text-muted", moderation: "text-danger", schools: "text-gold" } as const;

export function AdminShell({ role, email, children }: { role: Role; email: string | null; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { data: me } = useAdminMe();
  const items = NAV.filter((n) => can(role, n.perm));
  // Drill-in views (one Daily or puzzle) get the icon rail so the board, checks and publish panel fit at 1280.
  const focus = /^\/admin\/(calendar\/[^/]+\/[^/]+|puzzles\/[^/]+)$/.test(path);
  return (
    <div className={`grid min-h-dvh grid-cols-[72px_1fr] ${focus ? "" : "lg:grid-cols-[220px_1fr]"}`}>
      <nav
        aria-label={S.navAria}
        data-rail={focus ? "icons" : "auto"}
        className="group bg-surface border-line sticky top-0 flex h-dvh flex-col gap-1 border-r px-3 py-[18px]"
      >
        <Link
          href="/admin/calendar"
          className="font-display flex items-end px-2 pb-4 text-[22px] leading-[0.9] font-black tracking-[-0.05em]"
          aria-label={S.home}
        >
          <span aria-hidden className="hidden group-data-[rail=auto]:lg:inline">
            SPU<span className="text-accent">Z</span>L
          </span>
          <span aria-hidden className="group-data-[rail=auto]:lg:hidden">
            S<span className="text-accent">Z</span>
          </span>
          <span className="num text-muted ml-2 hidden text-[12px] font-semibold tracking-normal group-data-[rail=auto]:lg:inline">
            {S.badge}
          </span>
        </Link>
        {items.map((n) => {
          const active = path === n.href || path.startsWith(n.href + "/");
          const count = n.badge ? me?.counts?.[n.badge] : null;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              title={n.label}
              className={`flex h-11 items-center justify-center gap-2.5 rounded-[10px] px-2.5 text-[14px] font-semibold group-data-[rail=auto]:lg:h-10 group-data-[rail=auto]:lg:justify-start ${active ? "bg-surface-raised text-text" : "text-muted hover:bg-surface-raised/60 hover:text-text"}`}
            >
              <Icon name={n.icon} size={18} />
              <span className="sr-only flex-1 group-data-[rail=auto]:lg:not-sr-only">{n.label}</span>
              {count ? (
                <span className={`num hidden text-[12px] font-semibold group-data-[rail=auto]:lg:inline ${BADGE_COLOR[n.badge!]}`}>
                  {count.toLocaleString("en-US")}
                  <span className="sr-only"> {n.badge === "puzzles" ? S.countPuzzles : S.countOpen}</span>
                </span>
              ) : null}
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col gap-2 px-1 pt-4">
          <div className="hidden min-w-0 flex-col group-data-[rail=auto]:lg:flex">
            <span className="truncate text-[13px] font-semibold" title={email ?? undefined}>
              {email ?? S.navAria}
            </span>
            <span className="num text-muted text-[12px]">{ROLE_LABEL[role]}</span>
          </div>
          <button
            type="button"
            onClick={async () => {
              await adminSignOut();
              router.replace("/admin/login");
            }}
            className="text-muted hover:bg-surface-raised hover:text-text flex h-11 items-center justify-center gap-2 rounded-[10px] px-2.5 text-[13px] font-semibold group-data-[rail=auto]:lg:h-10 group-data-[rail=auto]:lg:justify-start"
          >
            <Icon name="sign-out" size={18} />
            <span className="sr-only group-data-[rail=auto]:lg:not-sr-only">{S.signOut}</span>
          </button>
        </div>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
