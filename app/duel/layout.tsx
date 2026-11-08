import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/site";

/** Never in search results: Duels are per player. */
export const metadata: Metadata = { robots: NOINDEX };

export default function DuelLayout({ children }: LayoutProps<"/duel">) {
  return children;
}
