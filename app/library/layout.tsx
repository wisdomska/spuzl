import { SeedQueries } from "@/components/shell/SeedQueries";

/** All games renders with the live durations, tags and lab switches from the first paint (R3: no hydration flash). */
export default function LibraryLayout({ children }: LayoutProps<"/library">) {
  return <SeedQueries>{children}</SeedQueries>;
}
