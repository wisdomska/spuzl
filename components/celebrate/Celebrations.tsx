"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Spuz } from "@/components/brand/Spuz";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { play, duck } from "@/lib/audio";
import { formatShort } from "@/lib/format";
import { GAMES, LAUNCH_IDS, WORLD_BY_ID } from "@/lib/catalog";

/**
 * Reward overlays (Onboarding and Overlays R1 to R5, Solo Screens 06). Each sits on the celebration layer
 * (z 70), plays its Handoff sound and haptic, and skips to its end state on the first tap anywhere.
 * Reduced motion: the same information, fades only.
 */
export type Celebration =
  | { kind: "level"; level: number; sparks: number; unlock?: string }
  | { kind: "rank"; world: string; rank: string; from: string }
  | { kind: "badge"; name: string; tier: string; icon: string; description: string; sparks: number }
  | { kind: "streak"; days: number; sparks: number; freeze: boolean }
  | { kind: "full"; xp: number; totalMs: number };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const PARTY = { type: "spring" as const, stiffness: 300, damping: 12 };

/** Plays a queue of celebrations one after another; calls onDone when the queue is empty. */
export function CelebrationChain({ items, onDone }: { items: Celebration[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const current = items[i];
  useEffect(() => {
    if (!current) onDone();
  }, [current, onDone]);
  return (
    <AnimatePresence mode="wait">{current && <CelebrationView key={i} c={current} onNext={() => setI((n) => n + 1)} />}</AnimatePresence>
  );
}

function CelebrationView({ c, onNext }: { c: Celebration; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [skipped, setSkipped] = useState(false);
  const instant = !!reduce || skipped;

  useEffect(() => {
    duck(1400);
    const sound = { level: "fanfare", rank: "fanfare", badge: "clink", streak: "whoosh", full: "cheer" }[c.kind];
    const t = setTimeout(() => play(sound), c.kind === "badge" ? 550 : 0);
    return () => clearTimeout(t);
  }, [c.kind]);

  const bg = c.kind === "streak" ? "#1E1208" : "#06070D";
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={label(c)}
      className="fixed inset-0 z-[70] flex flex-col items-center overflow-hidden px-4 pb-8 text-[#F4F5FB]"
      style={{ background: bg }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      onPointerDown={() => setSkipped(true)}
    >
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col items-center justify-center gap-[18px]">
        {c.kind === "level" && <LevelUp c={c} instant={instant} />}
        {c.kind === "rank" && <RankUp c={c} instant={instant} />}
        {c.kind === "badge" && <BadgeUnlock c={c} instant={instant} />}
        {c.kind === "streak" && <StreakMilestone c={c} instant={instant} />}
        {c.kind === "full" && <FullSpuzl c={c} instant={instant} />}
      </div>
      <div className="mx-auto w-full max-w-[420px]">
        <Button size="lg" className="w-full text-[17px]" onClick={onNext} autoFocus>
          {{ level: "Nice", rank: "Nice", badge: "Pin to profile", streak: "Keep it lit", full: "Share the flex" }[c.kind]}
        </Button>
      </div>
    </motion.div>
  );
}

function label(c: Celebration) {
  switch (c.kind) {
    case "level":
      return `Level up. Level ${c.level}.`;
    case "rank":
      return `Rank up. ${c.rank} in ${c.world}.`;
    case "badge":
      return `Badge unlocked. ${c.name}.`;
    case "streak":
      return `${c.days}-day streak.`;
    case "full":
      return "Full Spuzl. Every Daily cleared.";
  }
}

function Ring({ color, delay, instant }: { color: string; delay: number; instant: boolean }) {
  if (instant) return null;
  return (
    <motion.div
      aria-hidden
      className="absolute top-1/2 left-1/2 -mt-[130px] -ml-[130px] size-[260px] rounded-full"
      style={{ boxShadow: `0 0 0 6px ${color}` }}
      initial={{ opacity: 1, transform: "scale(0.4)" }}
      animate={{ opacity: 0, transform: "scale(1.7)" }}
      transition={{ duration: 1.2, delay, ease: EASE_OUT }}
    />
  );
}

/** Solo Screens 06: scrim, ring burst .4 → 1.7, number reel translateY −50%, 1,200 ms party spring. */
function LevelUp({ c, instant }: { c: Extract<Celebration, { kind: "level" }>; instant: boolean }) {
  return (
    <>
      <div className="relative flex flex-col items-center gap-[18px]">
        <Ring color="#B8F23A" delay={0} instant={instant} />
        <Ring color="#FFC93C" delay={0.3} instant={instant} />
        <p className="font-display mt-10 text-[16px] font-bold text-[#A2A6C2]">Level up</p>
        <div
          className="relative flex size-[200px] items-center justify-center rounded-full bg-[#171929]"
          style={{ boxShadow: "inset 0 0 0 10px #B8F23A" }}
        >
          <div className="h-[110px] overflow-hidden">
            <motion.div
              initial={instant ? false : { transform: "translateY(0%)" }}
              animate={{ transform: "translateY(-50%)" }}
              transition={instant ? { duration: 0 } : { ...PARTY, delay: 0.2 }}
              className="flex flex-col items-center"
            >
              <span className="font-display text-[104px] leading-[110px] font-black tracking-[-0.04em] text-[#A2A6C2]">{c.level - 1}</span>
              <span className="font-display text-[104px] leading-[110px] font-black tracking-[-0.04em]">{c.level}</span>
            </motion.div>
          </div>
        </div>
      </div>
      <p className="max-w-[280px] text-center text-[17px] leading-[1.4] font-semibold">
        Level {c.level}. {levelLine(c.level)}
      </p>
      <div className="flex gap-2.5">
        <Chip icon="lightning" iconColor="#FFC93C">
          <span className="num text-[#FFC93C]">+{c.sparks}</span>
        </Chip>
        {c.unlock && (
          <Chip icon="paint-brush" iconColor="#B8F23A">
            {c.unlock}
          </Chip>
        )}
      </div>
      <div className="absolute right-6 bottom-[120px]">
        <Spuz mood="proud" size={110} decorative />
      </div>
    </>
  );
}

function levelLine(level: number) {
  if (level < 5) return "Warming up nicely.";
  if (level < 10) return "Spuz noticed.";
  if (level < 20) return "The Grid is starting to respect you.";
  if (level < 40) return "Big brain energy, confirmed.";
  return "Legends are made like this.";
}

function Chip({ icon, iconColor, children }: { icon: string; iconColor: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-[14px] bg-[#171929] px-3.5 py-2.5 text-[15px] font-semibold">
      <Icon name={icon} size={18} style={{ color: iconColor }} />
      {children}
    </div>
  );
}

/** R1 Rank up: old emblem → new emblem with a slam, ladder of ranks below. */
function RankUp({ c, instant }: { c: Extract<Celebration, { kind: "rank" }>; instant: boolean }) {
  const LADDER = ["Rookie", "Thinker", "Solver", "Strategist", "Mastermind", "Legend"];
  const at = LADDER.indexOf(c.rank);
  return (
    <>
      <p className="font-display text-[15px] font-bold text-[#A2A6C2]">Rank up · {c.world}</p>
      <div className="flex items-center gap-4">
        <Hex size={56} color="#2B2F4A" icon="graduation-cap" iconColor="#5A5E78" />
        <Icon name="arrow-right" size={22} className="text-[#A2A6C2]" />
        <motion.div
          initial={instant ? false : { transform: "scale(2)", opacity: 0 }}
          animate={{ transform: "scale(1)", opacity: 1 }}
          transition={instant ? { duration: 0 } : { ...PARTY, delay: 0.3 }}
        >
          <Hex size={112} color="#8B7CFF" icon="brain" iconColor="#0E0F1A" />
        </motion.div>
      </div>
      <h2 className="font-display text-[34px] font-black">{c.rank}</h2>
      <p className="text-[16px] font-medium">
        {c.from} no more. Welcome to {c.rank}.
      </p>
      <ol className="mt-1 flex gap-4" aria-label="Rank ladder">
        {LADDER.map((r, i) => (
          <li key={r} className="flex flex-col items-center gap-1 text-[10px]" style={{ color: i <= at ? "#F4F5FB" : "#5A5E78" }}>
            <span className="size-3 rounded-[4px]" style={{ background: i === at ? "#8B7CFF" : i < at ? "#5A5E78" : "#2B2F4A" }} />
            {r}
          </li>
        ))}
      </ol>
      <div className="absolute right-6 bottom-[120px]">
        <Spuz mood="proud" size={90} color="#8B7CFF" decorative />
      </div>
    </>
  );
}

function Hex({ size, color, icon, iconColor }: { size: number; color: string; icon: string; iconColor: string }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size * 1.1, background: color, clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)" }}
    >
      <Icon name={icon} size={size * 0.42} style={{ color: iconColor }} />
    </div>
  );
}

const TIER: Record<string, string> = { bronze: "#C08A4A", silver: "#C9CCDD", gold: "#FFC93C", prism: "#B8F23A" };

/** R2 Badge unlock: medallion drops −40 → 0 and spins once (rotateY 360), shine sweep, tier ring burst. */
function BadgeUnlock({ c, instant }: { c: Extract<Celebration, { kind: "badge" }>; instant: boolean }) {
  const col = TIER[c.tier] ?? "#FFC93C";
  return (
    <>
      <p className="font-display text-[15px] font-bold" style={{ color: col }}>
        Badge unlocked
      </p>
      <div className="relative" style={{ perspective: 600 }}>
        <Ring color={col} delay={0.4} instant={instant} />
        <motion.div
          initial={instant ? false : { transform: "translateY(-40px) rotateY(0deg)", opacity: 0 }}
          animate={{ transform: "translateY(0px) rotateY(360deg)", opacity: 1 }}
          transition={instant ? { duration: 0 } : { ...PARTY, delay: 0.1 }}
          className="flex h-[150px] w-[110px] items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${col}, color-mix(in srgb, ${col} 55%, #0E0F1A))`,
            clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)",
          }}
        >
          <Icon name={c.icon} size={46} style={{ color: "#0E0F1A" }} />
        </motion.div>
      </div>
      <h2 className="font-display text-[30px] font-black">{c.name}</h2>
      <p className="max-w-[300px] text-center text-[15px] text-[#C9CCDD]">{c.description}</p>
      <div className="flex gap-2">
        {["bronze", "silver", "gold", "prism"].map((t) => (
          <span
            key={t}
            className="rounded-[10px] px-3 py-1.5 text-[13px] font-semibold capitalize"
            style={t === c.tier ? { background: TIER[t], color: "#0E0F1A" } : { background: "#20233A", color: "#A2A6C2" }}
          >
            {t}
          </span>
        ))}
      </div>
      <Chip icon="lightning" iconColor="#FFC93C">
        <span className="num text-[#FFC93C]">+{c.sparks}</span>
      </Chip>
    </>
  );
}

/** R3 Streak milestone: flame 1 → 1.2 → 1, embers rise, digit flip. */
function StreakMilestone({ c, instant }: { c: Extract<Celebration, { kind: "streak" }>; instant: boolean }) {
  return (
    <>
      <motion.div
        className="relative flex size-[150px] items-center justify-center"
        initial={instant ? false : { transform: "scale(1)" }}
        animate={instant ? undefined : { transform: ["scale(1)", "scale(1.2)", "scale(1)"] }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        style={{ borderRadius: "50% 0 50% 50%", rotate: "-45deg", background: "linear-gradient(45deg,#FF6B2C,#FFC93C)" }}
      >
        <span className="num font-display text-[56px] font-black text-[#0E0F1A]" style={{ rotate: "45deg" }}>
          {c.days}
        </span>
      </motion.div>
      <h2 className="font-display mt-4 text-[28px] font-black">{c.days}-day streak</h2>
      <p className="max-w-[280px] text-center text-[16px] font-medium">
        {c.days >= 30 ? "A whole month. Spuz's tuft is officially on fire." : "The flame is growing. Come back tomorrow."}
      </p>
      <div className="flex gap-2.5">
        <Chip icon="lightning" iconColor="#FFC93C">
          <span className="num text-[#FFC93C]">+{c.sparks}</span>
        </Chip>
        {c.freeze && (
          <Chip icon="snowflake" iconColor="#6FB6FF">
            +1 Freeze
          </Chip>
        )}
      </div>
      <div className="absolute bottom-[120px] left-6">
        <Spuz mood="fire" size={90} decorative />
      </div>
    </>
  );
}

/** R5 Full Spuzl: every featured Daily tile pops in, party Spuz, totals. */
function FullSpuzl({ c, instant }: { c: Extract<Celebration, { kind: "full" }>; instant: boolean }) {
  const games = LAUNCH_IDS.map((id) => GAMES.find((g) => g.id === id)!);
  return (
    <>
      <h2 className="font-display text-center text-[40px] leading-none font-black">
        Full
        <br />
        <span className="text-[#B8F23A]">Spuzl!</span>
      </h2>
      <p className="text-[15px] font-semibold">All {games.length} Dailies. You ate.</p>
      <div className="grid grid-cols-5 gap-2">
        {games.map((g, i) => (
          <motion.span
            key={g.id}
            className="flex size-12 items-center justify-center rounded-[12px] text-[#0E0F1A]"
            style={{ background: WORLD_BY_ID[g.world].color }}
            initial={instant ? false : { opacity: 0, transform: "scale(0.6)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            transition={instant ? { duration: 0 } : { ...PARTY, delay: 0.1 + i * 0.05 }}
          >
            <Icon name={g.icon} size={22} />
          </motion.span>
        ))}
      </div>
      <Spuz mood="party" size={120} decorative />
      <div className="flex gap-2.5">
        <Chip icon="sparkle" iconColor="#B8F23A">
          <span className="num text-[#B8F23A]">+{c.xp} XP</span>
        </Chip>
        <Chip icon="timer" iconColor="#A2A6C2">
          <span className="num">Total {formatShort(c.totalMs)}</span>
        </Chip>
      </div>
    </>
  );
}
