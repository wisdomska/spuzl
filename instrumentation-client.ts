/**
 * Client start-up side effects (runs before the app is interactive, on every page):
 * error monitoring, anonymous analytics, the service worker, today's Dailies prefetch and the
 * offline clear sync. Each step is isolated so one failing never blocks the others.
 */
import { initSentryClient } from "@/lib/monitoring/sentry";
import { initAnalytics, track } from "@/lib/analytics/track";
import { prefetchDailies, registerServiceWorker, swEnabled } from "@/lib/offline/register";
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
safe(() => window.addEventListener("appinstalled", () => track("pwa_installed")));

if (swEnabled()) {
  const idle = (fn: () => void) =>
    typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fn, { timeout: 8000 }) : setTimeout(fn, 3000);
  const prefetch = () => idle(() => safe(prefetchDailies));
  safe(async () => {
    await registerServiceWorker();
    // The first visit is not controlled until the worker claims the page.
    if (navigator.serviceWorker.controller) prefetch();
    else navigator.serviceWorker.addEventListener("controllerchange", prefetch, { once: true });
  });
}
