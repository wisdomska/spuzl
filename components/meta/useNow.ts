"use client";

import { useEffect, useState } from "react";

/** Wall clock that ticks every `ms` (countdowns). Deadlines are computed as dataUpdatedAt + msLeft - now. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
