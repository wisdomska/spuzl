"use client";

import { useEffect, useState, type CSSProperties } from "react";

/** No spinners: skeletons in the final layout, shown only after 300 ms. */
export function Skeleton({ className = "", style, delay = 300 }: { className?: string; style?: CSSProperties; delay?: number }) {
  const [show, setShow] = useState(delay === 0);
  useEffect(() => {
    if (delay === 0) return;
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return <div aria-hidden className={`${show ? "skeleton" : ""} ${className}`} style={style} />;
}
