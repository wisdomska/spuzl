import { notFound } from "next/navigation";

/** Test-only routes (/dev/*) exist for visual parity fixtures. Hidden in production unless explicitly enabled. */
export function devOnly() {
  if (process.env.VERCEL_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "1") notFound();
}
