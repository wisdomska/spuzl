import { SeedQueries } from "@/components/shell/SeedQueries";
import { seoMeta } from "@/lib/copy/seo";
import { publicMetadata } from "@/lib/seo/site";

export const metadata = publicMetadata({ path: "/library", ...seoMeta.library });

/** All games renders with the live durations, tags and lab switches from the first paint (R3: no hydration flash). */
export default function LibraryLayout({ children }: LayoutProps<"/library">) {
  return <SeedQueries>{children}</SeedQueries>;
}
