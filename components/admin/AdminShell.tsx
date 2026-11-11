"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { can, ROLE_LABEL, type Permission, type Role } from "@/lib/admin/roles";
import { useAdminMe, type AdminMe } from "@/lib/client/admin";
import { adminSignOut } from "@/lib/client/admin-auth";
import { adminCopy } from "@/lib/copy/admin";
import { MODAL_SCRIM } from "@/components/ui/Modal";

/** Sidebar counts: things waiting on someone (open reports, puzzles and content to review, new feedback). */
type BadgeKey = "moderation" | "review" | "content" | "feedback";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  perm: Permission;
  badge?: BadgeKey;
}
interface NavGroup {
  id: keyof typeof adminCopy.shell.groups;
  items: NavItem[];
}

const S = adminCopy.shell;
const N = S.nav;

/**
 * The console menu in owner-approved groups (admin overhaul). Labels and titles changed, URLs did not. A group with
 * one page (Home, Shop) shows as a plain link; the others fold open and shut.
 */
const GROUPS: NavGroup[] = [
  { id: "home", items: [{ href: "/admin", label: N.overview, icon: "house", perm: "players.read" }] },
  {
    id: "players",
    items: [
      { href: "/admin/players", label: N.players, icon: "users", perm: "players.read" },
      { href: "/admin/moderation", label: N.moderation, icon: "shield-check", perm: "moderation.read", badge: "moderation" },
      { href: "/admin/join-requests", label: N.joinRequests, icon: "hand-waving", perm: "joinlog.read" },
      { href: "/admin/feedback", label: N.feedback, icon: "chat-circle-text", perm: "feedback.read", badge: "feedback" },
    ],
  },
  {
    id: "games",
    items: [
      { href: "/admin/library", label: N.library, icon: "game-controller", perm: "content.read" },
      { href: "/admin/content", label: N.content, icon: "note-pencil", perm: "content.read", badge: "content" },
      { href: "/admin/puzzles", label: N.puzzles, icon: "puzzle-piece", perm: "calendar.read", badge: "review" },
      { href: "/admin/calendar", label: N.calendar, icon: "calendar-blank", perm: "calendar.read" },
      { href: "/admin/daily-five", label: N.dailyFive, icon: "star", perm: "dailyFive.read" },
      { href: "/admin/events", label: N.events, icon: "confetti", perm: "events.read" },
      { href: "/admin/shop", label: N.shop, icon: "storefront", perm: "catalog.read" },
    ],
  },
  {
    id: "insights",
    items: [
      { href: "/admin/metrics", label: N.metrics, icon: "chart-bar", perm: "metrics.read" },
      { href: "/admin/liveops", label: N.liveops, icon: "pulse", perm: "liveops.read" },
    ],
  },
  {
    id: "settings",
    items: [
      { href: "/admin/settings", label: N.settings, icon: "sliders-horizontal", perm: "settings.read" },
      { href: "/admin/team", label: N.team, icon: "users-three", perm: "team.manage" },
      { href: "/admin/audit", label: N.audit, icon: "clock-counter-clockwise", perm: "audit.read" },
    ],
  },
];

/** Open reports are the urgent ones (danger); the rest are waiting (gold). */
const BADGE_TONE: Record<BadgeKey, string> = {
  moderation: "bg-[var(--danger-tint)] text-danger",
  review: "bg-[var(--warn-tint)] text-gold",
  content: "bg-[var(--warn-tint)] text-gold",
  feedback: "bg-[var(--warn-tint)] text-gold",
};

/** The overview is /admin itself: every other page sits under it, so it is active only on an exact match. */
const isActive = (path: string, href: string) => path === href || (href !== "/admin" && path.startsWith(href + "/"));

/* ---- Which groups are folded shut, remembered per browser (falls back to memory when storage is blocked). ---- */

const STORE_KEY = "spuzl.admin.nav.closed";
const listeners = new Set<() => void>();
let closedMem: string | null = null;
function readClosed(): string {
  if (closedMem === null) {
    try {
      closedMem = localStorage.getItem(STORE_KEY) ?? "";
    } catch {
      closedMem = "";
    }
  }
  return closedMem;
}
function writeClosed(ids: string[]) {
  closedMem = ids.join(",");
  try {
    localStorage.setItem(STORE_KEY, closedMem);
  } catch {
    /* storage blocked: memory only */
  }
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
/** Every group starts open (server render and first visit); closed ones are read after hydration. */
const useClosedGroups = () => useSyncExternalStore(subscribe, readClosed, () => "");

export function AdminShell({ role, email, children }: { role: Role; email: string | null; children: ReactNode }) {
  const path = usePathname();
  const { data: me } = useAdminMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((n) => can(role, n.perm)) })).filter((g) => g.items.length);
  const current = groups.flatMap((g) => g.items).find((n) => isActive(path, n.href));
  // Drill-in views (one Daily or one puzzle) give the whole width to the board, checks and publish panel: the menu
  // moves behind the Menu button, as on phones and tablets.
  const focus = /^\/admin\/(calendar\/[^/]+\/[^/]+|puzzles\/[^/]+)$/.test(path);
  return (
    <div className={`grid min-h-dvh grid-cols-1 ${focus ? "" : "lg:grid-cols-[248px_1fr]"}`}>
      {!focus && (
        <nav
          aria-label={S.navAria}
          className="bg-surface border-line sticky top-0 hidden h-dvh flex-col border-r px-3 pt-[18px] pb-3 lg:flex"
        >
          <Logo />
          <div className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-3">
            <NavGroups groups={groups} path={path} counts={me?.counts} />
          </div>
          <Account role={role} email={email} />
        </nav>
      )}
      <div className={`bg-surface border-line flex h-14 items-center gap-2 border-b px-2 ${focus ? "" : "lg:hidden"}`}>
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="hover:bg-surface-raised flex h-11 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold"
            >
              <Icon name="list" size={20} />
              {S.menu}
              <MenuDot counts={me?.counts} groups={groups} />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={`sheet-overlay z-50 ${MODAL_SCRIM}`} />
            <Dialog.Content
              aria-describedby={undefined}
              className="drawer-content bg-surface fixed inset-y-0 left-0 z-50 flex w-[min(320px,calc(100vw-48px))] flex-col pt-[max(12px,env(safe-area-inset-top))] pr-3 pb-[max(12px,env(safe-area-inset-bottom))] pl-[max(12px,env(safe-area-inset-left))] shadow-[inset_-1px_0_0_var(--line)] outline-none"
            >
              <div className="flex items-center justify-between pb-1">
                <Dialog.Title asChild>
                  <span className="px-2 text-[13px] font-semibold">
                    <Logo inline />
                  </span>
                </Dialog.Title>
                <Dialog.Close
                  aria-label={S.closeMenu}
                  className="hover:bg-surface-raised flex size-11 items-center justify-center rounded-[10px]"
                >
                  <Icon name="x" size={20} />
                </Dialog.Close>
              </div>
              <nav aria-label={S.navAria} className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-3">
                <NavGroups groups={groups} path={path} counts={me?.counts} onNavigate={() => setMenuOpen(false)} />
              </nav>
              <Account role={role} email={email} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <Link href="/admin" aria-label={S.home} className="ml-1 hidden sm:block">
          <Logo inline />
        </Link>
        {current && (
          <span className="text-muted ml-auto truncate pr-2 text-[14px] font-semibold" aria-hidden>
            {current.label}
          </span>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Logo({ inline = false }: { inline?: boolean }) {
  const mark = (
    <span className="font-display flex items-end text-[22px] leading-[0.9] font-black tracking-[-0.05em]">
      SPU<span className="text-accent">Z</span>L
      <span className="num text-muted ml-2 text-[12px] font-semibold tracking-normal">{S.badge}</span>
    </span>
  );
  if (inline) return mark;
  return (
    <Link href="/admin" aria-label={S.home} className="flex px-2 pb-4">
      {mark}
    </Link>
  );
}

/** A dot on the Menu button when anything is waiting, so the count is not hidden behind the drawer. */
function MenuDot({ counts, groups }: { counts: AdminMe["counts"] | undefined; groups: NavGroup[] }) {
  const total = groups.reduce((s, g) => s + groupTotal(g, counts), 0);
  if (!total) return null;
  return (
    <span className="num text-gold rounded-full bg-[var(--warn-tint)] px-1.5 text-[11px] leading-[18px] font-bold">
      <span aria-hidden>{total.toLocaleString("en-US")}</span>
      <span className="sr-only">{S.groupCount(total)}</span>
    </span>
  );
}

const countOf = (counts: AdminMe["counts"] | undefined, key: BadgeKey | undefined) => (key && counts ? (counts[key] ?? 0) : 0);
const groupTotal = (g: NavGroup, counts: AdminMe["counts"] | undefined) => g.items.reduce((s, n) => s + countOf(counts, n.badge), 0);

function NavGroups({
  groups,
  path,
  counts,
  onNavigate,
}: {
  groups: NavGroup[];
  path: string;
  counts: AdminMe["counts"] | undefined;
  onNavigate?: () => void;
}) {
  const closedRaw = useClosedGroups();
  const closed = new Set(closedRaw ? closedRaw.split(",") : []);
  // The group holding the current page opens itself, unless the admin shut it on this page.
  const [shutHere, setShutHere] = useState<{ path: string; id: string } | null>(null);
  return (
    <div className="flex flex-col gap-1">
      {groups.map((g) => {
        if (g.items.length === 1 && (g.id === "home" || g.id === "shop"))
          return (
            <ul key={g.id} className="flex flex-col">
              <NavLink item={g.items[0]} path={path} counts={counts} onNavigate={onNavigate} />
            </ul>
          );
        const active = g.items.some((n) => isActive(path, n.href));
        const open = active ? !(shutHere?.path === path && shutHere.id === g.id) : !closed.has(g.id);
        const total = groupTotal(g, counts);
        const listId = `nav-${g.id}`;
        const toggle = () => {
          if (active) setShutHere(open ? { path, id: g.id } : null);
          const next = new Set(closed);
          if (open) next.add(g.id);
          else next.delete(g.id);
          writeClosed([...next]);
        };
        return (
          <div key={g.id} className="flex flex-col pt-1.5">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={toggle}
              className="text-muted hover:text-text flex h-9 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-bold tracking-[0.04em] uppercase lg:h-7"
            >
              <span className="flex-1 text-left">{S.groups[g.id]}</span>
              {!open && total > 0 && (
                <span className="num bg-surface-raised text-text rounded-full px-1.5 text-[11px] leading-[18px] tracking-normal">
                  <span aria-hidden>{total.toLocaleString("en-US")}</span>
                  <span className="sr-only">{S.groupCount(total)}</span>
                </span>
              )}
              <Icon name="caret-down" size={14} className={`transition-transform duration-150 ${open ? "" : "-rotate-90"}`} />
            </button>
            <ul id={listId} hidden={!open} className="flex flex-col gap-0.5 lg:gap-0">
              {g.items.map((n) => (
                <NavLink key={n.href} item={n} path={path} counts={counts} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function NavLink({
  item: n,
  path,
  counts,
  onNavigate,
}: {
  item: NavItem;
  path: string;
  counts: AdminMe["counts"] | undefined;
  onNavigate?: () => void;
}) {
  const active = isActive(path, n.href);
  const count = countOf(counts, n.badge);
  return (
    <li>
      <Link
        href={n.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={`relative flex h-11 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] font-semibold lg:h-8 ${
          active ? "bg-surface-raised text-text" : "text-muted hover:bg-surface-raised/60 hover:text-text"
        }`}
      >
        {active && <span aria-hidden className="bg-accent absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full" />}
        <Icon name={n.icon} size={18} className={active ? "text-accent" : undefined} />
        <span className="min-w-0 flex-1 truncate">{n.label}</span>
        {count > 0 && n.badge && (
          <span className={`num rounded-full px-1.5 text-[11px] leading-[18px] font-bold ${BADGE_TONE[n.badge]}`}>
            {count.toLocaleString("en-US")}
            <span className="sr-only"> {S.count[n.badge]}</span>
          </span>
        )}
      </Link>
    </li>
  );
}

function Account({ role, email }: { role: Role; email: string | null }) {
  const router = useRouter();
  // One row (who, role, sign out) so the whole grouped menu fits a laptop screen without scrolling.
  return (
    <div className="border-line flex items-center gap-2 border-t px-1 pt-2.5">
      <div className="flex min-w-0 flex-1 flex-col px-1.5">
        <span className="truncate text-[13px] leading-tight font-semibold" title={email ?? undefined}>
          <span className="sr-only">{S.signedInAs} </span>
          {email ?? S.navAria}
        </span>
        <span className="text-muted text-[12px] leading-tight">{ROLE_LABEL[role]}</span>
      </div>
      <button
        type="button"
        onClick={async () => {
          await adminSignOut();
          router.replace("/admin/login");
        }}
        aria-label={S.signOut}
        title={S.signOut}
        className="text-muted hover:bg-surface-raised hover:text-text flex size-11 shrink-0 items-center justify-center rounded-[10px] lg:size-9"
      >
        <Icon name="sign-out" size={18} />
      </button>
    </div>
  );
}
