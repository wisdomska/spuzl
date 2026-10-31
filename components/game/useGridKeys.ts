"use client";

import { useCallback, useState, type KeyboardEvent } from "react";

/**
 * Roving focus for role="grid" boards: arrows move, Space cycles the mark, Enter confirms.
 * Returns the focused index and a keydown handler for the grid element.
 */
export function useGridKeys(rows: number, cols: number, onCycle: (i: number) => void, onConfirm?: (i: number) => void) {
  const [focus, setFocus] = useState(0);
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const r = Math.floor(focus / cols),
        c = focus % cols;
      let next = focus;
      switch (e.key) {
        case "ArrowUp":
          next = Math.max(0, r - 1) * cols + c;
          break;
        case "ArrowDown":
          next = Math.min(rows - 1, r + 1) * cols + c;
          break;
        case "ArrowLeft":
          next = r * cols + Math.max(0, c - 1);
          break;
        case "ArrowRight":
          next = r * cols + Math.min(cols - 1, c + 1);
          break;
        case "Home":
          next = r * cols;
          break;
        case "End":
          next = r * cols + cols - 1;
          break;
        case " ":
          e.preventDefault();
          onCycle(focus);
          return;
        case "Enter":
          e.preventDefault();
          (onConfirm ?? onCycle)(focus);
          return;
        default:
          return;
      }
      e.preventDefault();
      setFocus(next);
      const el = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-i="${next}"]`);
      el?.focus();
    },
    [focus, rows, cols, onCycle, onConfirm],
  );
  return { focus, setFocus, onKeyDown };
}
