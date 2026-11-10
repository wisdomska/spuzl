import { notFound } from "next/navigation";

/** Test-only routes (/dev/*) exist for visual parity fixtures. Hidden in production unless explicitly enabled. */
export function devOnly() {
  if (process.env.VERCEL_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "1") notFound();
}

/** Only accounts on the reserved `.test` top-level domain (RFC 2606: it never receives mail) can use test sign-in. */
export const TEST_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.test$/i;

/**
 * R4-27: the test sign-in route (/api/dev/sign-in), for E2E specs against hosted projects where email codes are
 * rate limited. Stricter than `devOnly`: it signs a browser in without an email, so it is never on in production,
 * whatever else is set.
 * - ENABLE_DEV_ROUTES must be "1" (off by default everywhere, development included);
 * - never on a Vercel production deployment (VERCEL_ENV "production"), even with ENABLE_DEV_ROUTES set;
 * - never in a production build outside Vercel (NODE_ENV "production" without VERCEL_ENV) unless
 *   ALLOW_TEST_SIGN_IN is also "1", for a CI server started with `next start`.
 * The route also only signs in `.test` addresses (TEST_EMAIL), so no real player's account can be reached.
 */
export function testSignInAllowed(env: Partial<Record<string, string>> = process.env): boolean {
  if (env.ENABLE_DEV_ROUTES !== "1") return false;
  if (env.VERCEL_ENV === "production") return false;
  if (env.NODE_ENV === "production" && !env.VERCEL_ENV && env.ALLOW_TEST_SIGN_IN !== "1") return false;
  return true;
}
