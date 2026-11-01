"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { track } from "@/lib/analytics/track";
import { useSettings } from "@/lib/settings/store";
import { smallCardSrc } from "@/lib/lowdata/images";
import { useSheetSound } from "@/lib/audio/useSheetSound";

/**
 * Share sheet (FR-RS-03, FR-RS-04). Styled after the Components "Invite sheet".
 *
 *   <ShareSheet
 *     open={open} onOpenChange={setOpen}
 *     kind="daily" text={dailyShareText(...)}
 *     image={cardUrl("daily", attemptId, { small: lowData })}
 *   />
 *
 * - "Share" uses the native sheet with the card image as a file where the browser supports it
 *   (navigator.canShare({ files })), else text only.
 * - WhatsApp and X open their share intents with the spoiler-free text.
 * - Instagram and TikTok have no web intent: with file sharing they open the native sheet with the
 *   image; otherwise the image downloads and the text is copied, and the sheet says so.
 * - Copy puts the text on the clipboard; Save downloads the PNG (the fallback everywhere).
 * - Low-data mode fetches the half-size card.
 */
export type ShareTarget = "native" | "whatsapp" | "x" | "instagram" | "tiktok" | "copy" | "save";

export interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** spoiler-free share text from lib/share/text.ts */
  text: string;
  /** card image URL from lib/share/urls.ts (cardUrl) */
  image: string;
  /** analytics label: daily | full | duel | party */
  kind?: string;
  title?: string;
  fileName?: string;
  onShared?: (target: ShareTarget) => void;
  /** preview thumbnail size and alt text; defaults to the 9:16 story card */
  preview?: { width: number; height: number; alt?: string };
}

type Nav = Navigator & { canShare?: (data: ShareData) => boolean };

async function fetchFile(url: string, name: string): Promise<File | null> {
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || "image/png" });
  } catch {
    return null;
  }
}

function download(file: File | null, url: string, name: string) {
  const a = document.createElement("a");
  const href = file ? URL.createObjectURL(file) : url;
  a.href = href;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (file) window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older WebViews: hidden textarea + execCommand.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const TARGETS: { id: Exclude<ShareTarget, "native">; label: string; icon: string; primary?: boolean }[] = [
  { id: "whatsapp", label: "WhatsApp", icon: "whatsapp-logo", primary: true },
  { id: "x", label: "X", icon: "x-logo" },
  { id: "instagram", label: "Instagram", icon: "instagram-logo" },
  { id: "tiktok", label: "TikTok", icon: "tiktok-logo" },
  { id: "copy", label: "Copy", icon: "copy" },
  { id: "save", label: "Save", icon: "download-simple" },
];

export function ShareSheet({
  open,
  onOpenChange,
  text,
  image: imageProp,
  kind = "daily",
  title = "Share it",
  fileName = "spuzl.png",
  onShared,
  preview = { width: 108, height: 192 },
}: ShareSheetProps) {
  const reduce = useReducedMotion();
  const lowData = useSettings((s) => s.lowData);
  const image = smallCardSrc(imageProp, lowData);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [canNative, setCanNative] = useState(false);
  const [canFiles, setCanFiles] = useState(false);
  const statusTimer = useRef<number | undefined>(undefined);

  // Prepare the image file as soon as the sheet opens, so the native share runs inside the tap.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void fetchFile(image, fileName).then((f) => {
      if (!alive) return;
      setFile(f);
      const nav = navigator as Nav;
      setCanNative(typeof nav.share === "function");
      setCanFiles(!!f && typeof nav.canShare === "function" && nav.canShare({ files: [f] }));
    });
    return () => {
      alive = false;
    };
  }, [open, image, fileName]);

  const say = useCallback((msg: string) => {
    setStatus(msg);
    window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(""), 3500);
  }, []);
  useEffect(() => () => window.clearTimeout(statusTimer.current), []);

  const done = useCallback(
    (target: ShareTarget) => {
      track("share", { target, kind, lowData });
      onShared?.(target);
    },
    [kind, lowData, onShared],
  );

  const nativeShare = useCallback(
    async (withFile: boolean): Promise<boolean> => {
      const nav = navigator as Nav;
      if (typeof nav.share !== "function") return false;
      try {
        await nav.share(withFile && file && canFiles ? { files: [file], text } : { text });
        return true;
      } catch (e) {
        // AbortError = the player closed the sheet: not a failure, nothing else to do.
        return (e as DOMException)?.name === "AbortError";
      }
    },
    [file, canFiles, text],
  );

  const run = useCallback(
    async (target: ShareTarget) => {
      const enc = encodeURIComponent(text);
      switch (target) {
        case "native":
          if (await nativeShare(true)) done(target);
          else {
            download(file, image, fileName);
            say("Image saved. Share it from your gallery.");
            done("save");
          }
          return;
        case "whatsapp":
          window.open(`https://wa.me/?text=${enc}`, "_blank", "noopener,noreferrer");
          done(target);
          return;
        case "x":
          window.open(`https://x.com/intent/post?text=${enc}`, "_blank", "noopener,noreferrer");
          done(target);
          return;
        case "instagram":
        case "tiktok": {
          const app = target === "instagram" ? "Instagram" : "TikTok";
          if (canFiles && (await nativeShare(true))) {
            done(target);
            return;
          }
          download(file, image, fileName);
          const copied = await copyText(text);
          say(copied ? `Image saved and text copied. Post it from ${app}.` : `Image saved. Post it from ${app}.`);
          done(target);
          return;
        }
        case "copy":
          say((await copyText(text)) ? "Copied." : "Couldn't copy. Long-press the text instead.");
          done(target);
          return;
        case "save":
          download(file, image, fileName);
          say("Image saved.");
          done(target);
          return;
      }
    },
    [text, nativeShare, done, file, image, fileName, say, canFiles],
  );

  useSheetSound(open);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 bg-[rgb(6_7_13/.6)]"
                style={{ zIndex: "var(--z-sheet)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby="share-desc">
              <motion.div
                data-testid="share-sheet"
                className="safe-bottom bg-surface-raised fixed inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] max-w-[560px] flex-col gap-3 overflow-y-auto rounded-t-[24px] px-4 pt-3.5 pb-6"
                style={{ zIndex: "var(--z-sheet)" }}
                initial={reduce ? { opacity: 0 } : { transform: "translateY(100%)" }}
                animate={reduce ? { opacity: 1 } : { transform: "translateY(0%)" }}
                exit={
                  reduce
                    ? { opacity: 0, transition: { duration: 0.15 } }
                    : { transform: "translateY(100%)", transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }
                }
                transition={{ duration: reduce ? 0.2 : 0.32, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="bg-line h-[5px] w-11 self-center rounded-[3px]" />
                <Dialog.Title className="font-display text-[17px] font-extrabold">{title}</Dialog.Title>
                <p id="share-desc" className="sr-only">
                  Share your result. No solution is ever included.
                </p>
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG, already sized */}
                  <img
                    src={image}
                    alt={preview.alt ?? "Your share card"}
                    width={preview.width}
                    height={preview.height}
                    style={{ width: preview.width, height: preview.height }}
                    className="bg-bg shrink-0 rounded-[12px] object-cover"
                  />
                  <pre
                    aria-label="Share text"
                    className="bg-bg text-text m-0 min-w-0 flex-1 overflow-x-auto rounded-[14px] p-3 font-mono text-[13px] leading-[1.45] whitespace-pre-wrap shadow-[inset_0_0_0_1px_var(--line)]"
                  >
                    {text}
                  </pre>
                </div>
                {canNative && (
                  <Button size="lg" icon="share-fat" className="w-full text-[17px]" onClick={() => void run("native")}>
                    Share
                  </Button>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {TARGETS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => void run(t.id)}
                      className="press flex min-h-11 flex-col items-center gap-1.5 rounded-[16px] py-1"
                      data-share-target={t.id}
                    >
                      <span
                        className={`flex size-[52px] items-center justify-center rounded-[16px] ${t.primary ? "bg-accent text-on-accent" : "bg-bg text-text shadow-[inset_0_0_0_1px_var(--line)]"}`}
                      >
                        <Icon name={t.icon} size={24} />
                      </span>
                      <span className="text-[12px] font-semibold">{t.label}</span>
                    </button>
                  ))}
                </div>
                <p role="status" aria-live="polite" className="text-muted min-h-5 text-center text-[14px]">
                  {status}
                </p>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
