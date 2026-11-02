"use client";

import { useId, useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { birthYears } from "@/lib/age";
import { ageCopy as C } from "@/lib/copy/age";

export interface Birth {
  year: number | null;
  month: number | null;
}

/**
 * Birth month and year, never the day: two native selects (screen readers and phone wheels handle them well),
 * each with a visible label and a 56 px target. Years run from this year back 100; under-13 years are offered
 * too, so nobody is nudged to pick a false one (the server refuses under 13 and keeps nothing).
 */
export function BirthPicker({ value, onChange, error }: { value: Birth; onChange: (b: Birth) => void; error?: string | null }) {
  const id = useId();
  const years = useMemo(() => birthYears(), []);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2.5">
        <Field id={`${id}-m`} label={C.month} className="flex-[3]">
          <select
            id={`${id}-m`}
            value={value.month ?? ""}
            onChange={(e) => onChange({ ...value, month: e.target.value ? Number(e.target.value) : null })}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : undefined}
            className="h-full w-full appearance-none bg-transparent pr-10 pl-4 text-[17px] font-semibold outline-none"
          >
            <option value="" className="bg-surface">
              {C.pickMonth}
            </option>
            {C.months.map((m, i) => (
              <option key={m} value={i + 1} className="bg-surface">
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-y`} label={C.year} className="flex-[2]">
          <select
            id={`${id}-y`}
            value={value.year ?? ""}
            onChange={(e) => onChange({ ...value, year: e.target.value ? Number(e.target.value) : null })}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : undefined}
            className="num h-full w-full appearance-none bg-transparent pr-10 pl-4 text-[17px] font-semibold outline-none"
          >
            <option value="" className="bg-surface">
              {C.pickYear}
            </option>
            {years.map((y) => (
              <option key={y} value={y} className="bg-surface">
                {y}
              </option>
            ))}
          </select>
        </Field>
      </div>
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
      <div
        className="bg-surface-raised relative flex h-14 items-center rounded-[16px]"
        style={{ boxShadow: "inset 0 0 0 2px var(--line)" }}
      >
        {children}
        <Icon name="caret-down" size={18} className="text-muted pointer-events-none absolute right-3.5" />
      </div>
    </div>
  );
}
