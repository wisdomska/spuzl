"use client";

import { installAttemptPriming } from "@/lib/client/early-attempt";
import { useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSettings, hapticsEnabled, prefersReducedMotion } from "@/lib/settings/store";
import { configure, unlock, play } from "@/lib/audio";
import { pressSound } from "@/lib/audio/press";
import { setHapticsEnabled } from "@/lib/haptics";
import { useNavTracker } from "@/lib/client/nav";
import { HapticFallback } from "./HapticFallback";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  const settings = useSettings();
  const { hydrate, hydrated } = settings;
  useNavTracker();
  useEffect(() => installAttemptPriming(), []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    configure({ sfx: settings.sfx, music: settings.music, haptics: settings.haptics, lowData: settings.lowData });
    setHapticsEnabled(hapticsEnabled(settings));
  }, [settings]);

  // Audio unlocks on the first gesture; every press makes its palette sound (lib/audio/press.ts):
  // buttons tap, switches toggle, tabs and nav items tick lower. Cells and custom controls play their own.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      unlock();
      if (e.button > 0) return;
      const fx = pressSound(e.target as Element | null);
      if (fx) play(fx.event, { step: fx.step });
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
