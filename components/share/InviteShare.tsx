"use client";

import { useState, type CSSProperties } from "react";
import { Dialog } from "radix-ui";
import { Icon } from "@/components/ui/Icon";
import { INVITE_TARGETS, inviteHref, type InviteTarget } from "@/lib/share/targets";
import { shareCopy as T } from "@/lib/copy/share";
import { play } from "@/lib/audio";
import { useSheetSound } from "@/lib/audio/useSheetSound";

/**
 * A Share button that opens a sheet of apps (WhatsApp, Snapchat, Instagram, TikTok, Telegram, Facebook, X,
 * Messages, Email), the phone's own share menu where it has one, and Copy link.
 */
export function InviteShare({
  url,
  text,
  subject,
  title = T.title,
  className = "",
  style,
  iconSize = 16,
  disabled,
}: {
  url: string;
  text: string;
  subject?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  iconSize?: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const message = text.includes(url) ? text : `${text} ${url}`;
  const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const copy = async (then?: string) => {
    try {
      await navigator.clipboard.writeText(message);
      play("success");
      setNote(then ?? T.copied);
    } catch {
      setNote(null);
    }
  };
  const go = async (id: InviteTarget, label: string, pasteFirst?: boolean) => {
    if (pasteFirst) await copy(T.pasted(label));
    const href = inviteHref(id, url, message, subject);
    window.open(href, href.startsWith("http") ? "_blank" : "_self", "noopener,noreferrer");
  };
  useSheetSound(open);
  return (
    <>
      <button
        type="button"
        disabled={disabled || !url}
        onClick={() => {
          setNote(null);
          setOpen(true);
        }}
        className={className}
        style={style}
      >
        <Icon name="share-network" size={iconSize} />
        {T.share}
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[60] bg-[rgb(6_7_13/.6)]" />
          <Dialog.Content className="sheet-content safe-bottom bg-surface fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-w-[560px] flex-col gap-4 rounded-t-[28px] px-5 pt-3 pb-7">
            <div aria-hidden className="bg-line mx-auto h-1.5 w-10 rounded-full" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <Dialog.Title className="font-display text-[22px] font-black">{title}</Dialog.Title>
                <Dialog.Description className="text-muted text-[14px]">{T.description}</Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close"
                className="press bg-surface-raised flex size-11 shrink-0 items-center justify-center rounded-[14px]"
              >
                <Icon name="x" size={18} />
              </Dialog.Close>
            </div>
            <ul className="grid grid-cols-4 gap-x-2 gap-y-3 max-[359px]:grid-cols-3">
              {INVITE_TARGETS.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => go(t.id, t.label, t.pasteFirst)}
                    className="press flex w-full flex-col items-center gap-1.5 text-[12px] font-semibold"
                  >
                    <span className="bg-surface-raised text-text flex size-14 items-center justify-center rounded-[18px]">
                      <Icon name={t.icon} size={26} />
                    </span>
                    {t.label}
                  </button>
                </li>
              ))}
              {canNative && (
                <li>
                  <button
                    type="button"
                    onClick={() => navigator.share({ text: message, url }).catch(() => undefined)}
                    className="press flex w-full flex-col items-center gap-1.5 text-[12px] font-semibold"
                  >
                    <span className="bg-surface-raised flex size-14 items-center justify-center rounded-[18px]">
                      <Icon name="dots-three" size={26} />
                    </span>
                    {T.more}
                  </button>
                </li>
              )}
            </ul>
            <button
              type="button"
              onClick={() => copy()}
              className="press bg-surface-raised flex h-12 items-center gap-2.5 rounded-[16px] px-4 text-left"
            >
              <Icon name={note ? "check" : "link"} size={18} className="text-accent shrink-0" />
              <span className="num min-w-0 flex-1 truncate text-[14px] font-medium">{url}</span>
              <span className="shrink-0 text-[14px] font-semibold">{T.copyLink}</span>
            </button>
            <p role="status" className="text-accent min-h-5 text-center text-[14px] font-semibold">
              {note ?? ""}
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
