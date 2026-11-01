"use client";

import { useEffect, useRef } from "react";
import { play } from "./index";

/** Soft air up when a sheet or dialog opens, down when it closes. Silent on the first render. */
export function useSheetSound(open: boolean) {
  const prev = useRef(open);
  useEffect(() => {
    if (prev.current === open) return;
    prev.current = open;
    play(open ? "sheetOpen" : "sheetClose");
  }, [open]);
}
