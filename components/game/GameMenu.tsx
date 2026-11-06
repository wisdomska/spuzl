"use client";

import type { RefObject } from "react";
import { DropdownMenu } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { prefersReducedMotion, useSettings } from "@/lib/settings/store";
import { gameMenuCopy as T } from "@/lib/copy/game-menu";

export type GameMenuEntry =
  | { kind: "action"; id: string; label: string; icon: string; onSelect: () => void; disabled?: boolean }
  | { kind: "toggle"; id: string; label: string; icon: string; checked: boolean; onChange: (on: boolean) => void }
  | {
      kind: "choice";
      id: string;
      label: string;
      icon: string;
      value: string;
      options: { id: string; label: string }[];
      onChange: (id: string) => void;
    };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const ITEM =
  "flex h-12 w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 text-left text-[16px] font-semibold outline-none select-none " +
  "data-[highlighted]:bg-[var(--surface-raised)] data-[disabled]:cursor-default data-[disabled]:opacity-45";

/**
 * The game shell's "⋯" menu: every option that is not needed while playing. Radix DropdownMenu gives the
 * menu semantics (arrow keys, typeahead, Escape, outside tap, focus kept inside and returned to the button).
 * It scales in from the button (160 ms, interruptible) or only fades with reduced motion. With `shield`,
 * a dimmed, blurred backdrop hides the board while the menu is open (the shell pauses the clock then, so
 * the board must not be studied for free).
 */
export function GameMenu({
  open,
  onOpenChange,
  sections,
  note,
  rule,
  shield,
  triggerRef,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** groups of entries, separated by a rule; empty groups are skipped */
  sections: GameMenuEntry[][];
  /** one line at the top: paused, or why the clock keeps running */
  note?: string;
  /** the game's one-line rule (R2-06): under the title until the first move, and always here */
  rule?: string;
  shield?: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  const osReduce = useReducedMotion();
  const appReduce = useSettings((s) => s.hydrated && prefersReducedMotion(s));
  const reduce = !!osReduce || appReduce;
  const groups = sections.filter((g) => g.length > 0);
  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger
        ref={triggerRef}
        aria-label={T.trigger}
        className="press bg-surface-raised text-text relative flex size-11 shrink-0 items-center justify-center rounded-[14px]"
      >
        <Icon name="dots-three" size={22} />
      </DropdownMenu.Trigger>
      <AnimatePresence>
        {open && (
          <DropdownMenu.Portal forceMount>
            <div data-game-menu>
              {shield && (
                <motion.div
                  aria-hidden
                  data-menu-shield
                  className="fixed inset-0 z-40 bg-[rgb(6_7_13/.55)] backdrop-blur-[10px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.16, ease: EASE_OUT }}
                />
              )}
              <DropdownMenu.Content asChild forceMount align="end" sideOffset={8} collisionPadding={12} onCloseAutoFocus={onCloseAutoFocus}>
                <motion.div
                  className="bg-surface text-text z-50 flex max-h-[var(--radix-dropdown-menu-content-available-height)] w-[min(288px,calc(100vw-24px))] flex-col overflow-y-auto overscroll-contain rounded-[20px] p-1.5"
                  style={{
                    transformOrigin: "var(--radix-dropdown-menu-content-transform-origin)",
                    boxShadow: "0 0 0 1px var(--line), var(--shadow-float)",
                  }}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.96)" }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "scale(1)" }}
                  exit={
                    reduce
                      ? { opacity: 0, transition: { duration: 0.1 } }
                      : { opacity: 0, transform: "scale(0.98)", transition: { duration: 0.12, ease: EASE_OUT } }
                  }
                  transition={{ duration: reduce ? 0.12 : 0.16, ease: EASE_OUT }}
                >
                  {note && (
                    <DropdownMenu.Label className="text-muted flex items-center gap-2 px-3 pt-1.5 pb-2 text-[13px] font-medium">
                      <Icon name="pause" size={14} className="shrink-0" />
                      {note}
                    </DropdownMenu.Label>
                  )}
                  {rule && (
                    <DropdownMenu.Label
                      className="bg-surface-raised mx-1 mb-1 flex gap-2 rounded-[14px] px-3 py-2 text-[14px] leading-5 font-medium"
                      data-menu-rule
                    >
                      <Icon name="info" size={16} className="text-muted mt-0.5 shrink-0" />
                      <span>
                        <span className="sr-only">{T.rule}: </span>
                        {rule}
                      </span>
                    </DropdownMenu.Label>
                  )}
                  {groups.map((g, i) => (
                    <DropdownMenu.Group key={i}>
                      {i > 0 && <DropdownMenu.Separator className="bg-line mx-2 my-1 h-px" />}
                      {g.map((e) => (
                        <Entry key={e.id} e={e} />
                      ))}
                    </DropdownMenu.Group>
                  ))}
                </motion.div>
              </DropdownMenu.Content>
            </div>
          </DropdownMenu.Portal>
        )}
      </AnimatePresence>
    </DropdownMenu.Root>
  );
}

function Entry({ e }: { e: GameMenuEntry }) {
  if (e.kind === "toggle")
    return (
      <DropdownMenu.CheckboxItem checked={e.checked} onCheckedChange={(v) => e.onChange(v === true)} className={ITEM} data-menu-item={e.id}>
        <Icon name={e.icon} size={20} className="shrink-0" />
        <span className="flex-1">{e.label}</span>
        <span className="text-muted text-[14px] font-medium" aria-hidden>
          {e.checked ? T.on : T.off}
        </span>
      </DropdownMenu.CheckboxItem>
    );
  if (e.kind === "choice") {
    const current = e.options.find((o) => o.id === e.value)?.label ?? "";
    return (
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger className={ITEM} data-menu-item={e.id}>
          <Icon name={e.icon} size={20} className="shrink-0" />
          <span className="flex-1">{e.label}</span>
          <span className="text-muted text-[14px] font-medium">{current}</span>
          <Icon name="caret-right" size={16} className="text-muted shrink-0" />
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent
            sideOffset={4}
            collisionPadding={12}
            className="bg-surface text-text z-50 flex w-[200px] flex-col rounded-[20px] p-1.5"
            style={{ boxShadow: "0 0 0 1px var(--line), var(--shadow-float)" }}
          >
            <DropdownMenu.RadioGroup value={e.value} onValueChange={e.onChange}>
              {e.options.map((o) => (
                <DropdownMenu.RadioItem key={o.id} value={o.id} className={ITEM}>
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    <DropdownMenu.ItemIndicator>
                      <Icon name="check" size={18} className="text-accent" />
                    </DropdownMenu.ItemIndicator>
                  </span>
                  <span className="flex-1">{o.label}</span>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    );
  }
  return (
    <DropdownMenu.Item disabled={e.disabled} onSelect={e.onSelect} className={ITEM} data-menu-item={e.id}>
      <Icon name={e.icon} size={20} className="shrink-0" />
      <span className="flex-1">{e.label}</span>
    </DropdownMenu.Item>
  );
}
