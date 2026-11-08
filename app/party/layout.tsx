import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/site";

/** Never in search results: Party rooms are private and short-lived. */
export const metadata: Metadata = { robots: NOINDEX };

export default function PartyLayout({ children }: LayoutProps<"/party">) {
  return children;
}
