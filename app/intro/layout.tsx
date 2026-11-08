import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/site";

/** The logo intro is a first-run step, never a search result ("/" is the visitor landing page). */
export const metadata: Metadata = { title: "Welcome", robots: NOINDEX };

export default function IntroLayout({ children }: LayoutProps<"/intro">) {
  return children;
}
