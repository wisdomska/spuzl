"use client";

import { Dialog } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatClock } from "@/lib/format";
import { prefersReducedMotion, useSettings } from "@/lib/settings/store";
import { pauseCopy as P } from "@/lib/copy/pause";
import { copy } from "@/lib/copy";
import { useSheetSound } from "@/lib/audio/useSheetSound";

/**
 * G1 Pause: bottom sheet over a dimmed, blurred screen. The board itself is always covered while paused (R2-16:
 * GameShell puts an opaque cover over the board slot, so canvas and Phaser boards are hidden too, whatever the
 * browser does with backdrop blur). Reduced motion: no slide, a short fade only.
 */
export function PauseOverlay({
  open,
  title,
  elapsed,
  onResume,
  onQuit,
  onHelp,
}: {
  open: boolean;
  title: string;
  /** the time so far; null hides it (a practice round, or before the first move: R2-15) */
  elapsed: number | null;
  onResume: () => void;
  onQuit: () => void;
  onRestart?: () => void;
  onHelp?: () => void;
}) {
  const sfx = useSettings((s) => s.sfx);
  const relaxed = useSettings((s) => s.relaxed);
  const cb = useSettings((s) => s.cb);
  const textScale = useSettings((s) => s.textScale);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const haptics = useSettings((s) => s.haptics);
  const set = useSettings((s) => s.set);
  const osReduce = useReducedMotion();
  const appReduce = useSettings((s) => s.hydrated && prefersReducedMotion(s));
  const reduce = !!osReduce || appReduce;
  const T = copy.comfort;
  // Same store as /settings, so a change here is a change everywhere (and syncs to the account).
  const nextScale = ({ 100: 110, 110: 120, 120: 130, 130: 100 } as const)[textScale];
  useSheetSound(open);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onResume()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-[rgb(6_7_13/.6)] backdrop-blur-[10px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0.1 : 0.2, ease: [0.23, 1, 0.32, 1] }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby="pause-desc">
              <motion.div
                className="safe-bottom bg-surface fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] max-w-[560px] flex-col gap-3 overflow-y-auto rounded-t-[32px] px-5 pt-3.5 pb-7"
                initial={reduce ? false : { transform: "translateY(100%)" }}
                animate={{ transform: "translateY(0%)" }}
                exit={
                  reduce
                    ? { opacity: 0, transition: { duration: 0.1 } }
                    : { transform: "translateY(100%)", transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }
                }
                transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="bg-line h-[5px] w-11 self-center rounded-[3px]" />
                <div className="flex items-center justify-between">
                  <Dialog.Title className="font-display text-[24px] font-black">{P.title}</Dialog.Title>
                  {elapsed !== null && <span className="num text-muted text-[20px] font-semibold">{formatClock(elapsed)}</span>}
                </div>
                <p id="pause-desc" className="text-muted flex items-center gap-2 text-[15px]">
                  <Icon name="eye-slash" size={18} className="shrink-0" />
                  {P.hidden}
                </p>
                <Button size="lg" onClick={onResume} className="w-full text-[17px]" autoFocus>
                  {P.resume}
                </Button>
                <Row icon="question" label={P.howTo} value={P.howToValue} onClick={onHelp} />
                <p className="text-muted mt-1 text-[13px] font-semibold tracking-[0.04em] uppercase">{T.title}</p>
                <Row
                  icon="circles-three-plus"
                  label={T.patterns}
                  value={cb === "off" ? T.off : T.on}
                  pressed={cb !== "off"}
                  onClick={() => set("cb", cb === "off" ? "deutan" : "off")}
                />
                <Row icon="text-aa" label={T.textSize} value={`${textScale}%`} onClick={() => set("textScale", nextScale)} />
                <Row
                  icon="person-simple-walk"
                  label={T.reducedMotion}
                  value={reducedMotion === "on" ? T.on : reducedMotion === "off" ? T.off : T.system}
                  pressed={reducedMotion === "on"}
                  onClick={() => set("reducedMotion", reducedMotion === "on" ? "off" : "on")}
                />
                <Row
                  icon="timer"
                  label={T.hideTimer}
                  value={relaxed ? T.on : T.off}
                  pressed={relaxed}
                  onClick={() => set("relaxed", !relaxed)}
                />
                <Row
                  icon={sfx ? "speaker-high" : "speaker-slash"}
                  label={T.sound}
                  value={sfx ? T.on : T.off}
                  pressed={sfx}
                  onClick={() => set("sfx", !sfx)}
                />
                <Row
                  icon="vibrate"
                  label={T.haptics}
                  value={haptics ? T.on : T.off}
                  pressed={haptics}
                  onClick={() => set("haptics", !haptics)}
                />
                <Row icon="sign-out" label={P.quit} value={P.quitValue} danger onClick={onQuit} />
                <span className="sr-only">{title}</span>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function Row({
  icon,
  label,
  value,
  danger,
  pressed,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  danger?: boolean;
  /** toggle rows report their state to assistive tech */
  pressed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="press bg-surface-raised flex h-[52px] items-center gap-3 rounded-[16px] px-4 text-left text-[16px] font-semibold"
      style={{ color: danger ? "var(--danger)" : undefined }}
    >
      <Icon name={icon} size={20} />
      <span className="flex-1">{label}</span>
      <span className="text-muted text-[14px] font-medium">{value}</span>
    </button>
  );
}
