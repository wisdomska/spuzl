"use client";

import { Dialog } from "radix-ui";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";
import { useSheetSound } from "@/lib/audio/useSheetSound";
import { uiCopy } from "@/lib/copy/ui";

/**
 * The one dialog frame for the player app and the admin (Radix Dialog underneath, so every one gets the same focus
 * trap, Escape, return of focus, labelling and no page scroll behind).
 *
 * - `kind="sheet"` (player app): a bottom sheet, r 28 top, a handle, up to 560 px wide, safe areas respected.
 * - `kind="dialog"` (admin): a centred card, r 16, p 5, 440 to 640 px wide.
 *
 * Both share the scrim (`--scrim` plus a light blur), the header (title, optional description, a 44 px close button
 * top right), the footer layout (`ModalActions`: the main action on the right) and the motion: a sheet slides up, a
 * dialog grows in; reduced motion (OS or in-app) is a short fade (globals.css `sheet-*` and `modal-*`).
 */
export type ModalKind = "sheet" | "dialog";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind?: ModalKind;
  /** "alertdialog" for a confirm that needs an answer */
  role?: "dialog" | "alertdialog";
  title: ReactNode;
  description?: ReactNode;
  /** the id of a description inside `children` (when it isn't the `description` prop) */
  describedBy?: string;
  /** keeps the title for screen readers but doesn't show it (a custom header in `children`) */
  hideTitle?: boolean;
  /** shown before the title (a game icon) */
  leading?: ReactNode;
  /** shown between the title and the close button (a clock, a toggle) */
  aside?: ReactNode;
  /** the 44 px close button top right (default on) */
  close?: boolean;
  /** Escape, a tap outside and the close button close it (default on; off while an action is running) */
  dismissible?: boolean;
  /** the soft "air" sound on open and close (default: sheets only) */
  sound?: boolean;
  zIndex?: number;
  /** a strong blur on the scrim, to hide what is behind (the pause sheet over a board) */
  hideBehind?: boolean;
  className?: string;
  style?: CSSProperties;
  /** space between the header and each block (default: sheet gap-4, dialog gap-3) */
  gap?: string;
  /** dialog width: sm 440, md 480, lg 640 */
  size?: "sm" | "md" | "lg";
  /** a test or styling hook on the content, e.g. `{ "data-leave-confirm": "" }` */
  dataAttrs?: Record<`data-${string}`, string>;
  footer?: ReactNode;
  children?: ReactNode;
  onOpenAutoFocus?: (e: Event) => void;
  onCloseAutoFocus?: (e: Event) => void;
}

const WIDTH = { sm: "max-w-[440px]", md: "max-w-[480px]", lg: "max-w-[640px]" } as const;

export const MODAL_SCRIM = "fixed inset-0 bg-scrim backdrop-blur-[2px]";

/** The frames, for a sheet that builds its own header inside Radix Dialog (the game card). */
export const MODAL_FRAME: Record<ModalKind, string> = {
  sheet:
    "sheet-content bg-surface fixed inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] w-full max-w-[560px] flex-col overflow-y-auto overscroll-contain rounded-t-[28px] pt-3 pr-[max(20px,env(safe-area-inset-right))] pb-[max(28px,env(safe-area-inset-bottom))] pl-[max(20px,env(safe-area-inset-left))] outline-none",
  dialog:
    "modal-content bg-surface fixed top-1/2 left-1/2 flex max-h-[calc(100dvh-32px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto overscroll-contain rounded-[16px] p-5 shadow-[inset_0_0_0_1px_var(--line),var(--shadow-float)] outline-none",
};

const TITLE: Record<ModalKind, string> = {
  sheet: "font-display text-[22px] leading-tight font-black [overflow-wrap:anywhere]",
  dialog: "font-display text-[18px] leading-tight font-extrabold [overflow-wrap:anywhere]",
};
const DESCRIPTION: Record<ModalKind, string> = {
  sheet: "text-muted text-[15px] leading-[1.4]",
  dialog: "text-muted text-[14px] leading-[1.45]",
};

export function Modal({
  open,
  onOpenChange,
  kind = "sheet",
  role,
  title,
  description,
  describedBy,
  hideTitle = false,
  leading,
  aside,
  close = true,
  dismissible = true,
  sound,
  zIndex = 50,
  hideBehind = false,
  className = "",
  style,
  size = "md",
  gap,
  dataAttrs,
  footer,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: ModalProps) {
  useSheetSound((sound ?? kind === "sheet") ? open : false);
  const block = (e: Event) => {
    if (!dismissible) e.preventDefault();
  };
  const header = !hideTitle || close || aside;
  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o || dismissible ? onOpenChange(o) : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-modal-scrim
          className={`sheet-overlay ${hideBehind ? "bg-scrim fixed inset-0 backdrop-blur-[10px]" : MODAL_SCRIM}`}
          style={{ zIndex }}
        />
        <Dialog.Content
          {...(role ? { role } : {})}
          {...(describedBy || !description ? { "aria-describedby": describedBy } : {})}
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
          tabIndex={-1}
          onOpenAutoFocus={
            onOpenAutoFocus ??
            ((e) => {
              // Nothing asked for focus (no autoFocus button): focus the dialog itself, so the first Tab reaches the
              // first control and a ring doesn't flash on the close button. Screen readers read the title.
              e.preventDefault();
              (e.target as HTMLElement | null)?.focus?.();
            })
          }
          onCloseAutoFocus={onCloseAutoFocus}
          className={`${MODAL_FRAME[kind]} ${gap ?? (kind === "sheet" ? "gap-4" : "gap-3")} ${kind === "dialog" ? WIDTH[size] : ""} ${className}`}
          style={{ zIndex, ...style }}
          {...dataAttrs}
        >
          {kind === "sheet" && <div aria-hidden className="bg-line mx-auto h-1.5 w-10 shrink-0 rounded-full" />}
          {header ? (
            <div className="flex items-start gap-3">
              {leading}
              <div className={`flex min-w-0 flex-1 flex-col gap-1 ${hideTitle ? "sr-only" : ""} ${close ? "pt-1.5" : ""}`}>
                <Dialog.Title className={TITLE[kind]}>{title}</Dialog.Title>
                {description ? <Dialog.Description className={DESCRIPTION[kind]}>{description}</Dialog.Description> : null}
              </div>
              {aside}
              {close && <ModalClose kind={kind} disabled={!dismissible} />}
            </div>
          ) : null}
          {children}
          {footer}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The 44 px close button (top right of every modal). */
export function ModalClose({ kind = "sheet", disabled, className = "" }: { kind?: ModalKind; disabled?: boolean; className?: string }) {
  return (
    <Dialog.Close
      aria-label={uiCopy.close}
      disabled={disabled}
      data-modal-close
      className={`flex size-11 shrink-0 items-center justify-center disabled:opacity-50 ${
        kind === "sheet"
          ? "press bg-surface-raised text-text rounded-[14px]"
          : "text-muted hover:bg-surface-raised hover:text-text -mt-2 -mr-2 rounded-[12px]"
      } ${className}`}
    >
      <Icon name="x" size={18} />
    </Dialog.Close>
  );
}

/**
 * The footer: two actions side by side, the cancel or "keep" one first (left) and the main one last (right).
 * `stack` puts them full width one above the other on phones (main on top), side by side from 640 px.
 */
export function ModalActions({ children, stack = false, className = "" }: { children: ReactNode; stack?: boolean; className?: string }) {
  return (
    <div
      data-modal-actions
      className={`${stack ? "flex flex-col-reverse gap-2.5 sm:grid sm:auto-cols-fr sm:grid-flow-col" : "grid auto-cols-fr grid-flow-col gap-2.5"} pt-1 ${className}`}
    >
      {children}
    </div>
  );
}
