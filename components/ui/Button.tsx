"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Toy button (Components file). Elevation is a solid depth shadow; pressed = translateY(5px) + 1px shadow,
 * spring-press 120 ms. Loading never spins: the label stays and a sweep runs along the base.
 * Error shakes 3 × 6 px once and swaps the icon.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "world";
export type ButtonSize = "md" | "lg" | "cta";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent [--btn-depth:var(--accent-depth)] hover-fine:brightness-110",
  secondary: "bg-surface-raised text-text [--btn-depth:var(--depth)]",
  ghost: "bg-transparent text-text shadow-none! hover-fine:bg-surface-raised",
  danger: "bg-danger text-on-accent [--btn-depth:var(--danger-depth)]",
  world: "bg-[var(--world)] text-[#0E0F1A] [--btn-depth:var(--world-depth,rgb(0_0_0/.35))]",
};
const SIZE: Record<ButtonSize, string> = {
  md: "h-12 px-5 text-[16px] rounded-[16px] font-display font-extrabold",
  lg: "h-[60px] px-6 text-[16px] rounded-[20px] font-display font-black",
  cta: "h-[72px] px-6 text-[24px] rounded-[20px] font-display font-black uppercase",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  loading?: boolean;
  error?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, loading, error, children, className = "", disabled, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={disabled}
      aria-busy={loading || undefined}
      data-error={error || undefined}
      className={[
        "toy relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap select-none",
        VARIANT[variant],
        SIZE[size],
        error ? "toy-error" : "",
        disabled ? "toy-disabled" : "",
        className,
      ].join(" ")}
      {...rest}
      onClick={isDisabled ? undefined : rest.onClick}
    >
      {(error || icon) && <Icon name={error ? "warning" : icon!} size={size === "cta" ? 26 : 18} />}
      <span>{children}</span>
      {loading && <span aria-hidden className="toy-sweep" />}
    </button>
  );
});
