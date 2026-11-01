"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { Spuz } from "@/components/brand/Spuz";
import { play } from "@/lib/audio";
import { haptic, LEVELS } from "@/lib/haptics";
import { EMOTES, type EmoteId } from "@/lib/multiplayer/constants";
import { countdownBeat } from "@/lib/multiplayer/duel";
import { useReduce } from "@/lib/client/multiplayer";

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const SPRING_PARTY = { type: "spring", stiffness: 300, damping: 12 } as const;
export const SPRING_PRESS = { type: "spring", stiffness: 600, damping: 30 } as const;
/** Podium colours (gold, silver, bronze) and the rail position chips. Board materials, same in both themes. */
export const PODIUM = ["#FFC93C", "#D7DAE8", "#E09A5C"] as const;

/** Player tile: the initial on their Spuz colour, ink text (never colour alone: the name sits beside it). */
export function Avatar({
  name,
  color,
  size = 40,
  radius,
  dim,
  children,
}: {
  name: string;
  color: string;
  size?: number;
  radius?: number;
  dim?: boolean;
  children?: ReactNode;
}) {
  return (
    <span
      aria-hidden
      className="font-display relative flex flex-none items-center justify-center font-black"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size * 0.3),
        background: color,
        color: "#0E0F1A",
        fontSize: Math.round(size * 0.4),
        opacity: dim ? 0.4 : 1,
        boxShadow: "inset -3px -3px 0 rgba(0,0,0,.18)",
      }}
    >
      {name.slice(0, 1).toUpperCase()}
      {children}
    </span>
  );
}

/** Best-of-3 dots (D3): won rounds lime, lost rounds the opponent's colour, current ringed. */
export function RoundDots({
  rounds,
  current,
  size = 12,
  oppColor,
}: {
  rounds: ("me" | "them" | "draw")[];
  current: number;
  size?: number;
  oppColor: string;
}) {
  const label = `Round ${current} of 3. ${rounds.filter((r) => r === "me").length} won, ${rounds.filter((r) => r === "them").length} lost.`;
  return (
    <div className="flex gap-[5px]" role="img" aria-label={label}>
      {[0, 1, 2].map((k) => {
        const r = rounds[k];
        const bg = r === "me" ? "var(--accent)" : r === "them" ? oppColor : r === "draw" ? "var(--text-muted)" : "var(--line)";
        return (
          <span
            key={k}
            className="flex items-center justify-center"
            style={{
              width: size,
              height: size,
              borderRadius: size / 3,
              background: k + 1 === current && !r ? "transparent" : bg,
              boxShadow: k + 1 === current && !r ? "inset 0 0 0 2px var(--text)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * The 3-2-1-SPUZL! number (D2). A tick per number, horn on SPUZL!; reduced motion fades, no shake.
 * Each sound lands on the frame the number slams down (40% of its 500 ms entrance), not when it appears.
 */
const SLAM_S = 0.2;

export function CountdownNumber({ msToStart }: { msToStart: number }) {
  const { label, beat } = countdownBeat(msToStart);
  const reduce = useReduce();
  const played = useRef(-1);
  useEffect(() => {
    if (played.current === beat || msToStart <= 0) return;
    played.current = beat;
    const delay = reduce ? 0 : SLAM_S;
    if (beat >= 3) {
      play("horn", { delay, silentHaptic: true });
      setTimeout(() => haptic(LEVELS.heavy), delay * 1000);
    } else play("countdown", { step: 3 - beat, delay });
  }, [beat, msToStart, reduce]);
  const go = beat >= 3;
  return (
    <div aria-live="assertive" className="flex justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={label}
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(2.2) rotate(0deg)" }}
          animate={
            reduce
              ? { opacity: 1 }
              : {
                  opacity: 1,
                  transform: [
                    "scale(2.2) rotate(0deg)",
                    "scale(0.92) rotate(0deg)",
                    `scale(1.04) rotate(${beat % 2 ? 2 : -2}deg)`,
                    "scale(1) rotate(0deg)",
                  ],
                }
          }
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT, times: reduce ? undefined : [0, 0.4, 0.55, 1] }}
          className="font-display flex h-[100px] min-w-[100px] items-center justify-center rounded-[30px] px-[18px] font-black"
          style={{
            background: go ? "var(--accent)" : "#F4F5FB",
            color: "#0E0F1A",
            fontSize: go ? 30 : 64,
            boxShadow: `0 8px 0 ${go ? "var(--accent-depth)" : "#A2A6C2"}`,
          }}
        >
          <span className="num">{label}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Multiplayer toast (prototype): drops in from the top, info or bad. Never covers the board's cells. */
export function MpToast({ toast }: { toast: { text: string; kind: "info" | "bad" | "pass"; n: number } | null }) {
  const reduce = useReduce();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-[max(12px,env(safe-area-inset-top))]"
      aria-live="polite"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.n}
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-20px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.32, ease: EASE_OUT }}
            role="status"
            className="bg-surface-raised flex w-full max-w-[400px] items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-[15px] font-medium shadow-[0_10px_30px_rgba(0,0,0,.4)]"
            style={{ boxShadow: toast.kind === "bad" ? "inset 0 0 0 2px var(--danger), 0 10px 30px rgba(0,0,0,.4)" : undefined }}
          >
            <Icon
              name={toast.kind === "bad" ? "warning" : toast.kind === "pass" ? "arrow-fat-lines-up" : "sparkle"}
              size={18}
              style={{ color: toast.kind === "bad" ? "var(--danger)" : toast.kind === "pass" ? "var(--w-shape)" : "var(--accent)" }}
            />
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function useToast(ms = 1800) {
  const [toast, setToast] = useState<{ text: string; kind: "info" | "bad" | "pass"; n: number } | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const n = useRef(0);
  const show = (text: string, kind: "info" | "bad" | "pass" = "info") => {
    if (t.current) clearTimeout(t.current);
    setToast({ text, kind, n: ++n.current });
    t.current = setTimeout(() => setToast(null), ms);
  };
  useEffect(() => () => void (t.current && clearTimeout(t.current)), []);
  return { toast, show };
}

/** Preset emote buttons (🔥 😂 😤 GG). Emoji are allowed in emotes only. */
export function EmoteBar({ onSend, size = "md" }: { onSend: (e: EmoteId) => void; size?: "md" | "lg" }) {
  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Emotes">
      {EMOTES.map((e, i) => (
        <button
          key={e}
          type="button"
          onClick={() => onSend(i as EmoteId)}
          aria-label={`Send ${e === "GG" ? "good game" : e}`}
          className="press bg-surface-raised font-display flex items-center justify-center rounded-[14px] text-[18px] font-black"
          style={{ width: size === "lg" ? 64 : 56, height: size === "lg" ? 48 : 44 }}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

/** Emote bubble: scale .6 → 1.05 → 1, rises 40 px and fades over 1,400 ms. Reduced motion: fade in and out. */
export function EmoteBubble({
  emote,
  n,
  className = "",
  style,
}: {
  emote: EmoteId | null;
  n: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduce = useReduce();
  useEffect(() => {
    if (emote !== null && n) play("emote", { silentHaptic: true });
  }, [emote, n]);
  // Keyed by n: each emote remounts and plays once; the last keyframe is fully transparent.
  return (
    <AnimatePresence>
      {emote !== null && n > 0 && (
        <motion.div
          key={n}
          aria-live="polite"
          className={`bg-surface-raised pointer-events-none absolute z-20 rounded-[14px_14px_14px_4px] px-2.5 py-1 text-[20px] ${className}`}
          style={style}
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px) scale(0.6)" }}
          animate={
            reduce
              ? { opacity: [0, 1, 1, 0] }
              : {
                  opacity: [0, 1, 1, 0],
                  transform: [
                    "translateY(6px) scale(0.6)",
                    "translateY(0px) scale(1.05)",
                    "translateY(-20px) scale(1)",
                    "translateY(-40px) scale(1)",
                  ],
                }
          }
          transition={{ duration: 1.4, ease: EASE_OUT, times: [0, 0.2, 0.6, 1] }}
        >
          {EMOTES[emote]}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Full-screen phone frame for multiplayer screens (no tab bar). */
export function Screen({
  children,
  className = "",
  style,
  label,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  return (
    <div
      className={`bg-bg relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col overflow-hidden ${className}`}
      style={style}
      data-screen-label={label}
    >
      {children}
    </div>
  );
}

/** Shown when multiplayer needs a profile first. */
export function NeedProfile() {
  return (
    <Screen label="Need profile">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Spuz mood="wave" size={120} />
        <h1 className="font-display text-[24px] font-black">Pick a nickname first</h1>
        <p className="text-muted text-[16px]">Multiplayer needs a name your rivals can see. It takes a minute.</p>
        <Link
          href="/welcome"
          className="toy font-display bg-accent text-on-accent flex h-[60px] w-full max-w-[358px] items-center justify-center rounded-[20px] text-[17px] font-black [--btn-depth:var(--accent-depth)]"
          style={{ boxShadow: "0 6px 0 var(--accent-depth)" }}
        >
          Continue
        </Link>
      </div>
    </Screen>
  );
}

/** Loading: skeletons in the final layout, shown after 300 ms, never a spinner. */
export function LoadingScreen() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <Screen label="Loading">
      {show && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4" aria-busy>
          <Spuz mood="thinking" size={110} />
          <div className="skeleton h-6 w-48 rounded-[12px]" />
          <div className="skeleton h-4 w-32 rounded-[10px]" />
        </div>
      )}
    </Screen>
  );
}

export function TopButton({ icon, label, onClick, href }: { icon: string; label: string; onClick?: () => void; href?: string }) {
  const cls = "press bg-surface-raised flex size-11 flex-none items-center justify-center rounded-[14px]";
  if (href)
    return (
      <Link href={href} aria-label={label} className={cls}>
        <Icon name={icon} size={20} />
      </Link>
    );
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      <Icon name={icon} size={20} />
    </button>
  );
}

/** Lime toy CTA (60 px). */
export function Cta({
  children,
  onClick,
  disabled,
  tone = "accent",
  className = "",
  icon,
  sub,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "accent" | "raised";
  className?: string;
  icon?: string;
  sub?: ReactNode;
}) {
  const accent = tone === "accent" && !disabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`toy font-display flex h-[60px] items-center justify-center gap-2.5 rounded-[20px] text-[17px] font-black ${className}`}
      style={{
        background: accent ? "var(--accent)" : "var(--surface-raised)",
        color: accent ? "var(--on-accent)" : disabled ? "var(--text-muted)" : "var(--text)",
        ["--btn-depth" as string]: accent ? "var(--accent-depth)" : "var(--depth)",
        boxShadow: `0 6px 0 ${accent ? "var(--accent-depth)" : "var(--depth)"}`,
      }}
    >
      {icon && <Icon name={icon} size={20} />}
      <span>{children}</span>
      {sub && <span className="font-sans text-[14px] font-medium">{sub}</span>}
    </button>
  );
}

export function formatTenths(ms: number): string {
  const t = Math.max(0, Math.round(ms / 100));
  const s = Math.floor(t / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${t % 10}`;
}

export function placeLabel(n: number) {
  return ["1st", "2nd", "3rd"][n - 1] ?? `${n}th`;
}
