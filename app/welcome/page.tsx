"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { Spuz } from "@/components/brand/Spuz";
import { Button } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/PageLoader";
import { EmailCodeSignIn } from "@/components/onboarding/EmailCodeSignIn";
import { copy } from "@/lib/copy";
import { Icon } from "@/components/ui/Icon";
import CrownfallBoard from "@/games/crownfall/Board";
import { TUTORIAL_PUZZLE } from "@/games/crownfall/tutorial";
import { analyze, type CrownfallState } from "@/games/crownfall/logic";
import type { BoardApi } from "@/games/types";
import { nicknameProblem } from "@/lib/validation/nickname";
import { api, ensureSession, finishAttempt, startAttempt } from "@/lib/client/api";
import { writeOnboarding } from "@/lib/client/onboarding";
import { formatShort } from "@/lib/format";
import { play, duck } from "@/lib/audio";
import { PATTERNS, haptic } from "@/lib/haptics";

type Step = "hello" | "signin" | "age" | "under13" | "start" | "tutorial" | "firstclear" | "nickname";
type Age = "13-15" | "16-17" | "18+";

const AGES: { v: Age; t: string; d: string }[] = [
  { v: "13-15", t: "13 to 15", d: "Friends and classmates only. No global chat." },
  { v: "16-17", t: "16 to 17", d: "Leagues and Duels on. Friend requests by code." },
  { v: "18+", t: "18 or older", d: "Everything on." },
];
const SKINS = [
  { n: "Lime", c: "#B8F23A" },
  { n: "Cyan", c: "#2FD3E0" },
  { n: "Gold", c: "#FFC93C" },
  { n: "Orange", c: "#FF8A3D" },
  { n: "Violet", c: "#8B7CFF" },
  { n: "Coral", c: "#FF6B6B" },
];
const IDEAS = [
  "CocoaCrusher",
  "GridGyal",
  "KenteKing",
  "JollofJedi",
  "AzontoAce",
  "PuzzlePrince",
  "ShitoShark",
  "KelewaleKid",
  "MangoMind",
  "AdinkraAce",
  "BrainyBolt",
  "SparkSeeker",
];
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** O2 How to start: nobody is forced into the tutorial. */
const STARTS = [
  { id: "tutorial", icon: "graduation-cap", t: "Show me how", d: "A 30-second Crownfall lesson. Earns your first XP, Sparks and streak." },
  { id: "pick", icon: "squares-four", t: "Pick a game", d: "Make your Spuz, then choose any of the 51 games." },
  { id: "jump", icon: "lightning", t: "Jump straight in", d: "Make your Spuz and go straight to the Grid." },
] as const;

export default function Welcome() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("hello");
  // Signed in with email during onboarding: the profile then belongs to that account, not a guest.
  const [signedIn, setSignedIn] = useState(false);
  const [age, setAge] = useState<Age | null>(null);
  const [color, setColor] = useState(SKINS[1].c);
  const [nick, setNick] = useState("");
  const [ideas, setIdeas] = useState(() => IDEAS.slice(0, 3));
  const [coach, setCoach] = useState("Tap once for X, twice for a crown.");
  const [cells, setCells] = useState<CrownfallState>(() => new Array(16).fill(0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t0 = useRef<number | null>(null);
  const clear = useRef<{ state: CrownfallState; ms: number } | null>(null);
  const [clearMs, setClearMs] = useState(0);
  // Where the player lands after making their Spuz: the Grid, or All games when they chose to pick one.
  const [dest, setDest] = useState<"/" | "/library">("/");
  // Saved and on the way: cover the screen with the loader while the next page renders on the server.
  const [leaving, setLeaving] = useState(false);
  // Back from the sign-in email's link (/auth/callback?next=/welcome): returning players go home, new
  // accounts finish onboarding signed in.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auth") !== "linked") return;
    let live = true;
    api<{ id: string } | null>("/api/v1/me?optional=1")
      .then((me) => {
        if (!live) return;
        if (me) {
          writeOnboarding({ introSeen: true, tutorialDone: true });
          setLeaving(true);
          router.replace("/");
        } else {
          setSignedIn(true);
          setStep("age");
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [router]);

  // Fetch the destination's shell ahead of time, so the hand-off after "Enter The Grid" is quick.
  useEffect(() => {
    if (step === "nickname") router.prefetch(dest);
  }, [step, dest, router]);

  const a = analyze(TUTORIAL_PUZZLE, cells);
  const rules = [
    { t: "One crown per row and column", ok: a.crowns >= 2 && a.rule !== "row" && a.rule !== "column" },
    { t: "One crown per colour", ok: a.crowns >= 2 && a.rule !== "region" },
    { t: "Crowns never touch, even corners", ok: a.clear },
  ];

  const boardApi = useMemo<BoardApi<CrownfallState>>(
    () => ({
      onMove(state) {
        t0.current ??= performance.now();
        setCells(state);
      },
      onSolved(state) {
        clear.current = { state, ms: Math.round(performance.now() - (t0.current ?? performance.now())) };
        setClearMs(clear.current.ms);
        setTimeout(() => {
          setStep("firstclear");
          duck(1200);
          play("cheer");
          haptic(PATTERNS.clear);
        }, 1100);
      },
      feedback(text) {
        setCoach(text);
      },
      ruleBreak(message) {
        setCoach(message);
        play("buzz");
      },
      announce() {},
      setControls() {},
    }),
    [],
  );

  const problem = nick ? nicknameProblem(nick) : null;

  const enter = async () => {
    if (!age || !nick || problem) return;
    setSaving(true);
    setError(null);
    try {
      await ensureSession();
      await api("/api/v1/profile", { json: { nickname: nick, ageBand: age, color } });
      if (clear.current) {
        const s = await startAttempt({ game: "crownfall", mode: "tutorial" });
        await finishAttempt(s.attemptId, { state: clear.current.state, activeMs: clear.current.ms, mistakes: 0 });
      }
      writeOnboarding({ tutorialDone: !!clear.current });
      qc.removeQueries({ queryKey: ["me"] });
      qc.removeQueries({ queryKey: ["today"] });
      setLeaving(true);
      router.replace(dest);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong. Try again.";
      setError(msg === "nickname_taken" ? "That name is taken." : msg);
      setSaving(false);
    }
  };

  const progress = { hello: 0, signin: 0, age: 1, under13: 1, start: 2, tutorial: 3, firstclear: 3, nickname: 4 }[step];

  return (
    <main className="safe-top bg-bg relative mx-auto flex min-h-dvh max-w-[560px] flex-col overflow-hidden">
      {leaving && <PageLoader message={dest === "/library" ? "Opening all games" : "Opening the Grid"} />}
      <AnimatePresence mode="wait" initial={false}>
        {step === "hello" && (
          <Screen key="hello">
            <motion.div
              className="mt-8 flex justify-center"
              initial={{ opacity: 0, transform: "translateY(24px) scale(0.85)" }}
              animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              <Spuz mood="wave" size={180} decorative />
            </motion.div>
            <h1 className="font-display text-center text-[32px] leading-[1.08] font-black tracking-[-0.02em] text-balance">
              {copy.welcome.helloTitle}
            </h1>
            <p className="text-muted text-center text-[16px] leading-normal text-balance">{copy.welcome.helloBody}</p>
            <div className="mt-auto flex flex-col gap-3">
              <Button size="lg" className="w-full text-[17px]" icon="play" onClick={() => setStep("age")}>
                {copy.welcome.playAsGuest}
              </Button>
              <Button size="lg" variant="secondary" className="w-full text-[17px]" icon="envelope-simple" onClick={() => setStep("signin")}>
                {copy.welcome.signInWithEmail}
              </Button>
              <p className="text-muted text-center text-[13px]">{copy.welcome.signInLater}</p>
            </div>
          </Screen>
        )}

        {step === "signin" && (
          <Screen key="signin">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Back"
                onClick={() => setStep("hello")}
                className="press bg-surface-raised flex size-11 items-center justify-center rounded-[14px]"
              >
                <Icon name="arrow-left" size={20} />
              </button>
              <h1 className="font-display text-[26px] leading-[1.1] font-black tracking-[-0.02em]">{copy.welcome.signInTitle}</h1>
            </div>
            <div className="flex justify-center">
              <Spuz mood="thinking" size={120} decorative />
            </div>
            <EmailCodeSignIn
              onDone={(hasProfile) => {
                if (hasProfile) {
                  qc.removeQueries({ queryKey: ["me"] });
                  qc.removeQueries({ queryKey: ["today"] });
                  writeOnboarding({ introSeen: true, tutorialDone: true });
                  setLeaving(true);
                  router.replace("/");
                } else {
                  // New account: set it up like any new player, signed in from the start.
                  setSignedIn(true);
                  setStep("age");
                }
              }}
            />
          </Screen>
        )}

        {step === "age" && (
          <Screen key="age">
            <Progress n={progress} />
            <div className="mt-2.5 flex justify-center">
              <Spuz mood="wave" size={150} decorative />
            </div>
            <h1 className="font-display text-center text-[30px] leading-[1.1] font-black tracking-[-0.02em]">
              Akwaaba, Spuzler.
              <br />
              How old are you?
            </h1>
            <p className="text-muted text-center text-[16px] leading-normal">
              So we can keep things safe and fair. We never show it to anyone.
            </p>
            <div role="radiogroup" aria-label="Age band" className="mt-1.5 flex flex-col gap-2.5">
              {AGES.map((o) => {
                const on = age === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setAge(o.v)}
                    className="press flex h-16 items-center gap-3.5 rounded-[20px] px-[18px] text-left"
                    style={{
                      background: on ? "var(--success-tint)" : "var(--surface)",
                      boxShadow: on ? "inset 0 0 0 2px var(--accent)" : undefined,
                    }}
                  >
                    <span
                      className="flex size-6 items-center justify-center rounded-full"
                      style={{ boxShadow: `inset 0 0 0 2px ${on ? "var(--accent)" : "#5A5E78"}` }}
                    >
                      <span className="size-3 rounded-full" style={{ background: on ? "var(--accent)" : "transparent" }} />
                    </span>
                    <span className="flex flex-1 flex-col">
                      <span className="text-[17px] font-semibold">{o.t}</span>
                      <span className="text-muted text-[14px]">{o.d}</span>
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setStep("under13")}
                className="text-muted self-center px-3 py-2 text-[14px] underline-offset-4 hover:underline"
              >
                I am under 13
              </button>
            </div>
            <Button
              size="lg"
              className="mt-auto w-full text-[17px]"
              disabled={!age}
              onClick={() => {
                writeOnboarding({ ageBand: age! });
                setStep("start");
              }}
            >
              Continue
            </Button>
          </Screen>
        )}

        {step === "under13" && (
          <Screen key="under13">
            <div className="mt-16 flex justify-center">
              <Spuz mood="sad" size={150} decorative />
            </div>
            <h1 className="font-display text-center text-[28px] leading-[1.1] font-black">SPUZL is for 13 and up</h1>
            <p className="text-muted text-center text-[16px] leading-normal">Come back when you turn 13. Spuz will keep your seat warm.</p>
            <Button size="lg" variant="secondary" className="mt-auto w-full" onClick={() => setStep("age")}>
              Back
            </Button>
          </Screen>
        )}

        {step === "start" && (
          <Screen key="start">
            <Progress n={progress} />
            <div className="flex items-end gap-3">
              <Spuz mood="wave" size={96} decorative />
              <h1 className="font-display mb-2 text-[28px] leading-[1.1] font-black tracking-[-0.02em] text-balance">
                How do you want to start?
              </h1>
            </div>
            <div className="flex flex-col gap-2.5">
              {STARTS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    if (o.id === "tutorial") {
                      setDest("/");
                      setStep("tutorial");
                    } else {
                      setDest(o.id === "pick" ? "/library" : "/");
                      setStep("nickname");
                    }
                  }}
                  className="toy bg-surface-raised flex min-h-[76px] items-center gap-3.5 rounded-[20px] px-4 py-3 text-left"
                  style={{ boxShadow: "0 5px 0 var(--depth)" }}
                >
                  <span className="bg-surface flex size-12 flex-none items-center justify-center rounded-[14px]">
                    <Icon name={o.icon} size={24} className="text-accent" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-display text-[17px] font-extrabold">{o.t}</span>
                    <span className="text-muted text-[14px] leading-snug">{o.d}</span>
                  </span>
                  <Icon name="caret-right" size={18} className="text-muted ml-auto flex-none" />
                </button>
              ))}
            </div>
            <p className="text-muted mt-auto text-center text-[14px]">You can learn any game later from its Help button.</p>
          </Screen>
        )}

        {step === "tutorial" && (
          <Screen key="tutorial">
            <Progress n={progress} />
            <div className="flex items-center justify-between gap-3">
              <h1 className="font-display text-logic text-[24px] font-black">Crownfall</h1>
              <button
                type="button"
                onClick={() => setStep("nickname")}
                className="text-muted min-h-11 px-2 text-[15px] font-semibold underline-offset-4 hover:underline"
              >
                Skip
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {rules.map((r) => (
                <li
                  key={r.t}
                  className="flex items-center gap-2.5 text-[16px] font-medium transition-colors duration-200"
                  style={{ color: r.ok ? "var(--accent)" : "var(--text)" }}
                >
                  <Icon name={r.ok ? "check-circle" : "circle"} size={18} />
                  {r.t}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-center" style={{ ["--world" as string]: "var(--w-logic)" }}>
              <CrownfallBoard puzzle={TUTORIAL_PUZZLE} mode="tutorial" api={boardApi} />
            </div>
            <div className="mt-auto flex items-end gap-1">
              <Spuz mood="thinking" size={90} decorative />
              <motion.p
                key={coach}
                initial={{ opacity: 0, transform: "translateY(4px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                aria-live="polite"
                className="bg-surface-raised mb-5 flex-1 rounded-[20px_20px_20px_6px] px-4 py-3.5 text-[16px] leading-[1.4] font-medium"
              >
                {coach}
              </motion.p>
            </div>
          </Screen>
        )}

        {step === "firstclear" && <FirstClear key="firstclear" ms={clearMs} onNext={() => setStep("nickname")} />}

        {step === "nickname" && (
          <Screen key="nickname">
            <Progress n={progress} />
            <h1 className="font-display text-[28px] leading-[1.1] font-black tracking-[-0.02em]">Make Spuz yours</h1>
            {signedIn && (
              <p className="text-accent -mt-2 flex items-center gap-1.5 text-[14px] font-semibold">
                <Icon name="check-circle" size={16} />
                {copy.welcome.signedInNote}
              </p>
            )}
            <div className="bg-surface flex size-[220px] items-center justify-center self-center rounded-full">
              <Spuz mood="proud" size={190} color={color} decorative />
            </div>
            <div role="radiogroup" aria-label="Spuz colour" className="flex justify-center gap-2.5">
              {SKINS.map((k) => (
                <button
                  key={k.c}
                  type="button"
                  role="radio"
                  aria-checked={color === k.c}
                  aria-label={k.n}
                  onClick={() => setColor(k.c)}
                  className="press flex size-11 items-center justify-center rounded-[14px] text-[#0E0F1A]"
                  style={{ background: k.c, boxShadow: color === k.c ? "0 0 0 3px var(--bg), 0 0 0 6px var(--text)" : undefined }}
                >
                  {color === k.c && <Icon name="check" size={20} />}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex flex-col gap-2">
              <label htmlFor="nick" className="text-[15px] font-semibold">
                Nickname
              </label>
              <div
                className="bg-surface-raised flex h-14 items-center gap-2.5 rounded-[16px] px-4"
                style={{ boxShadow: `inset 0 0 0 2px ${problem || error ? "var(--danger)" : nick ? "var(--accent)" : "var(--line)"}` }}
              >
                <input
                  id="nick"
                  value={nick}
                  onChange={(e) => {
                    setNick(e.target.value.replace(/\s/g, "").slice(0, 16));
                    setError(null);
                  }}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={16}
                  placeholder="Pick a name"
                  aria-invalid={!!problem}
                  aria-describedby="nick-help"
                  className="placeholder:text-muted h-full flex-1 bg-transparent text-[18px] font-semibold outline-none"
                />
                {nick && !problem && <Icon name="check-circle" size={22} className="text-accent" />}
              </div>
              <div className="flex flex-wrap gap-2">
                {ideas.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNick(n)}
                    className="press bg-surface text-muted flex items-center gap-1.5 rounded-[12px] px-3 py-2 text-[14px] font-medium"
                  >
                    <Icon name="shuffle" size={14} />
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="More ideas"
                  onClick={() => setIdeas(shuffle(IDEAS).slice(0, 3))}
                  className="press bg-surface text-muted flex size-9 items-center justify-center rounded-[12px]"
                >
                  <Icon name="arrows-clockwise" size={16} />
                </button>
              </div>
              <p id="nick-help" className="text-[14px]" style={{ color: problem || error ? "var(--danger)" : "var(--text-muted)" }}>
                {problem ?? error ?? "Free and yours. No real names, no phone numbers."}
              </p>
            </div>
            <Button size="lg" className="mt-auto w-full text-[17px]" disabled={!nick || !!problem} loading={saving} onClick={enter}>
              {saving ? "Making your Spuz…" : "Enter The Grid"}
            </Button>
          </Screen>
        )}
      </AnimatePresence>
    </main>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      className="flex min-h-dvh flex-col gap-4 px-5 pt-[60px] pb-7"
      initial={{ opacity: 0, transform: "translateX(24px)" }}
      animate={{ opacity: 1, transform: "translateX(0px)" }}
      exit={{ opacity: 0, transform: "translateX(-24px)", transition: { duration: 0.15, ease: EASE_OUT } }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
    >
      {children}
    </motion.section>
  );
}

function Progress({ n }: { n: number }) {
  return (
    <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={n} aria-label={`Step ${n} of 4`}>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="h-1.5 flex-1 rounded-[3px] transition-colors duration-300"
          style={{ background: i <= n ? "var(--accent)" : "var(--line)" }}
        />
      ))}
    </div>
  );
}

/** O3 First clear: ring burst, Spuz cheer, reward tiles. Tap anywhere skips the party. */
function FirstClear({ ms, onNext }: { ms: number; onNext: () => void }) {
  const [skip, setSkip] = useState(false);
  const instant = skip;
  return (
    <motion.section
      className="relative flex min-h-dvh flex-col items-center gap-3.5 overflow-hidden px-5 pt-20 pb-7"
      style={{ background: "#1B1835", color: "#F4F5FB" }}
      onPointerDown={() => setSkip(true)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
    >
      {!instant && (
        <motion.div
          aria-hidden
          className="absolute top-[250px] left-1/2 -mt-[120px] -ml-[120px] size-[240px] rounded-full"
          style={{ boxShadow: "0 0 0 6px #8B7CFF" }}
          initial={{ opacity: 1, transform: "scale(0.4)" }}
          animate={{ opacity: 0, transform: "scale(1.7)" }}
          transition={{ duration: 1.2, ease: EASE_OUT }}
        />
      )}
      <h1 className="font-display self-stretch text-center text-[40px] leading-none font-black tracking-[-0.03em]">First clear!</h1>
      <motion.div
        className="relative mt-1.5"
        initial={instant ? false : { transform: "translateY(-40px) scale(0.8)", opacity: 0 }}
        animate={{ transform: "translateY(0px) scale(1)", opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 12 }}
      >
        <Spuz mood="cheer" size={200} decorative />
      </motion.div>
      <p className="max-w-[300px] text-center text-[18px] leading-[1.4] font-semibold">
        {formatShort(ms)} on your first ever puzzle. Okay, big brain.
      </p>
      <div className="mt-1 flex gap-2.5">
        <Tile v="+150" c="#B8F23A" l="XP" d={0.3} instant={instant} />
        <Tile v="+50" c="#FFC93C" l="Sparks" d={0.45} instant={instant} />
        <Tile v="1" c="#FFC93C" l="Streak" icon="fire" d={0.6} instant={instant} />
      </div>
      <Button size="lg" className="mt-auto w-full text-[17px]" onClick={onNext}>
        Make it official
      </Button>
      <p className="text-[14px] font-medium text-[#C9C4FF]">Tap anywhere to skip the party</p>
    </motion.section>
  );
}

function Tile({ v, c, l, icon, d, instant }: { v: string; c: string; l: string; icon?: string; d: number; instant: boolean }) {
  return (
    <motion.div
      className="flex flex-col items-center rounded-[16px] bg-[#0E0F1A] px-4 py-3"
      initial={instant ? false : { opacity: 0, transform: "translateY(12px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ delay: instant ? 0 : d, duration: 0.4, ease: EASE_OUT }}
      onAnimationComplete={() => !instant && l === "XP" && play("coins")}
    >
      <span className="num flex items-center gap-1 text-[24px] font-semibold" style={{ color: c }}>
        {icon && <Icon name={icon} size={22} />}
        {v}
      </span>
      <span className="text-[13px] font-medium text-[#A2A6C2]">{l}</span>
    </motion.div>
  );
}

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
