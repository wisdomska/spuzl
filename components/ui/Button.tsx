"use client";

import { forwardRef, useLayoutEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Toy button (Components file). Elevation is a solid depth shadow; pressed = translateY(5px) + 1px shadow,
 * spring-press 120 ms. Loading never spins: the label stays and a sweep runs along the base.
 * Error shakes 3 × 6 px once and swaps the icon.
 *
 * Long labels: the side padding is fixed (never squeezed), the label wraps onto a second, balanced line and is
 * clamped there, and the button grows from its minimum height instead of clipping. `sub` puts a short second
 * line under the label (e.g. "Next: Emoji Hits" over "Words & Quiz"): better than one long run-on label.
 * A single word too wide for the button (a half-width "Challenge" on a small phone) can't wrap, so its type steps
 * down (never under 75%) until it fits inside the padding; if it still can't, the icon makes way.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "world";
export type ButtonSize = "md" | "lg" | "cta";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent [--btn-depth:var(--accent-depth)] hover-fine:brightness-110",
  secondary: "bg-surface-raised text-text [--btn-depth:var(--depth)]",
  ghost: "bg-transparent text-text shadow-none! hover-fine:bg-surface-raised",
  danger: "bg-danger text-on-accent [--btn-depth:var(--danger-depth)]",
  world: "bg-[var(--world)] text-[var(--on-accent)] [--btn-depth:var(--world-depth,rgb(0_0_0/.35))]",
};
const SIZE: Record<ButtonSize, string> = {
  md: "min-h-12 py-2 px-5 text-[16px] rounded-[16px] font-display font-extrabold",
  lg: "min-h-[60px] py-2.5 px-6 text-[16px] rounded-[20px] font-display font-black",
  cta: "min-h-[72px] py-3 px-6 text-[24px] rounded-[20px] font-display font-black uppercase",
};
/** The second line's size, a step under the label. */
const SUB: Record<ButtonSize, string> = { md: "text-[13px]", lg: "text-[13px]", cta: "text-[15px]" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  loading?: boolean;
  error?: boolean;
  /** a short second line under the label, in a smaller, softer type */
  sub?: ReactNode;
  children?: ReactNode;
}

/** Shrinks the label's type, 1 px at a time down to 75%, while a word overflows its box (wrapping can't help). */
function useFitWord<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // the label sits in the button directly, or in the two-line stack; the icon is the button's first child
    const btn = el.closest("button");
    const icon = btn?.firstElementChild instanceof SVGElement ? btn.firstElementChild : null;
    const over = () => el.scrollWidth > el.clientWidth + 1;
    const shrink = () => {
      el.style.fontSize = "";
      const full = parseFloat(getComputedStyle(el).fontSize);
      for (let size = full; over() && size > full * 0.75;) el.style.fontSize = `${(size -= 1)}px`;
    };
    const fit = () => {
      if (icon) icon.style.display = "";
      shrink();
      // last resort on the narrowest phones: the word matters more than its icon
      if (over() && icon) {
        icon.style.display = "none";
        shrink();
      }
    };
    fit();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    ro?.observe(el.parentElement ?? el);
    return () => ro?.disconnect();
  });
  return ref;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, loading, error, sub, children, className = "", disabled, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  const label = useFitWord<HTMLSpanElement>();
  return (
    <button
      ref={ref}
      disabled={disabled}
      aria-busy={loading || undefined}
      data-error={error || undefined}
      className={[
        "toy relative inline-flex items-center justify-center gap-2 overflow-hidden text-center select-none",
        VARIANT[variant],
        SIZE[size],
        error ? "toy-error" : "",
        disabled ? "toy-disabled" : "",
        className,
      ].join(" ")}
      {...rest}
      onClick={isDisabled ? undefined : rest.onClick}
    >
      {(error || icon) && <Icon name={error ? "warning" : icon!} size={size === "cta" ? 26 : 18} className="shrink-0" />}
      {sub ? (
        <span className="flex min-w-0 flex-col leading-tight">
          <span ref={label} className="line-clamp-2 text-balance">
            {children}
          </span>
          <span className={`line-clamp-1 font-sans font-semibold opacity-75 ${SUB[size]}`}>{sub}</span>
        </span>
      ) : (
        <span ref={label} className="line-clamp-2 min-w-0 leading-tight text-balance">
          {children}
        </span>
      )}
      {loading && <span aria-hidden className="toy-sweep" />}
    </button>
  );
});
