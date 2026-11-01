"use client";

import { Dialog } from "radix-ui";
import { useId, useState, type ReactNode } from "react";
import { adminCopy } from "@/lib/copy/admin";
import { Btn, Notice, textareaCls, inputCls } from "./ui";

const C = adminCopy.players;

/**
 * Confirmation for an admin action: a required reason (kept in the audit log), optional extra fields, and for
 * irreversible actions a typed confirmation and a danger notice. The server checks all of it again; this dialog only
 * makes the action deliberate. Focus is trapped while open and returns to the trigger on close (Radix).
 */
export function ConfirmDialog({
  open,
  title,
  help,
  confirmLabel,
  danger = false,
  irreversible = false,
  typed,
  busy = false,
  error,
  ready = true,
  children,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  help?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  irreversible?: boolean;
  /** The text the admin must type to enable Confirm (any case), e.g. the nickname. */
  typed?: string;
  busy?: boolean;
  error?: string | null;
  /** Extra fields are valid (amounts, days). */
  ready?: boolean;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: (input: { reason: string; confirm: string }) => void;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const reasonOk = reason.trim().length >= 3;
  const typedOk = !typed || confirm.trim().toLowerCase() === typed.toLowerCase();
  const can = reasonOk && typedOk && ready && !busy;
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(6_7_13/.6)]" />
        <Dialog.Content
          className="bg-surface fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-[16px] p-5 shadow-[inset_0_0_0_1px_var(--line)]"
          onEscapeKeyDown={(e) => busy && e.preventDefault()}
        >
          <Dialog.Title className="font-display text-[18px] font-extrabold">{title}</Dialog.Title>
          <Dialog.Description className="text-muted text-[14px]">{help}</Dialog.Description>
          {irreversible && (
            <Notice tone="danger" icon="warning">
              {C.irreversible}
            </Notice>
          )}
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (can) onConfirm({ reason: reason.trim(), confirm: confirm.trim() });
            }}
          >
            {children}
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-reason`} className="num text-muted text-[12px] font-semibold">
                {C.reason}
              </label>
              <textarea
                id={`${id}-reason`}
                required
                minLength={3}
                maxLength={500}
                rows={3}
                value={reason}
                placeholder={C.reasonPlaceholder}
                onChange={(e) => setReason(e.target.value)}
                className={textareaCls}
              />
            </div>
            {typed && (
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-typed`} className="num text-muted text-[12px] font-semibold">
                  {C.typeNickname(typed)}
                </label>
                <input
                  id={`${id}-typed`}
                  autoComplete="off"
                  spellCheck={false}
                  value={confirm}
                  aria-invalid={confirm.length > 0 && !typedOk}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={`${inputCls} h-11`}
                />
              </div>
            )}
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="grid grid-cols-2 gap-2">
              <Btn size="lg" onClick={onCancel} disabled={busy}>
                {C.cancel}
              </Btn>
              <Btn type="submit" size="lg" tone={danger ? "danger" : "primary"} disabled={!can}>
                {busy ? C.working : confirmLabel}
              </Btn>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
