"use client";

import { Dialog } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatClock } from "@/lib/format";
import { useSettings } from "@/lib/settings/store";

/** G1 Pause: bottom sheet over a dimmed, blurred board. Board hidden while paused. */
export function PauseOverlay({ open, title, elapsed, onResume, onQuit, onHelp }: { open: boolean; title: string; elapsed: number; onResume: () => void; onQuit: () => void; onRestart?: () => void; onHelp?: () => void }) {
  const sfx = useSettings((s) => s.sfx);
  const relaxed = useSettings((s) => s.relaxed);
  const set = useSettings((s) => s.set);
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
                className="safe-bottom fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[560px] flex-col gap-3 rounded-t-[32px] bg-surface px-5 pt-3.5 pb-7"
                initial={{ transform: "translateY(100%)" }}
                animate={{ transform: "translateY(0%)" }}
                exit={{ transform: "translateY(100%)", transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }}
                transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="h-[5px] w-11 self-center rounded-[3px] bg-line" />
                <div className="flex items-center justify-between">
                  <Dialog.Title className="font-display text-[24px] font-black">Paused</Dialog.Title>
                  <span className="num text-[20px] font-semibold text-muted">{formatClock(elapsed)}</span>
                </div>
                <p id="pause-desc" className="text-[15px] text-muted">
                  Board hidden while paused. No peeking, Spuzler.
                </p>
                <Button size="lg" onClick={onResume} className="w-full text-[17px]" autoFocus>
                  Resume
                </Button>
                <Row icon="question" label="How to play" value="20 s" onClick={onHelp} />
                <Row icon={sfx ? "speaker-high" : "speaker-slash"} label="Sound" value={sfx ? "On" : "Off"} onClick={() => set("sfx", !sfx)} />
                <Row icon="timer" label="Relaxed mode" value={relaxed ? "On" : "Hides timer"} onClick={() => set("relaxed", !relaxed)} />
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

function Row({ icon, label, value, danger, onClick }: { icon: string; label: string; value: string; danger?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex h-[52px] items-center gap-3 rounded-[16px] bg-surface-raised px-4 text-left text-[16px] font-semibold" style={{ color: danger ? "var(--danger)" : undefined }}>
      <Icon name={icon} size={20} />
      <span className="flex-1">{label}</span>
      <span className="text-[14px] font-medium text-muted">{value}</span>
    </button>
  );
}
