/**
 * Sentry wiring shared by instrumentation-client.ts (browser) and instrumentation.ts (server, edge).
 * A no-op unless NEXT_PUBLIC_SENTRY_DSN is set; the SDK is imported lazily so builds without a DSN
 * ship none of it. No PII: no default PII, no replay, cookies and auth headers scrubbed, user dropped.
 */
import type { ErrorEvent } from "@sentry/nextjs";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

export function scrub(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      for (const h of Object.keys(event.request.headers)) {
        if (/^(authorization|cookie|x-forwarded-for|x-real-ip)$/i.test(h)) delete event.request.headers[h];
      }
    }
    if (typeof event.request.url === "string") event.request.url = event.request.url.split("?")[0];
    delete event.request.query_string;
    delete event.request.data;
  }
  return event;
}

export function sentryOptions() {
  return {
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: scrub,
  };
}

/** Most errors kept from before the SDK starts (a crash loop must not queue thousands). */
const EARLY_MAX = 20;

/**
 * Starts browser error monitoring once `ready` resolves (R3-03: after load and an idle moment, so the SDK's download
 * and set-up never add to the first screen's main-thread work). Errors thrown before then are kept and sent once
 * it is up, so nothing from the first load is lost.
 */
export async function initSentryClient(ready: Promise<void> = Promise.resolve()) {
  if (!SENTRY_DSN || typeof window === "undefined") return;
  const early: unknown[] = [];
  const keep = (err: unknown) => {
    if (early.length < EARLY_MAX) early.push(err);
  };
  const onError = (e: Event) => keep((e as Event & { error?: unknown; message?: string }).error ?? (e as { message?: string }).message);
  const onRejection = (e: PromiseRejectionEvent) => keep(e.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  try {
    await ready;
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({ ...sentryOptions(), replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0 });
    for (const err of early.splice(0)) if (err !== undefined) Sentry.captureException(err);
  } finally {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  }
}
