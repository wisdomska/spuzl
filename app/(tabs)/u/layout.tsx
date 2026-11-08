import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/site";

/** Never in search results: player profiles are personal. */
export const metadata: Metadata = { robots: NOINDEX };

export default function ProfileLayout({ children }: LayoutProps<"/u">) {
  return children;
}
