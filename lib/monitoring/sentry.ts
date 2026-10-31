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

export async function initSentryClient() {
  if (!SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({ ...sentryOptions(), replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0 });
}
