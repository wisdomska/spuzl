import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/site";

/** Onboarding and sign-in steps, never a search result ("/" is the visitor landing page). */
export const metadata: Metadata = { title: "Get started", robots: NOINDEX };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
