"use client";

import { Popover } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./Icon";
import { Select, type SelectOption } from "./Select";
import { uiCopy } from "@/lib/copy/ui";

const D = uiCopy.date;

/* ---------------- Plain date helpers (YYYY-MM-DD, calendar days, no time zone) ---------------- */

export interface Ymd {
  y: number;
  m: number; // 1 to 12
  d: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-11" → { y: 2026, m: 11, d: 11 }, or null when it isn't a real date. */
export function parseYmd(v: string | null | undefined): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? { y, m: mo, d } : null;
}

export const ymdString = ({ y, m, d }: Ymd) => `${y}-${pad(m)}-${pad(d)}`;

const toUtc = ({ y, m, d }: Ymd) => Date.UTC(y, m - 1, d);
const fromUtc = (t: number): Ymd => {
  const x = new Date(t);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
};

/** Adds days (negative to go back). */
export const addDays = (a: Ymd, n: number) => fromUtc(toUtc(a) + n * 86_400_000);

/** Adds months, keeping the day where it fits (31 Jan + 1 month = 28 or 29 Feb). */
export function addMonths(a: Ymd, n: number): Ymd {
  const idx = a.y * 12 + (a.m - 1) + n;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { y, m, d: Math.min(a.d, last) };
}

/** 0 = Monday … 6 = Sunday. */
export const weekday = (a: Ymd) => (new Date(toUtc(a)).getUTCDay() + 6) % 7;

export const sameDay = (a: Ymd | null, b: Ymd | null) => !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d;
const cmp = (a: Ymd, b: Ymd) => toUtc(a) - toUtc(b);

/** The month's weeks, Monday first, with the days from the months either side to fill them (4 to 6 rows). */
export function monthWeeks(y: number, m: number): Ymd[][] {
  const first = { y, m, d: 1 };
  const start = addDays(first, -weekday(first));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows = Math.ceil((weekday(first) + last) / 7);
  return Array.from({ length: rows }, (_, r) => Array.from({ length: 7 }, (_, c) => addDays(start, r * 7 + c)));
}

/** "Wed 11 Nov 2026" (the trigger's text). */
export const formatYmd = (a: Ymd) => `${D.weekdaysShort[weekday(a)]} ${a.d} ${D.monthsShort[a.m - 1]} ${a.y}`;
/** "Wednesday 11 November 2026" (a day's name for screen readers). */
export const formatYmdLong = (a: Ymd) => `${D.weekdays[weekday(a)]} ${a.d} ${D.months[a.m - 1]} ${a.y}`;

/** Today on this device, as a calendar day. */
export function todayYmd(now = new Date()): Ymd {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

/* ---------------- DateField ---------------- */

export interface DateFieldProps {
  /** "YYYY-MM-DD", or "" for none */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  /** offers "Clear" in the calendar (filters); off for a required date */
  clearable?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** width and height of the trigger (e.g. "h-11 w-44") */
  className?: string;
}

/**
 * The app's date field: a field-like button showing "Wed 11 Nov 2026" that opens a calendar in the app's style
 * (Radix Popover). Values stay plain "YYYY-MM-DD" strings, so URL filters and APIs don't change.
 *
 * Calendar keyboard (the ARIA date-picker grid): arrows move a day or a week, Home and End go to the week's ends,
 * Page Up and Page Down change month (with Shift, year), Enter or Space picks, Escape closes. Focus starts on the
 * chosen day (or today) and returns to the field when it closes. Day buttons are 40 px (44 on touch).
 */
export function DateField({
  value,
  onChange,
  id,
  name,
  min,
  max,
  clearable = false,
  disabled,
  required,
  placeholder = D.placeholder,
  className = "",
  ...aria
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const picked = parseYmd(value);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={id}
        disabled={disabled}
        aria-label={aria["aria-label"]}
        aria-labelledby={aria["aria-labelledby"]}
        aria-describedby={aria["aria-describedby"]}
        aria-invalid={aria["aria-invalid"] || undefined}
        aria-required={required || undefined}
        data-date-field
        data-value={value}
        className={`group bg-bg text-text inline-flex h-10 min-w-0 items-center gap-2 rounded-[10px] pr-2.5 pl-3 text-left text-[14px] shadow-[inset_0_0_0_1px_var(--line)] outline-none hover:shadow-[inset_0_0_0_1px_var(--text-muted)] focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:shadow-[inset_0_0_0_2px_var(--danger)] data-[state=open]:shadow-[inset_0_0_0_2px_var(--accent)] ${className}`}
      >
        <span className={`num min-w-0 flex-1 truncate ${picked ? "" : "text-muted"}`}>{picked ? formatYmd(picked) : placeholder}</span>
        <Icon name="calendar-blank" size={16} className="text-muted shrink-0" />
      </Popover.Trigger>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const el = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLButtonElement>('[tabindex="0"][data-day]');
            el?.focus();
          }}
          className="pop-content bg-surface text-text shadow-pop z-[90] max-h-[var(--radix-popover-content-available-height)] w-[min(320px,calc(100vw-24px))] overflow-y-auto overscroll-contain rounded-[16px] p-3 outline-none"
          data-calendar
        >
          <Calendar
            value={picked}
            min={parseYmd(min)}
            max={parseYmd(max)}
            onPick={(d) => {
              onChange(ymdString(d));
              setOpen(false);
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(ymdString(todayYmd()));
                setOpen(false);
              }}
              className="text-accent hover:bg-surface-raised h-10 rounded-[10px] px-3 text-[14px] font-semibold pointer-coarse:h-11"
            >
              {D.today}
            </button>
            {clearable && value ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-muted hover:bg-surface-raised hover:text-text h-10 rounded-[10px] px-3 text-[14px] font-semibold pointer-coarse:h-11"
              >
                {D.clear}
              </button>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The month grid. Exported for tests and for an inline calendar. */
export function Calendar({
  value,
  min,
  max,
  onPick,
  today = todayYmd(),
}: {
  value: Ymd | null;
  min?: Ymd | null;
  max?: Ymd | null;
  onPick: (d: Ymd) => void;
  today?: Ymd;
}) {
  const [focus, setFocus] = useState<Ymd>(value ?? today);
  const grid = useRef<HTMLTableElement>(null);
  const moved = useRef(false);
  const headId = useId();
  const weeks = useMemo(() => monthWeeks(focus.y, focus.m), [focus.y, focus.m]);
  const out = (d: Ymd) => (!!min && cmp(d, min) < 0) || (!!max && cmp(d, max) > 0);

  // After a key moves the focused day, move DOM focus with it (not on first render: the popover places it).
  useEffect(() => {
    if (!moved.current) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${ymdString(focus)}"]`)?.focus();
  }, [focus]);

  const go = (d: Ymd) => {
    moved.current = true;
    setFocus(d);
  };
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    const next =
      k === "ArrowLeft"
        ? addDays(focus, -1)
        : k === "ArrowRight"
          ? addDays(focus, 1)
          : k === "ArrowUp"
            ? addDays(focus, -7)
            : k === "ArrowDown"
              ? addDays(focus, 7)
              : k === "Home"
                ? addDays(focus, -weekday(focus))
                : k === "End"
                  ? addDays(focus, 6 - weekday(focus))
                  : k === "PageUp"
                    ? addMonths(focus, e.shiftKey ? -12 : -1)
                    : k === "PageDown"
                      ? addMonths(focus, e.shiftKey ? 12 : 1)
                      : null;
    if (next) {
      e.preventDefault();
      go(next);
    }
  };
  const monthName = `${D.months[focus.m - 1]} ${focus.y}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={D.previousMonth}
          onClick={() => setFocus(addMonths(focus, -1))}
          className="text-muted hover:bg-surface-raised hover:text-text flex size-10 items-center justify-center rounded-[10px] pointer-coarse:size-11"
        >
          <Icon name="caret-left" size={16} />
        </button>
        <span id={headId} aria-live="polite" className="font-display text-[15px] font-extrabold">
          {monthName}
        </span>
        <button
          type="button"
          aria-label={D.nextMonth}
          onClick={() => setFocus(addMonths(focus, 1))}
          className="text-muted hover:bg-surface-raised hover:text-text flex size-10 items-center justify-center rounded-[10px] pointer-coarse:size-11"
        >
          <Icon name="caret-right" size={16} />
        </button>
      </div>
      <table ref={grid} role="grid" aria-labelledby={headId} className="w-full border-collapse" onKeyDown={onKey}>
        <thead>
          <tr>
            {D.weekdaysNarrow.map((w, i) => (
              <th key={i} scope="col" abbr={D.weekdays[i]} className="text-muted h-7 text-center text-[12px] font-semibold">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={ymdString(week[0])}>
              {week.map((day) => {
                const iso = ymdString(day);
                const other = day.m !== focus.m;
                const chosen = sameDay(day, value);
                const isToday = sameDay(day, today);
                const off = out(day);
                return (
                  <td key={iso} role="gridcell" aria-selected={chosen} className="p-0.5 text-center">
                    <button
                      type="button"
                      data-day={iso}
                      tabIndex={sameDay(day, focus) ? 0 : -1}
                      disabled={off}
                      aria-label={formatYmdLong(day)}
                      aria-current={isToday ? "date" : undefined}
                      onClick={() => onPick(day)}
                      onFocus={() => {
                        if (!sameDay(day, focus)) setFocus(day);
                      }}
                      className={`num mx-auto flex size-10 items-center justify-center rounded-[10px] text-[14px] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]! disabled:cursor-not-allowed disabled:opacity-30 pointer-coarse:size-11 ${
                        chosen
                          ? "bg-accent text-on-accent font-bold"
                          : `hover:bg-surface-raised ${other ? "text-muted" : "text-text"} ${isToday ? "font-bold shadow-[inset_0_0_0_1px_var(--accent)]" : ""}`
                      }`}
                    >
                      {day.d}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- DateTimeField (a date and a time, "YYYY-MM-DDTHH:mm" like datetime-local) ---------------- */

/** Every half hour of the day, plus `keep` when it's off the half hour (an event saved at 09:10). */
export function timeOptions(keep?: string): SelectOption[] {
  const all = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);
  if (keep && /^\d{2}:\d{2}$/.test(keep) && !all.includes(keep)) all.push(keep);
  return all.sort().map((t) => ({ value: t, label: t }));
}

export function DateTimeField({
  value,
  onChange,
  id,
  label,
  defaultTime = "09:00",
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
}: {
  /** "YYYY-MM-DDTHH:mm", or "" */
  value: string;
  onChange: (value: string) => void;
  /** the date part's id (a `<label htmlFor>` points at it) */
  id: string;
  /** the field's label, so the time part reads "<label>, time" */
  label: string;
  defaultTime?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [date = "", time = ""] = value.split("T");
  const hm = time.slice(0, 5);
  return (
    <div className="flex min-w-0 gap-2">
      <DateField
        id={id}
        value={date}
        onChange={(d) => onChange(d ? `${d}T${hm || defaultTime}` : "")}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="flex-[3]"
      />
      <Select
        aria-label={`${label}, ${D.time.toLowerCase()}`}
        value={hm}
        placeholder={D.timePlaceholder}
        options={timeOptions(hm)}
        disabled={!date}
        onValueChange={(t) => onChange(`${date}T${t}`)}
        aria-invalid={invalid}
        className="num w-[104px] flex-none"
      />
    </div>
  );
}
