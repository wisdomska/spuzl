import type { CSSProperties } from "react";
import { ICONS } from "./icons.generated";

/** Phosphor Bold by kebab-case name (design uses `ph-<name>`). Decorative unless `label` is set. */
export function Icon({ name, size = 20, className, style, label }: { name: string; size?: number; className?: string; style?: CSSProperties; label?: string }) {
  const C = ICONS[name.replace(/^ph-/, "")] ?? ICONS["question"];
  return <C size={size} weight="bold" className={className} style={style} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined} />;
}
