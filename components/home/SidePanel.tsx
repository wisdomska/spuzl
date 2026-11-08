"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useMe } from "@/lib/client/api";
import { useAcceptInvite } from "@/lib/client/social";
import { takePendingInvite } from "@/lib/client/invite";
import { Skeleton } from "@/components/ui/Skeleton";

/** The panel's placeholder: before a wide screen is confirmed, while its chunk loads, and until the profile is in. */
export function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-14 rounded-[16px]" />
      <Skeleton className="h-[52px] rounded-[14px]" />
      <Skeleton className="h-16 rounded-[20px]" />
    </div>
  );
}

const SidePanelBody = dynamic(() => import("./SidePanelBody").then((m) => m.SidePanelBody), {
  ssr: false,
  loading: () => <PanelSkeleton />,
});

/**
 * Desktop right panel, 360 px, on Home and every tabbed screen (hidden below 1024 px). R3-03: on a phone only the
 * hidden shell renders: the panel's content (`SidePanelBody`, with its friends and levels requests) is its own chunk,
 * downloaded and hydrated only once a wide screen is confirmed.
 */
export function SidePanel() {
  const me = useMe();
  const wide = useWide();
  // An invite opened before onboarding is accepted as soon as the new player has a profile (every screen size).
  const accept = useAcceptInvite();
  const hasMe = !!me.data;
  useEffect(() => {
    if (!hasMe) return;
    const code = takePendingInvite();
    if (code) accept.mutate(code);
  }, [hasMe]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside
      aria-label="Today"
      className="border-line bg-surface sticky top-0 hidden h-dvh flex-col gap-4 overflow-y-auto border-l p-6 lg:flex"
    >
      {wide ? <SidePanelBody /> : <PanelSkeleton />}
    </aside>
  );
}

/** The panel's breakpoint (Tailwind `lg`), read after hydration; false on the server and on phones. */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}
