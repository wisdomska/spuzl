"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

/** Optional per-letter look (Five marks keys it has seen). Never colour alone: pass a badge and a spoken name. */
export interface KeyDecor {
  background: string;
  color: string;
  /** small corner mark, e.g. a check or a dot */
  badge?: React.ReactNode;
  /** spoken name, e.g. "A, right spot" */
  say?: string;
}

export interface LetterKeyboardProps {
  onLetter(letter: string): void;
  onBackspace(): void;
  onEnter?(): void;
  /** left key on the third row (design: arrow-u-up-left). Omit to hide it. */
  onUndo?(): void;
  undoLabel?: string;
  enterLabel?: string;
  disabled?: boolean;
  /** also listen to the physical keyboard (letters, Backspace, Enter) */
  listen?: boolean;
  /** per-letter colour, corner badge and spoken name */
  decorate?: (letter: string) => KeyDecor | undefined;
}

/**
 * The SPUZL letter keyboard (Components: Letter keyboard). Three QWERTY rows with undo and backspace on
 * the third, then a world-colour ENTER. A pressed key pops a 1.3× preview above the finger. 48 px tall
 * keys; physical keys work too.
 */
export function LetterKeyboard({
  onLetter,
  onBackspace,
  onEnter,
  onUndo,
  undoLabel = "Undo",
  enterLabel = "ENTER",
  disabled,
  listen = true,
  decorate,
}: LetterKeyboardProps) {
  const [pressed, setPressed] = useState<string | null>(null);

  useEffect(() => {
    if (!listen || disabled) return;
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (/^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        onLetter(e.key.toUpperCase());
      } else if (e.key === "Backspace") {
        e.preventDefault();
        onBackspace();
      } else if (e.key === "Enter" && onEnter && !(t && t.getAttribute("role") === "gridcell")) {
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [listen, disabled, onLetter, onBackspace, onEnter]);

  const key = (id: string, label: React.ReactNode, act: () => void, opts: { wide?: boolean; aria?: string; decor?: KeyDecor } = {}) => (
    <button
      key={id}
      type="button"
      disabled={disabled}
      aria-label={opts.aria ?? opts.decor?.say ?? id}
      onPointerDown={() => setPressed(id)}
      onPointerUp={() => setPressed(null)}
      onPointerLeave={() => setPressed((p) => (p === id ? null : p))}
      onClick={act}
      className="press relative flex h-12 items-center justify-center rounded-[10px] text-[17px] font-bold disabled:opacity-50"
      style={{
        flex: opts.wide ? "1.45 1 0" : "1 1 0",
        maxWidth: opts.wide ? 46 : 34,
        minWidth: 0,
        background: opts.wide ? "var(--line)" : pressed === id ? "var(--text)" : (opts.decor?.background ?? "var(--surface-raised)"),
        color: pressed === id && !opts.wide ? "var(--bg)" : (opts.decor?.color ?? "var(--text)"),
        boxShadow: "0 3px 0 var(--depth)",
      }}
    >
      {label}
      {opts.decor?.badge && (
        <span aria-hidden className="pointer-events-none absolute top-0.5 right-0.5 flex leading-none">
          {opts.decor.badge}
        </span>
      )}
      {pressed === id && !opts.wide && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-12 left-1/2 flex h-11 w-10 items-center justify-center rounded-[10px] text-[22px] font-bold"
          style={{
            background: "var(--text)",
            color: "var(--bg)",
            transform: "translateX(-50%) scale(1.3)",
            transformOrigin: "bottom center",
            boxShadow: "var(--shadow-float)",
          }}
        >
          {label}
        </span>
      )}
    </button>
  );

  return (
    <div
      className="flex w-full max-w-[400px] flex-col gap-1.5 rounded-[20px] p-2.5"
      style={{ background: "var(--board-bg)" }}
      role="group"
      aria-label="Letter keyboard"
    >
      {ROWS.map((row, ri) => (
        <div key={row} className="flex justify-center gap-1">
          {ri === 2 &&
            (onUndo ? (
              key("undo", <Icon name="arrow-u-up-left" size={20} />, onUndo, { wide: true, aria: undoLabel })
            ) : (
              <span style={{ flex: "1.45 1 0", maxWidth: 46 }} />
            ))}
          {[...row].map((ch) => key(ch, ch, () => onLetter(ch), { decor: decorate?.(ch) }))}
          {ri === 2 && key("backspace", <Icon name="backspace" size={20} />, onBackspace, { wide: true, aria: "Backspace" })}
        </div>
      ))}
      {onEnter && (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={disabled}
            onClick={onEnter}
            className="toy h-12 w-40 rounded-[10px] text-[17px] font-bold"
            style={{
              background: "var(--world)",
              color: "#0E0F1A",
              ["--btn-depth" as string]: "var(--world-depth)",
              boxShadow: "0 3px 0 var(--world-depth)",
            }}
          >
            {enterLabel}
          </button>
        </div>
      )}
    </div>
  );
}
