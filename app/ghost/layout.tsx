import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/site";

/** Never in search results: Ghost Races are per player. */
export const metadata: Metadata = { robots: NOINDEX };

export default function GhostLayout({ children }: LayoutProps<"/ghost">) {
  return children;
}
