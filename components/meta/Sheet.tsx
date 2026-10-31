"use client";

import type { ReactNode } from "react";
import { Dialog } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";

/** Bottom sheet (r 32 top, handle, dimmed backdrop). Radix Dialog for focus trap, Escape and labelling. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-[rgb(6_7_13/.6)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="safe-bottom bg-surface fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[90dvh] max-w-[560px] flex-col gap-2.5 overflow-y-auto rounded-t-[32px] px-5 pt-3.5 pb-7"
                initial={{ transform: "translateY(100%)" }}
                animate={{ transform: "translateY(0%)" }}
                exit={{ transform: "translateY(100%)", transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }}
                transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                style={{ boxShadow: "0 -1px 0 var(--line)" }}
              >
                <div aria-hidden className="bg-line h-[5px] w-11 shrink-0 self-center rounded-[3px]" />
                <Dialog.Title className="font-display text-[18px] font-extrabold">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="text-muted text-[15px]">{description}</Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                )}
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
