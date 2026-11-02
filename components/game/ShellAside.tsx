"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The game shell's side panel (wide screens only, see `isWide`). The shell provides the panel's slot node;
 * boards wrap whatever otherwise sits above or below the board (whose turn it is, clue lists, words found,
 * a move list) in `<ShellAside>`, which moves it into the panel on a wide screen and leaves it in place on a
 * phone. It stays in the board's React tree either way, so state and handlers are unchanged.
 */
interface AsideCtx {
  wide: boolean;
  node: HTMLElement | null;
}

const Ctx = createContext<AsideCtx>({ wide: false, node: null });

export const ShellAsideProvider = Ctx.Provider;

/** True inside a two-column shell. */
export function useShellWide(): boolean {
  return useContext(Ctx).wide;
}

/**
 * Content for the side panel. `phone` renders instead on a single-column screen (default: the same children).
 * Until the panel slot exists (its first render) nothing shows on a wide screen, so the content never jumps.
 */
export function ShellAside({ children, phone }: { children: ReactNode; phone?: ReactNode }) {
  const { wide, node } = useContext(Ctx);
  if (!wide) return <>{phone === undefined ? children : phone}</>;
  return node ? createPortal(children, node) : null;
}
