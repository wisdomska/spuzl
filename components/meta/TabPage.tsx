"use client";

import { useEffect, type ReactNode } from "react";
import { SidePanel } from "@/components/home/SidePanel";
import { useMe } from "@/lib/client/api";
import { usePresence } from "@/lib/client/social";
import { SETTINGS_KEY, defaultSettings, useSettings, type Settings } from "@/lib/settings/store";

/**
 * Tabbed screen frame: phone column (390 first, 16 px gutters, room for the 80 px bottom nav) and, on
 * desktop, content + the 360 px right panel next to the 88 px rail. Sends the presence heartbeat.
 */
export function TabPage({ children, label, wide, panel = true }: { children: ReactNode; label: string; wide?: boolean; panel?: boolean }) {
  const me = useMe();
  usePresence(!!me.data);
  // A new device with no local settings takes the account's copy (Settings saves both).
  const remote = me.data?.settings;
  useEffect(() => {
    if (!remote || !Object.keys(remote).length) return;
    try {
      if (localStorage.getItem(SETTINGS_KEY)) return;
    } catch {
      return;
    }
    const known = Object.fromEntries(Object.entries(remote).filter(([k]) => k in defaultSettings)) as Partial<Settings>;
    if (Object.keys(known).length) useSettings.getState().replace(known);
  }, [remote]);
  return (
    <div className={panel ? "lg:grid lg:grid-cols-[1fr_360px]" : ""}>
      <main aria-label={label} className="safe-top min-h-dvh px-4 pt-14 pb-[112px] lg:pt-10 lg:pb-12">
        <div className={`mx-auto flex w-full flex-col gap-3 ${wide ? "max-w-[880px]" : "max-w-[560px]"}`}>{children}</div>
      </main>
      {panel && <SidePanel />}
    </div>
  );
}
