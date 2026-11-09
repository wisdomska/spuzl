import { SeedQueries } from "@/components/shell/SeedQueries";
import { MakerCredit } from "@/components/seo/MakerCredit";
import { seoMeta } from "@/lib/copy/seo";
import { publicMetadata } from "@/lib/seo/site";

export const metadata = publicMetadata({ path: "/library", ...seoMeta.library });

/** All games renders with the live durations, tags and lab switches from the first paint (R3: no hydration flash). */
export default function LibraryLayout({ children }: LayoutProps<"/library">) {
  return (
    <SeedQueries>
      {children}
      <footer className="mx-auto flex max-w-[560px] justify-center px-4 pb-10 lg:max-w-[1180px]">
        <MakerCredit />
      </footer>
    </SeedQueries>
  );
}
