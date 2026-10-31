"use client";

import { Dialog } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatClock } from "@/lib/format";
import { useSettings } from "@/lib/settings/store";
import { copy } from "@/lib/copy";

/** G1 Pause: bottom sheet over a dimmed, blurred board. Board hidden while paused. */
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
  elapsed: number;
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
  const T = copy.comfort;
  // Same store as /settings, so a change here is a change everywhere (and syncs to the account).
  const nextScale = ({ 100: 110, 110: 120, 120: 130, 130: 100 } as const)[textScale];
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
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby="pause-desc">
              <motion.div
                className="safe-bottom bg-surface fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] max-w-[560px] flex-col gap-3 overflow-y-auto rounded-t-[32px] px-5 pt-3.5 pb-7"
                initial={{ transform: "translateY(100%)" }}
                animate={{ transform: "translateY(0%)" }}
                exit={{ transform: "translateY(100%)", transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }}
                transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="bg-line h-[5px] w-11 self-center rounded-[3px]" />
                <div className="flex items-center justify-between">
                  <Dialog.Title className="font-display text-[24px] font-black">Paused</Dialog.Title>
                  <span className="num text-muted text-[20px] font-semibold">{formatClock(elapsed)}</span>
                </div>
                <p id="pause-desc" className="text-muted text-[15px]">
                  Board hidden while paused. No peeking, Spuzler.
                </p>
                <Button size="lg" onClick={onResume} className="w-full text-[17px]" autoFocus>
                  Resume
                </Button>
                <Row icon="question" label="How to play" value="20 s" onClick={onHelp} />
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
                <Row icon="sign-out" label="Quit puzzle" value="Progress saved" danger onClick={onQuit} />
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
