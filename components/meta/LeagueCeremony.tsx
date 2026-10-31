"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { formatNumber } from "@/lib/format";
import { ordinal } from "@/lib/leagues";
import { useClaimLeague, type LeagueRes } from "@/lib/client/social";
import { useMe } from "@/lib/client/api";
import { Hex } from "./ui";
import { LeagueRow } from "./LeagueRow";
import { flySparks } from "./sparks";

type Ceremony = NonNullable<LeagueRes["ceremony"]>;

const OUT = [0.23, 1, 0.32, 1] as const;
const IN_OUT = [0.77, 0, 0.175, 1] as const;
const PARTY = { type: "spring" as const, stiffness: 300, damping: 12 };

/**
 * L2 week-end ceremony (Handoff "League promotion", 1,200 ms): your row flies up past the rows above
 * (translateY + scale 1.04, ease-in-out, then a party spring), and the new emblem slams from scale 2 to 1.
 * Sound crowd_cheer, haptic [40]. Tap anywhere to skip. Reduced motion: the row highlights, the emblem fades.
 */
export function LeagueCeremony({ c, onDone }: { c: Ceremony; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [skip, setSkip] = useState(!!reduce);
  const [phase, setPhase] = useState<"fly" | "done">(reduce ? "done" : "fly");
  const claim = useClaimLeague();
  const me = useMe();
  const claimRef = useRef<HTMLButtonElement>(null);
  const promoted = c.result === "promoted";
  const demoted = c.result === "demoted";
  const myIdx = c.around.findIndex((r) => r.me);
  const below = myIdx < 0 ? 0 : c.around.length - 1 - myIdx; // rows your row flies up past

  useEffect(() => {
    if (promoted) play("crowd_cheer");
    else if (!demoted) play("chime");
    const t = setTimeout(() => setPhase("done"), 1200);
    return () => clearTimeout(t);
  }, [promoted, demoted]);

  const finish = () => {
    setSkip(true);
    setPhase("done");
  };

  const onClaim = async () => {
    if (c.reward > 0) {
      const res = await claim.mutateAsync(c.leagueId);
      await flySparks(claimRef.current, res.sparks);
    } else await claim.mutateAsync(c.leagueId);
    onDone();
  };

  const headline = promoted
    ? `Promoted. You finished ${ordinal(c.rank)} of ${c.n}.`
    : demoted
      ? `Down a league. You finished ${ordinal(c.rank)} of ${c.n}. Fresh start this week.`
      : `You stayed. You finished ${ordinal(c.rank)} of ${c.n}.`;
  const instant = skip || !!reduce;

  return (
    <Dialog.Root open onOpenChange={(o) => !o && phase === "done" && !claim.isPending && onDone()}>
      <Dialog.Portal>
        <Dialog.Content
          className="bg-bg fixed inset-0 z-[70] flex flex-col items-center gap-3.5 overflow-y-auto px-5 pt-[max(56px,env(safe-area-inset-top))] pb-7"
          onPointerDown={phase === "fly" ? finish : undefined}
          aria-describedby="ceremony-desc"
        >
          <div className="flex w-full max-w-[480px] items-center justify-between">
            <span className="text-muted text-[15px] font-semibold">Week {c.week} is done</span>
            <span data-wallet className="bg-surface-raised flex h-10 items-center gap-1.5 rounded-[14px] px-3" aria-label={`${formatNumber(me.data?.sparks ?? 0)} Sparks`}>
              <Icon name="lightning" size={18} className="text-gold" />
              <span className="num text-gold text-[17px] font-semibold">{formatNumber(me.data?.sparks ?? 0)}</span>
            </span>
          </div>
          <div className="relative flex h-[200px] w-[180px] items-center justify-center">
            {promoted && !reduce && (
              <motion.div
                aria-hidden
                className="absolute -inset-2.5 rounded-full"
                style={{ boxShadow: `0 0 0 4px ${c.to.color}` }}
                initial={{ transform: "scale(0.5)", opacity: 1 }}
                animate={{ transform: "scale(1.7)", opacity: 0 }}
                transition={{ duration: 1.4, ease: OUT, delay: instant ? 0 : 0.9, repeat: 2 }}
              />
            )}
            <motion.div
              initial={reduce ? { opacity: 0 } : { transform: promoted ? "scale(2)" : "scale(0.9)", opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { transform: "scale(1)", opacity: 1 }}
              transition={reduce ? { duration: 0.3 } : instant ? { duration: 0 } : { ...PARTY, delay: promoted ? 0.75 : 0.2 }}
            >
              <Hex w={170} h={190} bg={c.to.color} label={`${c.to.name} emblem`}>
                <div className="flex size-[120px] rotate-45 items-center justify-center rounded-[20px]" style={{ background: "#0E0F1A" }}>
                  <div className="flex size-[60px] -rotate-45 items-center justify-center rounded-[12px]" style={{ background: c.to.color, color: "#0E0F1A" }}>
                    <Icon name={c.to.icon} size={32} />
                  </div>
                </div>
              </Hex>
            </motion.div>
          </div>
          <Dialog.Title className="font-display text-[32px] font-black tracking-[-0.02em] whitespace-nowrap">{c.to.name}</Dialog.Title>
          <p id="ceremony-desc" className="max-w-[480px] text-center text-[17px] font-semibold text-balance">
            {headline}
          </p>
          <div className="flex w-full max-w-[480px] flex-col gap-[3px]" aria-hidden>
            {c.around.map((r) => {
              const mine = r.me;
              // Your row flies up from below the rows under you into its final slot, then tilts up (design L2).
              const from = Math.max(1, below) * 53;
              const rest = "translateY(-6px) scale(1.04) rotate(-1deg)";
              return (
                <motion.div
                  key={r.id}
                  style={{ position: "relative", zIndex: mine ? 2 : 1 }}
                  initial={mine && !reduce ? { transform: `translateY(${from}px) scale(1) rotate(0deg)` } : false}
                  animate={mine ? (reduce ? {} : { transform: rest }) : {}}
                  transition={instant ? { duration: 0 } : { duration: 0.75, ease: IN_OUT }}
                >
                  <LeagueRow pos={r.pos} nickname={r.nickname} color={r.color} points={r.points} zone={r.zone} me={mine} tall={mine} />
                </motion.div>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            {c.reward > 0 && <span className="bg-surface num text-gold rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold">+{c.reward} Sparks</span>}
            <span className="bg-surface num rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold">{formatNumber(c.points)} XP this week</span>
          </div>
          <Button
            ref={claimRef}
            size="lg"
            className="mt-auto w-full max-w-[480px] text-[17px]"
            onClick={onClaim}
            loading={claim.isPending}
            error={claim.isError}
            autoFocus
          >
            {c.reward > 0 ? "Claim" : "Got it"}
          </Button>
          {claim.isError && (
            <p role="alert" className="text-danger text-[14px]">
              That didn&apos;t go through. Your reward is safe, try again.
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
