import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/site";

/** Never in search results: friend challenges are one-off links (their link previews still work). */
export const metadata: Metadata = { robots: NOINDEX };

export default function ChallengeLayout({ children }: LayoutProps<"/challenge">) {
  return children;
}
