import type { Instrumentation } from "next";
import { SENTRY_DSN, sentryOptions } from "@/lib/monitoring/sentry";

/** Server and edge monitoring. Sentry only starts when NEXT_PUBLIC_SENTRY_DSN is set. */
export async function register() {
  if (!SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init(sentryOptions());
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
