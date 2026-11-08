import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/site";

/** Never in search results: invite links are personal. */
export const metadata: Metadata = { robots: NOINDEX };

export default function InviteLayout({ children }: LayoutProps<"/i">) {
  return children;
}
