/**
 * Game setting values in words for admins ("1.5 seconds", "19:00 local time", "On"), shared by Game settings and
 * the Activity log. Stored values keep their units (milliseconds, hours); only the display and the input change.
 */
import type { SettingDef } from "@/lib/game-settings/schema";
import { adminCopy } from "@/lib/copy/admin";

const U = adminCopy.settings.units;

type IntDef = Extract<SettingDef, { kind: "int" }>;

/** How a number setting is typed in: milliseconds are typed as seconds (scale 1000), everything else as stored. */
export function inputSpec(d: IntDef): { scale: number; label: string; decimals: boolean } {
  switch (d.unit) {
    case "ms":
      return { scale: 1000, label: U.input.seconds, decimals: true };
    case "s":
      return { scale: 1, label: U.input.seconds, decimals: false };
    case "h GMT":
      return { scale: 1, label: U.input.hourGmt, decimals: false };
    case "h local":
      return { scale: 1, label: U.input.hourLocal, decimals: false };
    case "%":
      return { scale: 1, label: U.input.percent, decimals: false };
    case "days":
      return { scale: 1, label: U.input.days, decimals: false };
    case undefined:
      return { scale: 1, label: d.noun ? U.input.count(d.noun) : U.input.number, decimals: false };
    default:
      return { scale: 1, label: d.unit, decimals: false };
  }
}

const n = (v: number) => v.toLocaleString("en-GB", { maximumFractionDigits: 2 });

/** A number setting's value in words, from its stored value. */
export function intText(d: IntDef, v: number): string {
  switch (d.unit) {
    case "ms":
      return U.seconds(n(v / 1000), v === 1000);
    case "s":
      return v >= 60 ? U.minSec(Math.floor(v / 60), v % 60) : U.seconds(n(v), v === 1);
    case "h GMT":
      return U.hour(v, "GMT");
    case "h local":
      return U.hour(v, "local");
    case "%":
      return U.percent(n(v));
    case "days":
      return U.days(n(v), v === 1);
    case undefined:
      return d.noun ? U.count(n(v), d.noun) : n(v);
    default:
      return `${n(v)} ${d.unit}`;
  }
}

/** Any setting's value in words. Unknown or malformed values print as they are. */
export function settingValueText(d: SettingDef, v: unknown): string {
  if (d.kind === "bool") return typeof v === "boolean" ? (v ? U.on : U.off) : String(v);
  if (d.kind === "enum") return typeof v === "string" ? U.choice(v) : String(v);
  if (d.kind === "set") {
    if (!Array.isArray(v)) return String(v);
    const labels = v.map((id) => d.options.find((o) => o.id === id)?.label ?? String(id));
    return labels.length ? labels.join(", ") : U.none;
  }
  return typeof v === "number" ? intText(d, v) : String(v);
}
