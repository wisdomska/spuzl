import { BottomNav, DesktopRail } from "@/components/shell/BottomNav";
import { LowDataSuggest } from "@/components/shell/LowDataSuggest";
import { OpenSplash } from "@/components/shell/OpenSplash";
import { SeedQueries } from "@/components/shell/SeedQueries";

/**
 * Tabbed screens: bottom nav on phones, 88 px rail + content + 360 px side panel on desktop. Live game settings and
 * meta are seeded from the server (SeedQueries) so the first render matches the server's.
 */
export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <SeedQueries>
      <div className="min-h-dvh lg:pl-[88px]">
        <DesktopRail />
        {children}
        <BottomNav />
        <LowDataSuggest />
        <OpenSplash />
      </div>
    </SeedQueries>
  );
}
