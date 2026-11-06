"use client";

/**
 * The single prompt queue (R2-04): never two prompts in one screen visit. Rules and priority live in
 * `lib/prompts/queue.ts` and `lib/prompts/ids.ts`; this is the client store around them.
 *
 *   const granted = usePromptSlot("alerts", wantsToShow);
 *   return granted ? <TheCard data-prompt="alerts" /> : null;
 *
 * `PromptHost` (mounted once in Providers) starts a new visit on every pathname change and measures loads for
 * the low-data rule: the page load, and each in-app link tap to the next screen's first render.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { decide, enterVisit, initialQueue, request, settleIn, withdraw, type QueueState } from "@/lib/prompts/queue";
import type { PromptId } from "@/lib/prompts/ids";
import { readPageLoadMs, recordLoad } from "@/lib/lowdata/suggest";
import { isPlayNav } from "@/lib/analytics/play-nav";

let state: QueueState = initialQueue();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function set(next: QueueState) {
  if (next === state) return;
  state = next;
  for (const f of subs) f();
  schedule();
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = null;
  const wait = settleIn(state, Date.now());
  if (wait === null) return;
  timer = setTimeout(() => set(decide(state, Date.now())), wait);
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}

const activeSnapshot = () => state.active;
const serverSnapshot = () => null;

/** Asks for this screen visit's prompt slot while `want` is true. True while this prompt holds it. */
export function usePromptSlot(id: PromptId, want: boolean): boolean {
  const active = useSyncExternalStore(subscribe, activeSnapshot, serverSnapshot);
  useEffect(() => {
    if (!want) return;
    set(request(state, id));
    return () => set(withdraw(state, id));
  }, [id, want]);
  return want && active === id;
}

/** A tap on an in-app link: when the pathname next changes, that's one measured load. */
const NAV_MAX_MS = 15_000;
let navTap: { at: number; from: string } | null = null;
let pageMeasured = false;

function onClickCapture(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const el = e.target as Element | null;
  const a = el?.closest?.("a[href]") as HTMLAnchorElement | null;
  // Play links are measured by tap-to-board (to an interactive board), so they aren't counted twice.
  if (!a || a.target === "_blank" || a.hasAttribute("download") || isPlayNav(a)) return;
  let url: URL;
  try {
    url = new URL(a.href, location.href);
  } catch {
    return;
  }
  if (url.origin !== location.origin || url.pathname === location.pathname) return;
  navTap = { at: performance.now(), from: location.pathname };
}

export function PromptHost() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    set(enterVisit(state, pathname, Date.now()));
    if (first.current) {
      first.current = false;
      return;
    }
    const tap = navTap;
    navTap = null;
    if (tap && tap.from !== pathname) {
      const ms = performance.now() - tap.at;
      if (ms <= NAV_MAX_MS) recordLoad(ms);
    }
  }, [pathname]);

  useEffect(() => {
    document.addEventListener("click", onClickCapture, { capture: true, passive: true });
    // The page load itself, once it has finished (once per document).
    const measure = () => {
      if (pageMeasured) return;
      pageMeasured = true;
      const ms = readPageLoadMs();
      if (ms !== null) recordLoad(ms);
    };
    if (document.readyState === "complete") setTimeout(measure, 0);
    else window.addEventListener("load", () => setTimeout(measure, 0), { once: true });
    return () => document.removeEventListener("click", onClickCapture, { capture: true });
  }, []);

  return null;
}
