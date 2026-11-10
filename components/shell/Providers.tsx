"use client";

import { installAttemptPriming, setPrimeGate } from "@/lib/client/early-attempt";
import { allLearned, learnedGames, shouldPrime } from "@/lib/guided";
import { hasLogic } from "@/games/logic-ids";
import type { Me } from "@/lib/client/api";
import type { GameSettings } from "@/lib/game-settings/schema";
import { MusicDirector } from "./MusicDirector";
import { useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSettings, hapticsEnabled, musicEnabled, prefersReducedMotion } from "@/lib/settings/store";
import { configure, unlock, play } from "@/lib/audio";
import { pressSound } from "@/lib/audio/press";
import { setHapticsEnabled } from "@/lib/haptics";
import { useNavTracker } from "@/lib/client/nav";
import { HapticFallback } from "./HapticFallback";
import { Inbox } from "./Inbox";
import { TapSkeleton } from "./TapSkeleton";
import { ShieldThanks } from "@/components/meta/ShieldThanks";
import { PromptHost } from "./PromptQueue";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  const settings = useSettings();
  const { hydrate, hydrated } = settings;
  useNavTracker();
  useEffect(() => {
    // R2-07: no early attempt for a game whose practice round comes first (the account and settings from the cache).
    setPrimeGate((game) => {
      const me = client.getQueryData<Me | null>(["me"]);
      return shouldPrime({
        id: game,
        played: me?.played,
        learned: allLearned(learnedGames(), me?.learned),
        available: hasLogic(game),
        disabled: client.getQueryData<GameSettings>(["game-settings"])?.["practice.disabled"],
      });
    });
    const off = installAttemptPriming();
    return () => {
      off();
      setPrimeGate(null);
    };
  }, [client]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    configure({
      sfx: settings.sfx,
      music: musicEnabled(settings),
      haptics: settings.haptics,
      lowData: settings.lowData,
      mixOthers: settings.mixOthers,
    });
    setHapticsEnabled(hapticsEnabled(settings));
  }, [settings]);

  // Audio unlocks on the first gesture; every press makes its palette sound (lib/audio/press.ts):
  // buttons tap, switches toggle, tabs and nav items tick lower. Cells and custom controls play their own.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      unlock();
      if (e.button > 0) return;
      const fx = pressSound(e.target as Element | null);
      if (fx) play(fx.event, { step: fx.step, gain: fx.gain });
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
        <MusicDirector />
        <PromptHost />
        <Inbox />
        <TapSkeleton />
        <ShieldThanks />
      </MotionConfig>
    </QueryClientProvider>
  );
}
