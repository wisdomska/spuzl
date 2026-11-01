/**
 * Client start-up side effects (runs before the app is interactive, on every page):
 * error monitoring, anonymous analytics, the service worker, today's Dailies prefetch and the
 * offline clear sync. Each step is isolated so one failing never blocks the others.
 */
import { initSentryClient } from "@/lib/monitoring/sentry";
import { initAnalytics, track } from "@/lib/analytics/track";
import { installTapStamp } from "@/lib/analytics/tap-to-board";
import {
  backgroundDownloadsOff,
  configureDailyPack,
  prefetchDailies,
  registerServiceWorker,
  scheduleDailyPack,
  swEnabled,
} from "@/lib/offline/register";
import { startOfflineSync } from "@/lib/offline/queue";

const safe = (fn: () => unknown) => {
  try {
    const r = fn();
    if (r && typeof (r as Promise<unknown>).catch === "function") (r as Promise<unknown>).catch(() => undefined);
  } catch {
    /* never block start-up */
  }
};

safe(initSentryClient);
safe(initAnalytics);
safe(() => track("app_open", { standalone: window.matchMedia("(display-mode: standalone)").matches }));
safe(startOfflineSync);
safe(installTapStamp);
safe(() => window.addEventListener("appinstalled", () => track("pwa_installed")));

if (swEnabled()) {
  const idle = (fn: () => void) =>
    typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fn, { timeout: 8000 }) : setTimeout(fn, 3000);
  const afterLoad = (fn: () => void) =>
    document.readyState === "complete" ? fn() : window.addEventListener("load", () => fn(), { once: true });
  // Low data mode or Save-Data: no background downloads. Otherwise wait well past first paint so the
  // prefetch never competes with the screen the player opened.
  const prefetch = () => {
    if (!backgroundDownloadsOff()) setTimeout(() => idle(() => safe(prefetchDailies)), 10_000);
    // SPZ-27b: the next day's pack right after GMT midnight (or on return), and the worker's
    // background fetch where the browser allows it.
    safe(scheduleDailyPack);
    safe(() => configureDailyPack(!backgroundDownloadsOff()));
  };
  afterLoad(() =>
    safe(async () => {
      await registerServiceWorker();
      // The first visit is not controlled until the worker claims the page.
      if (navigator.serviceWorker.controller) prefetch();
      else navigator.serviceWorker.addEventListener("controllerchange", prefetch, { once: true });
    }),
  );
  // Low-data mode switched in Settings (or by the slow-connection suggestion): tell the worker.
  let packOn = !backgroundDownloadsOff();
  safe(() =>
    new MutationObserver(() => {
      if (packOn === !backgroundDownloadsOff()) return; // settings re-apply the attribute on every change
      packOn = !packOn;
      safe(() => configureDailyPack(packOn));
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-low-data"] }),
  );
}
