"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { backAction, navState } from "@/lib/client/nav";
import { gamesCopy } from "@/lib/copy/seo";

/**
 * Back on the public subpages (R6): the previous page when this visit came from another page of the site, otherwise
 * the page's parent (`fallback`). A real link to the parent, so it works without JS and for crawlers. "/" is a full
 * page load (visitors get the landing page there, proxy.ts).
 */
export function BackLink({ fallback, className = "" }: { fallback: string; className?: string }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
    if (backAction({ ...navState(), current: window.location.pathname }) !== "back") return; // follow the link
    e.preventDefault();
    window.history.back();
  };
  const cls = `press text-muted hover:text-text -ml-2 flex h-11 w-fit items-center gap-1.5 rounded-full pr-3 pl-2 text-[15px] font-semibold ${className}`;
  const body = (
    <>
      <Icon name="arrow-left" size={20} />
      {gamesCopy.nav.back}
    </>
  );
  return fallback === "/" ? (
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load: visitors get the landing page at "/"
    <a href="/" onClick={onClick} className={cls}>
      {body}
    </a>
  ) : (
    <Link href={fallback as never} onClick={onClick} className={cls}>
      {body}
    </Link>
  );
}
