"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { viaKeys } from "@/components/game/useGridKeys";
import { useOnScreenKeys } from "@/components/game/useInputMode";
import { keyboardCopy as K } from "@/lib/copy/keyboard";

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
  /** short screens: ENTER takes the left key of the third row (no undo key, no fourth row) and keys are 44 px */
  compact?: boolean;
  /** what Enter does, for the typing keys shown instead of the keyboard on a computer ("submit") */
  enterDoes?: string;
}

/**
 * The SPUZL letter keyboard (Components: Letter keyboard). Three QWERTY rows with undo and backspace on
 * the third, then a world-colour ENTER. A pressed key pops a 1.3× preview above the finger. 48 px tall
 * keys; physical keys work too. `compact` saves a row: ENTER sits left on the third row, keys are 44 px.
 *
 * On a computer (a fine, hovering pointer: `useOnScreenKeys`) the keys give way to one line naming the
 * typing keys, with a "Show keyboard" button for touch laptops; the physical keys work either way.
 */
export function LetterKeyboard(props: LetterKeyboardProps) {
  const keys = useOnScreenKeys();
  const { physical, toggle } = keys;
  // A decorated keyboard (Five's seen letters) is information as well as input: it stays.
  const show = keys.show || !!props.decorate;
  usePhysicalKeys(props);
  if (!show) return <TypingKeys enterDoes={props.onEnter ? (props.enterDoes ?? K.submit) : undefined} onShow={toggle} />;
  return (
    <div className="flex w-full max-w-[400px] flex-col items-center gap-1.5">
      <OnScreenKeys {...props} />
      {physical && !props.decorate && (
        <button
          type="button"
          onClick={toggle}
          className="press text-muted flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-semibold"
        >
          <Icon name="keyboard" size={16} />
          {K.hide}
        </button>
      )}
    </div>
  );
}

/** Physical letters, Backspace and Enter, whether or not the on-screen keys show. */
function usePhysicalKeys({ onLetter, onBackspace, onEnter, disabled, listen = true }: LetterKeyboardProps) {
  useEffect(() => {
    if (!listen || disabled) return;
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // Physical keys count as keyboard entry (isKeyedInput): boards change the tile without the pop.
      if (/^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        viaKeys(() => onLetter(e.key.toUpperCase()));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        viaKeys(onBackspace);
      } else if (e.key === "Enter" && onEnter && !(t && t.getAttribute("role") === "gridcell")) {
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [listen, disabled, onLetter, onBackspace, onEnter]);
}

/** A key cap drawn in text, for the typing-keys line. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="bg-surface-raised inline-flex h-7 min-w-7 items-center justify-center rounded-[8px] px-2 text-[13px] font-bold"
      style={{ boxShadow: "0 2px 0 var(--depth)", fontFamily: "var(--font-ui)" }}
    >
      {children}
    </kbd>
  );
}

/**
 * The computer's stand-in for the on-screen keys: which keys to press, on one line, and a button that brings
 * the on-screen keys back (a touch laptop, or a player who prefers them).
 */
export function TypingKeys({ enterDoes, onShow, letters = true }: { enterDoes?: string; onShow?: () => void; letters?: boolean }) {
  return (
    <div
      className="flex w-full flex-col items-start gap-1 rounded-[16px] px-3.5 pt-2.5 pb-1"
      style={{ background: "var(--surface)" }}
      role="group"
      aria-label={K.typingGroup}
      data-typing-keys
    >
      <p className={`m-0 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[14px] font-medium ${onShow ? "" : "pb-1.5"}`}>
        {letters && (
          <span className="inline-flex items-center gap-1.5">
            <Kbd>A–Z</Kbd>
            {K.typeLetters}
          </span>
        )}
        {enterDoes && (
          <span className="inline-flex items-center gap-1.5">
            <Kbd>{K.enter}</Kbd>
            <span className="text-muted">{K.enterDoes(enterDoes)}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Kbd>
            <Icon name="backspace" size={16} label={K.backspace} />
          </Kbd>
          <span className="text-muted">{K.backspaceDoes}</span>
        </span>
      </p>
      {onShow && (
        <button
          type="button"
          onClick={onShow}
          className="press text-muted -ml-2 flex h-11 items-center gap-2 rounded-[12px] px-2 text-[14px] font-semibold"
        >
          <Icon name="keyboard" size={18} />
          {K.show}
        </button>
      )}
    </div>
  );
}

function OnScreenKeys({
  onLetter,
  onBackspace,
  onEnter,
  onUndo,
  undoLabel = "Undo",
  enterLabel = "ENTER",
  disabled,
  decorate,
  compact = false,
}: LetterKeyboardProps) {
  const [pressed, setPressed] = useState<string | null>(null);

  const key = (id: string, label: React.ReactNode, act: () => void, opts: { wide?: boolean; aria?: string; decor?: KeyDecor } = {}) => (
    <button
      key={id}
      type="button"
      disabled={disabled}
      aria-label={opts.aria ?? opts.decor?.say ?? id}
      // Backspace and undo take a letter back: the soft tap (lib/audio/press.ts).
      data-press={opts.wide ? "soft" : undefined}

      onPointerDown={() => setPressed(id)}
      onPointerUp={() => setPressed(null)}
      onPointerLeave={() => setPressed((p) => (p === id ? null : p))}
      onClick={act}
      className={`press relative flex ${compact ? "h-11" : "h-12"} items-center justify-center rounded-[10px] text-[17px] font-bold disabled:opacity-50`}
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
      className={`flex w-full max-w-[400px] flex-col gap-1.5 rounded-[20px] p-2.5 ${compact ? "short:p-2" : ""}`}
      style={{ background: "var(--board-bg)" }}
      role="group"
      aria-label={K.group}
    >
      {ROWS.map((row, ri) => (
        <div key={row} className="flex justify-center gap-1">
          {ri === 2 &&
            (compact && onEnter ? (
              <button
                key="enter"
                type="button"
                disabled={disabled}
                onClick={onEnter}
                className="toy flex h-11 items-center justify-center rounded-[10px] text-[12px] font-bold"
                style={{
                  flex: "1.75 1 0",
                  maxWidth: 64,
                  minWidth: 0,
                  background: "var(--world)",
                  color: "#0E0F1A",
                  ["--btn-depth" as string]: "var(--world-depth)",
                  boxShadow: "0 3px 0 var(--world-depth)",
                }}
              >
                {enterLabel}
              </button>
            ) : onUndo ? (
              key("undo", <Icon name="arrow-u-up-left" size={20} />, onUndo, { wide: true, aria: undoLabel })
            ) : (
              <span style={{ flex: "1.45 1 0", maxWidth: 46 }} />
            ))}
          {[...row].map((ch) => key(ch, ch, () => onLetter(ch), { decor: decorate?.(ch) }))}
          {ri === 2 && key("backspace", <Icon name="backspace" size={20} />, onBackspace, { wide: true, aria: "Backspace" })}
        </div>
      ))}
      {onEnter && !compact && (
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
