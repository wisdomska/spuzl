import { BottomNav, DesktopRail } from "@/components/shell/BottomNav";

/** Tabbed screens: bottom nav on phones, 88 px rail + content + 360 px side panel on desktop. */
export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:pl-[88px]">
      <DesktopRail />
      {children}
      <BottomNav />
    </div>
  );
}
