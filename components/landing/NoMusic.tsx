"use client";

import { useEffect } from "react";
import { holdMusic } from "@/lib/audio";

/** Keeps music off while the landing page is shown (it's also served at "/" to visitors, where Home music would play). */
export function NoMusic() {
  useEffect(() => {
    holdMusic(true);
    return () => holdMusic(false);
  }, []);
  return null;
}
