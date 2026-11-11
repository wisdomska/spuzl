"use client";

import { Select as RS } from "radix-ui";
import { Fragment, type ReactNode } from "react";
import { Icon } from "./Icon";
import { uiCopy } from "@/lib/copy/ui";

/**
 * The app's dropdown, in place of the browser's own <select> list (Radix Select underneath).
 *
 * - The trigger looks like the app's fields (admin: `inputCls`; player app: `tone="app"` 48 px r 14, or `tone="chip"`
 *   for a filter beside other chips) with a caret that turns while the list is open.
 * - The open list is the app's surface: r 14, a 1 px line and a soft shadow, a lime check beside the chosen option,
 *   the highlighted row on surface-raised. It scrolls inside itself when long and never runs off the screen.
 * - Keyboard: Space, Enter or the arrows open it; arrows move; Home and End jump; typing a few letters jumps to the
 *   first match (typeahead); Enter picks; Escape closes without changing. Focus returns to the trigger.
 * - Touch: rows are 44 px tall on a coarse pointer (40 px with a mouse).
 * - Labelling: give it an `id` and point a `<label htmlFor>` at it (the trigger is a button, so the label names
 *   it), or pass `aria-label` / `aria-labelledby`; `aria-describedby` for help text.
 * - Values are plain strings, "" included ("All"): Radix can't hold an empty value, so it's mapped in and out here.
 * - `name` adds a hidden input carrying the value, for a form that posts.
 */
export interface SelectOption {
  value: string;
  label: ReactNode;
  /** the text typeahead matches (defaults to the label when it is a string) */
  textValue?: string;
  disabled?: boolean;
}
export interface SelectGroup {
  label: string;
  options: SelectOption[];
}
export type SelectItems = readonly (SelectOption | SelectGroup)[];

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectItems;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  /** a tooltip on the trigger (why it is disabled) */
  title?: string;
  /** shown in the trigger while the value matches no option */
  placeholder?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** extra classes on the trigger: width and height (e.g. "h-11 w-44") */
  className?: string;
  /** "admin" (default): the admin's 40 px field; "app": the player app's 48 px form field; "chip": a 44 px filter chip */
  tone?: Tone;
  /** open-state control, for tests and rare callers */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Radix Select can't hold "" as a value: "All" and "Any" filters use it, so it travels under this stand-in. */
const EMPTY = "\u0000empty";
const toInner = (v: string) => (v === "" ? EMPTY : v);
const toOuter = (v: string) => (v === EMPTY ? "" : v);

const isGroup = (o: SelectOption | SelectGroup): o is SelectGroup => "options" in o;

export function flatOptions(items: SelectItems): SelectOption[] {
  return items.flatMap((o) => (isGroup(o) ? o.options : [o]));
}

type Tone = "admin" | "app" | "chip";
const TRIGGER: Record<Tone, string> = {
  admin:
    "bg-bg h-10 rounded-[10px] pr-2.5 pl-3 text-[14px] shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--text-muted)] focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] data-[state=open]:shadow-[inset_0_0_0_2px_var(--accent)]",
  app: "bg-surface-raised h-12 rounded-[14px] pr-3 pl-3.5 text-[16px] focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] data-[state=open]:shadow-[inset_0_0_0_2px_var(--accent)]",
  chip: "press bg-surface h-11 rounded-[14px] pr-3 pl-3 text-[15px] font-semibold focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] data-[state=open]:shadow-[inset_0_0_0_2px_var(--accent)]",
};

export function Select({
  value,
  onValueChange,
  options,
  id,
  name,
  disabled,
  required,
  title,
  placeholder = uiCopy.select.placeholder,
  className = "",
  tone = "admin",
  open,
  onOpenChange,
  ...aria
}: SelectProps) {
  const flat = flatOptions(options);
  const known = flat.some((o) => o.value === value);
  return (
    <RS.Root
      value={known ? toInner(value) : undefined}
      onValueChange={(v) => onValueChange(toOuter(v))}
      disabled={disabled}
      required={required}
      open={open}
      onOpenChange={onOpenChange}
    >
      <RS.Trigger
        id={id}
        title={title}
        aria-label={aria["aria-label"]}
        aria-labelledby={aria["aria-labelledby"]}
        aria-describedby={aria["aria-describedby"]}
        aria-invalid={aria["aria-invalid"] || undefined}
        data-select
        className={`group text-text inline-flex min-w-0 items-center justify-between gap-2 text-left outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:shadow-[inset_0_0_0_2px_var(--danger)] ${TRIGGER[tone]} ${className}`}
      >
        <span className="data-[placeholder]:text-muted min-w-0 flex-1 truncate">
          <RS.Value placeholder={<span className="text-muted">{placeholder}</span>} />
        </span>
        <RS.Icon className="text-muted flex shrink-0 transition-transform duration-150 group-data-[state=open]:rotate-180 motion-reduce:transition-none">
          <Icon name="caret-down" size={tone === "admin" ? 16 : 18} />
        </RS.Icon>
      </RS.Trigger>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          data-select-list
          className="pop-content bg-surface text-text shadow-pop relative z-[90] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[max(var(--radix-select-trigger-width),160px)] overflow-hidden rounded-[14px]"
        >
          <RS.ScrollUpButton className="text-muted flex h-7 items-center justify-center">
            <Icon name="caret-up" size={14} />
          </RS.ScrollUpButton>
          <RS.Viewport className="p-1.5">
            {options.map((o, i) =>
              isGroup(o) ? (
                <Fragment key={`g-${o.label}`}>
                  {i > 0 && <RS.Separator className="bg-line mx-2 my-1.5 h-px" />}
                  <RS.Group>
                    <RS.Label className="text-muted px-3 pt-1.5 pb-1 text-[12px] font-semibold tracking-[0.04em] uppercase">
                      {o.label}
                    </RS.Label>
                    {o.options.map((opt) => (
                      <Item key={opt.value} option={opt} tone={tone} />
                    ))}
                  </RS.Group>
                </Fragment>
              ) : (
                <Item key={o.value} option={o} tone={tone} />
              ),
            )}
          </RS.Viewport>
          <RS.ScrollDownButton className="text-muted flex h-7 items-center justify-center">
            <Icon name="caret-down" size={14} />
          </RS.ScrollDownButton>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}

function Item({ option, tone }: { option: SelectOption; tone: Tone }) {
  return (
    <RS.Item
      value={toInner(option.value)}
      disabled={option.disabled}
      textValue={option.textValue ?? (typeof option.label === "string" ? option.label : undefined)}
      className={`data-[highlighted]:bg-surface-raised relative flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] py-2 pr-3 pl-9 outline-none select-none focus-visible:shadow-none! data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[state=checked]:font-semibold pointer-coarse:min-h-11 ${tone === "admin" ? "text-[14px]" : "text-[15px]"}`}
    >
      <RS.ItemIndicator className="text-accent absolute left-2.5 flex items-center">
        <Icon name="check" size={16} />
      </RS.ItemIndicator>
      <RS.ItemText>{option.label}</RS.ItemText>
    </RS.Item>
  );
}
