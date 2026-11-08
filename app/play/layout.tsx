import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/site";

/** Never in search results: game screens need a session, and each game has a public page at /games/<id>. */
export const metadata: Metadata = { robots: NOINDEX };

export default function PlayLayout({ children }: LayoutProps<"/play">) {
  return children;
}
