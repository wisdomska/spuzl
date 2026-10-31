"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSettings, hapticsEnabled, prefersReducedMotion } from "@/lib/settings/store";
import { configure, unlock, play } from "@/lib/audio";
import { setHapticsEnabled } from "@/lib/haptics";
import { HapticFallback } from "./HapticFallback";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  const settings = useSettings();
  const { hydrate, hydrated } = settings;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    configure({ sfx: settings.sfx, music: settings.music, haptics: settings.haptics, lowData: settings.lowData });
    setHapticsEnabled(hapticsEnabled(settings));
  }, [settings]);

  // Audio unlocks on the first gesture; every toy button ticks (cells and custom controls play their own sound).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      unlock();
      const el = e.target as HTMLElement | null;
      const btn = el?.closest?.("button, [data-tick]");
      if (btn && !btn.closest("[role=gridcell], [data-no-tick]") && !(btn as HTMLButtonElement).disabled) play("tick");
    };
    const onKey = () => unlock();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, { once: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const reduce = hydrated && prefersReducedMotion(settings);

  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion={reduce ? "always" : "never"}>
        {children}
        <HapticFallback />
      </MotionConfig>
    </QueryClientProvider>
  );
}
