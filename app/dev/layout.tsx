import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo/site";

/** Never in search results: developer fixtures. */
export const metadata: Metadata = { robots: NOINDEX };

export default function DevLayout({ children }: LayoutProps<"/dev">) {
  return children;
}
