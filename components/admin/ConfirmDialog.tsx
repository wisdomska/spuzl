"use client";

import { Modal, ModalActions } from "@/components/ui/Modal";
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
    <Modal kind="dialog" open={open} onOpenChange={(o) => !o && onCancel()} dismissible={!busy} title={title} description={help}>
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
        <ModalActions>
          <Btn size="lg" onClick={onCancel} disabled={busy}>
            {C.cancel}
          </Btn>
          <Btn type="submit" size="lg" tone={danger ? "danger" : "primary"} disabled={!can}>
            {busy ? C.working : confirmLabel}
          </Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}
