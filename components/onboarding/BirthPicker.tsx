"use client";

import { useId, useState } from "react";
import { readYearInput } from "@/lib/age";
import { ageCopy as C } from "@/lib/copy/age";

export interface Birth {
  year: number | null;
  month: number | null;
}

/**
 * Birth month and year, never the day, each with a visible label and a 56 px target.
 *
 * R2-09 control choice (fastest on a mid-range Android phone, and accessible):
 * - Month: twelve buttons (Jan to Dec, 4 × 3, 48 px), one tap with no list to open: native radio buttons under the
 *   app's styling, so screen readers hear "Month, group" and the full month name, and the arrow keys move between
 *   them. (R7: replaced the native select, whose OS list didn't match the app.)
 * - Year: a 4-digit numeric field (numeric keypad via inputMode, autofill via `bday-year`). Four taps for any
 *   age, where a year list needs a fling through up to 87 rows in a dialog. It has no list to start at the wrong
 *   end, and an under-13 year can still be typed truthfully: the age gate then turns the visitor away and keeps
 *   nothing, so nobody is nudged to pick a false year that a shortened list would force.
 */
export function BirthPicker({ value, onChange, error }: { value: Birth; onChange: (b: Birth) => void; error?: string | null }) {
  const id = useId();
  // The typed digits (a partial year is not a year yet); starts from the value when the step reopens.
  const [yearText, setYearText] = useState(value.year ? String(value.year) : "");
  const described = [`${id}-yh`, error ? `${id}-err` : null].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-2">
      <fieldset role="radiogroup" className="flex min-w-0 flex-col gap-1.5" aria-describedby={error ? `${id}-err` : undefined}>
        <legend className="mb-1.5 text-[15px] font-semibold">{C.month}</legend>
        <div className="grid grid-cols-4 gap-2" data-birth-months>
          {C.months.map((m, i) => {
            const n = i + 1;
            return (
              <label key={m} className="relative">
                <input
                  type="radio"
                  name={`${id}-month`}
                  value={n}
                  checked={value.month === n}
                  onChange={() => onChange({ ...value, month: n })}
                  className="peer absolute inset-0 z-[1] m-0 cursor-pointer appearance-none rounded-[14px] opacity-0"
                />
                <span
                  aria-hidden
                  className="bg-surface-raised text-text peer-focus-visible:outline-accent flex h-12 cursor-pointer items-center justify-center rounded-[14px] text-[16px] font-semibold shadow-[inset_0_0_0_2px_var(--line)] transition-transform duration-100 peer-checked:bg-[color-mix(in_srgb,var(--accent)_16%,var(--surface-raised))] peer-checked:font-bold peer-checked:shadow-[inset_0_0_0_2px_var(--accent)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-active:scale-[0.97] motion-reduce:transition-none"
                >
                  {C.monthsShort[i]}
                </span>
                <span className="sr-only">{m}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex gap-2.5">
        <Field id={`${id}-y`} label={C.year} className="flex-1">
          <input
            id={`${id}-y`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="bday-year"
            enterKeyHint="done"
            maxLength={4}
            placeholder={C.yearPlaceholder}
            value={yearText}
            onChange={(e) => {
              const next = readYearInput(e.target.value);
              setYearText(next.text);
              if (next.year !== value.year) onChange({ ...value, year: next.year });
            }}
            aria-invalid={!!error}
            aria-describedby={described}
            className="num placeholder:text-muted h-full w-full rounded-[16px] bg-transparent px-4 text-[17px] font-semibold outline-none focus-visible:shadow-none"
          />
        </Field>
      </div>
      <p id={`${id}-yh`} className="text-muted text-[14px]">
        {C.yearHelp}
      </p>
      {error && (
        <p id={`${id}-err`} role="alert" className="text-danger text-[14px]">
          {error}
        </p>
      )}
    </div>
  );
}

function Field({ id, label, className, children }: { id: string; label: string; className: string; children: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[15px] font-semibold">
        {label}
      </label>
      {/* Visible focus: the whole field gets the accent ring while its control has focus. */}
      <div
        className="bg-surface-raised focus-within:outline-accent relative flex h-14 items-center rounded-[16px] focus-within:outline-2 focus-within:outline-offset-2"
        style={{ boxShadow: "inset 0 0 0 2px var(--line)" }}
      >
        {children}
      </div>
    </div>
  );
}
