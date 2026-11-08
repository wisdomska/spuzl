import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/site";

/** Never in search results: board matches are private. */
export const metadata: Metadata = { robots: NOINDEX };

export default function BayLayout({ children }: LayoutProps<"/bay">) {
  return children;
}
