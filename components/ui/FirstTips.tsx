"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { markTip, nextTip, seenTips, type TipId } from "@/lib/tips";
import { tipsCopy as T } from "@/lib/copy/tips";

type CardTip = Exclude<TipId, "slips">;

/** One small tip at a time, the first time each concept appears; dismissed for good with one tap. */
export function FirstTips({ order }: { order: readonly CardTip[] }) {
  const reduce = useReducedMotion();
  const [tip, setTip] = useState<CardTip | null>(null);
  // Start after the player's first touch, scroll or key press: the screen itself paints first (and the tip never
  // becomes the page's largest paint), and the tip answers a player who is now looking around.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      off();
      t = setTimeout(() => setTip(nextTip(order, seenTips()) as CardTip | null), 400);
    };
    const evs = ["pointerdown", "keydown", "wheel", "touchmove"] as const;
    const off = () => evs.forEach((e) => window.removeEventListener(e, start));
    evs.forEach((e) => window.addEventListener(e, start, { passive: true }));
    return () => {
      off();
      if (t) clearTimeout(t);
    };
  }, [order]);
  const done = () => {
    if (!tip) return;
    markTip(tip);
    setTip(nextTip(order, seenTips()) as CardTip | null);
  };
  const c = tip ? T[tip] : null;
  const last = tip ? order.filter((o) => !seenTips().has(o)).length <= 1 : true;
  return (
    <AnimatePresence mode="wait">
      {tip && c && (
        <motion.div
          key={tip}
          role="status"
          className="bg-surface-raised flex items-start gap-3 rounded-[18px] p-3 shadow-[0_8px_24px_rgb(0_0_0/.35)]"
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-8px) scale(0.97)" }}
          animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
        >
          <span className="bg-surface text-accent flex size-10 shrink-0 items-center justify-center rounded-[12px]">
            <Icon name={c.icon} size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{c.title}</span>
            <span className="text-muted text-[14px] leading-snug">{c.body}</span>
          </span>
          <button
            type="button"
            onClick={done}
            className="press bg-accent text-on-accent h-11 shrink-0 self-center rounded-[12px] px-3 text-[14px] font-bold"
          >
            {last ? T.gotIt : T.next}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
