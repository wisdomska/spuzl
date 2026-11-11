"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";

/**
 * Bottom sheet for the social and meta screens: the shared Modal frame (components/ui/Modal.tsx) with its handle,
 * scrim, title, 44 px close button, focus trap, Escape and sound. Reduced motion (OS or in-app) is a short fade.
 */
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
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description} zIndex={40} gap="gap-3">
      {children}
    </Modal>
  );
}
