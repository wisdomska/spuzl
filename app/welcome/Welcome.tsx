"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { Spuz } from "@/components/brand/Spuz";
import { Button } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/PageLoader";
import { EmailCodeSignIn } from "@/components/onboarding/EmailCodeSignIn";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { copy } from "@/lib/copy";
import { Icon } from "@/components/ui/Icon";
import CrownfallBoard from "@/games/crownfall/Board";
import { TUTORIAL_PUZZLE } from "@/games/crownfall/tutorial";
import { analyze, type CrownfallState } from "@/games/crownfall/logic";
import type { BoardApi } from "@/games/types";
import { nicknameProblem } from "@/lib/validation/nickname";
import { api, ensureSession, finishAttempt, HttpError, startAttempt } from "@/lib/client/api";
import { BirthPicker, type Birth } from "@/components/onboarding/BirthPicker";
import { ageBandOf, birthProblem } from "@/lib/age";
import { ageCopy } from "@/lib/copy/age";
import { forgetDemoClear, readDemoClear, rememberReturn, takeReturn, writeOnboarding } from "@/lib/client/onboarding";
import { markLearned } from "@/lib/guided";
import { onboardingStepOf } from "@/lib/analytics/onboarding";
import { track } from "@/lib/analytics/track";
import { formatClock } from "@/lib/format";
import { play, duck } from "@/lib/audio";

type Step = "hello" | "signin" | "age" | "under13" | "start" | "tutorial" | "nickname";
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
const W = copy.welcome;
const STARTS = [
  { id: "tutorial", icon: "graduation-cap", ...W.starts.tutorial },
  { id: "pick", icon: "squares-four", ...W.starts.pick },
  { id: "jump", icon: "map-trifold", ...W.starts.jump },
] as const;
/** R2-08: the landing demo was solved, so the lesson is skipped and Crownfall itself is the first choice. */
const STARTS_AFTER_DEMO = [{ id: "more", icon: "crown", ...W.starts.more }, STARTS[1], STARTS[2]] as const;
type Dest = "/" | "/library" | "/play/crownfall";
const LOADER: Record<Dest, string> = { "/": W.openingMap, "/library": W.openingLibrary, "/play/crownfall": W.openingCrownfall };

const noSubscribe = () => () => {};

/**
 * First run. `first="hello"` (/welcome) starts on "Ready to play?" (guest, Google, email); `first="age"`
 * (/welcome/play, the landing page's "Play now", R2-08) starts as a guest on "When were you born?".
 */
export function Welcome({ first = "hello" }: { first?: "hello" | "age" }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(first);
  // Forward steps enter from the right, going back enters from the left (spatial consistency).
  const [nav, setNav] = useState({ step, dir: 1 });
  if (nav.step !== step) setNav({ step, dir: STEP_ORDER[step] >= STEP_ORDER[nav.step] ? 1 : -1 });
  // Signed in with email during onboarding: the profile then belongs to that account, not a guest.
  const [signedIn, setSignedIn] = useState(false);
  // Birth month and year: held in memory only until the profile is made (never on the device). Under 13 clears it.
  const [birth, setBirth] = useState<Birth>({ year: null, month: null });
  const [birthError, setBirthError] = useState<string | null>(null);
  const [color, setColor] = useState(SKINS[1].c);
  // Back from Google (or an email link) without a session: say so on the first screen.
  const authFailed = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("auth") === "failed",
    () => false,
  );
  // R4-04: a gate, deep link (?return=) or invite (?from=invite) opened the age step directly. A returning player
  // whose session ended gets a way to sign in here, since the "Ready to play?" choice was skipped.
  const deepLink = useSyncExternalStore(
    noSubscribe,
    () => {
      const sp = new URLSearchParams(window.location.search);
      return sp.has("return") || sp.get("from") === "invite";
    },
    () => false,
  );
  const [nick, setNick] = useState("");
  const [ideas, setIdeas] = useState(() => IDEAS.slice(0, 3));
  const [coach, setCoach] = useState("Tap once for X, twice for a crown.");
  const [cells, setCells] = useState<CrownfallState>(() => new Array(16).fill(0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t0 = useRef<number | null>(null);
  const clear = useRef<{ state: CrownfallState; ms: number } | null>(null);
  const [clearMs, setClearMs] = useState(0);
  // R2-08: the landing demo was solved in this tab; it is the first clear and the lesson is skipped.
  const [demoCleared, setDemoCleared] = useState(false);
  // Where the player lands after making their Spuz: the Grid, All games, or Crownfall after the landing demo.
  const [dest, setDest] = useState<Dest>("/");
  // Saved and on the way: cover the screen with the loader while the next page renders on the server.
  const [leaving, setLeaving] = useState(false);
  // Back from the sign-in email's link (/auth/callback?next=/welcome): returning players go home, new
  // accounts finish onboarding signed in.
  // A deep link (e.g. /daily) sends visitors here with ?return=: onboarding ends there instead of the Grid.
  useEffect(() => rememberReturn(new URLSearchParams(window.location.search).get("return")), []);
  // The landing's "Play now" skips the logo intro: later first-run redirects (Home with no profile) skip it too.
  useEffect(() => {
    if (first === "age") writeOnboarding({ introSeen: true });
  }, [first]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auth") !== "linked") return;
    let live = true;
    api<{ id: string } | null>("/api/v1/me?optional=1")
      .then((me) => {
        if (!live) return;
        if (me) {
          writeOnboarding({ introSeen: true, tutorialDone: true });
          setLeaving(true);
          router.replace((takeReturn() ?? "/") as never);
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

  // Onboarding funnel (admin Metrics): each step once per visit, however often the player goes back to it.
  const seenSteps = useRef(new Set<Step>());
  useEffect(() => {
    if (seenSteps.current.has(step)) return;
    seenSteps.current.add(step);
    const kind = onboardingStepOf(step);
    if (kind) track("onboarding_step", { kind });
  }, [step]);

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
        play("clear", { delay: 0.1 });
        setTimeout(() => {
          setStep("nickname");
          duck(1200);
          play("celebrate");
        }, 1100);
      },
      feedback(text) {
        setCoach(text);
      },
      ruleBreak(message) {
        setCoach(message);
        play("error");
      },
      announce() {},
      setControls() {},
    }),
    [],
  );

  const problem = nick ? nicknameProblem(nick) : null;

  const enter = async () => {
    if (!birth.year || !birth.month || !nick || problem) return;
    setSaving(true);
    setError(null);
    try {
      await ensureSession();
      await api("/api/v1/profile", { json: { nickname: nick, birthYear: birth.year, birthMonth: birth.month, color } });
      if (clear.current) {
        // The lesson board and the landing demo are the same fixed public board, played before the profile
        // exists: its attempt is made after the clear and the server re-checks the solved state (no wall clock).
        const s = await startAttempt({ game: "crownfall", mode: "tutorial" });
        await finishAttempt(s.attemptId, { state: clear.current.state, activeMs: clear.current.ms, mistakes: 0 });
      }
      if (demoCleared) {
        forgetDemoClear();
        // Crownfall is learned: its first game skips the practice round, here and on the account's other devices.
        markLearned("crownfall");
        api("/api/v1/me/learned", { json: { games: ["crownfall"] } }).catch(() => undefined);
      }
      // Home sends the funnel's last step ("home") the first time it shows this new profile.
      writeOnboarding({ tutorialDone: !!clear.current, homePending: true });
      qc.removeQueries({ queryKey: ["me"] });
      qc.removeQueries({ queryKey: ["today"] });
      setLeaving(true);
      router.replace((takeReturn() ?? dest) as never);
    } catch (e) {
      if (e instanceof HttpError && e.code === "too_young") {
        setBirth({ year: null, month: null });
        forgetDemoClear();
        setSaving(false);
        setStep("under13");
        return;
      }
      const msg = e instanceof Error ? e.message : "Something went wrong. Try again.";
      setError(msg === "nickname_taken" ? "That name is taken." : msg);
      setSaving(false);
    }
  };

  const progress = { hello: 0, signin: 0, age: 1, under13: 1, start: 2, tutorial: 3, nickname: 4 }[step];

  return (
    <main className="safe-top bg-bg relative mx-auto flex min-h-dvh max-w-[560px] flex-col overflow-hidden">
      {leaving && <PageLoader message={LOADER[dest]} />}
      <Dir.Provider value={nav.dir}>
        <AnimatePresence mode="wait" initial={false} custom={nav.dir}>
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
                <GoogleButton next="/welcome" />
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full text-[17px]"
                  icon="envelope-simple"
                  onClick={() => setStep("signin")}
                >
                  {copy.welcome.signInWithEmail}
                </Button>
                {authFailed && (
                  <p role="alert" className="text-danger text-center text-[14px]">
                    {copy.welcome.signInFailed}
                  </p>
                )}
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
                    router.replace((takeReturn() ?? "/") as never);
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
                {ageCopy.greeting}
                <br />
                {ageCopy.title}
              </h1>
              <p className="text-muted text-center text-[16px] leading-normal">{ageCopy.why}</p>
              {/* A form, so the keypad's Done / Enter continues too (R2-09). `contents` keeps the screen's layout. */}
              <form
                className="contents"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!birth.year || !birth.month) return;
                  const problem = birthProblem(birth.year, birth.month);
                  if (problem) return setBirthError(problem === "future" ? ageCopy.future : ageCopy.birthInvalid);
                  // Under 13: no profile and nothing kept, not even on this device.
                  if (!ageBandOf(birth.year, birth.month)) {
                    setBirth({ year: null, month: null });
                    forgetDemoClear();
                    return setStep("under13");
                  }
                  // R2-08: a landing demo clear from this tab (checked against the board) is the first clear.
                  const demo = readDemoClear();
                  if (demo && !clear.current && analyze(TUTORIAL_PUZZLE, demo.state).clear) {
                    clear.current = { state: demo.state, ms: demo.ms };
                    setClearMs(demo.ms);
                    setDemoCleared(true);
                  }
                  setStep("start");
                }}
              >
                <BirthPicker
                  value={birth}
                  error={birthError}
                  onChange={(b) => {
                    setBirth(b);
                    setBirthError(null);
                  }}
                />
                <p className="text-muted flex items-center justify-center gap-1.5 text-center text-[14px] text-balance">
                  <Icon name="lock-simple" size={16} className="flex-none" />
                  {ageCopy.lockedNote}
                </p>
                <Button
                  type="submit"
                  size="lg"
                  className="mt-auto w-full text-[17px]"
                  disabled={!birth.year || !birth.month}
                  aria-label={ageCopy.continueLabel}
                >
                  {ageCopy.continue}
                </Button>
                {first === "age" && deepLink && !signedIn && (
                  <button
                    type="button"
                    onClick={() => setStep("hello")}
                    className="press text-muted min-h-11 text-center text-[15px] font-semibold underline-offset-4 hover:underline"
                  >
                    {copy.welcome.playedBefore}
                  </button>
                )}
              </form>
            </Screen>
          )}

          {step === "under13" && (
            <Screen key="under13">
              <div className="mt-16 flex justify-center">
                <Spuz mood="sad" size={150} decorative />
              </div>
              <h1 className="font-display text-center text-[28px] leading-[1.1] font-black">{ageCopy.under13Title}</h1>
              <p className="text-muted text-center text-[16px] leading-normal">{ageCopy.under13Body}</p>
              <Button size="lg" variant="secondary" className="mt-auto w-full" onClick={() => setStep("hello")}>
                {ageCopy.back}
              </Button>
            </Screen>
          )}

          {step === "start" && (
            <Screen key="start">
              <Progress n={progress} />
              <div className="flex items-end gap-3">
                <Spuz mood="wave" size={96} decorative />
                <h1 className="font-display mb-2 text-[28px] leading-[1.1] font-black tracking-[-0.02em] text-balance">{W.startTitle}</h1>
              </div>
              {demoCleared && (
                <p
                  role="status"
                  className="bg-surface-raised flex items-center gap-2.5 rounded-[16px] px-4 py-3 text-[15px] leading-snug font-semibold"
                >
                  <Icon name="check-circle" size={20} className="text-accent flex-none" />
                  {W.demoCounted}
                </p>
              )}
              <div className="flex flex-col gap-2.5">
                {(demoCleared ? STARTS_AFTER_DEMO : STARTS).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      if (o.id === "tutorial") {
                        setDest("/");
                        setStep("tutorial");
                      } else {
                        setDest(o.id === "pick" ? "/library" : o.id === "more" ? "/play/crownfall" : "/");
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
              <p className="text-muted mt-auto text-center text-[14px]">{W.startLater}</p>
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
              <div className="mt-2 flex justify-center" style={{ ["--world" as string]: "var(--accent)" }}>
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

          {step === "nickname" && (
            <Screen key="nickname">
              <Progress n={progress} />
              {clearMs > 0 && <ClearBanner ms={clearMs} />}
              <h1 className="font-display text-[28px] leading-[1.1] font-black tracking-[-0.02em]">
                {clearMs > 0 ? W.makeYoursAfterClear : W.makeYours}
              </h1>
              {signedIn && (
                <p className="text-accent -mt-2 flex items-center gap-1.5 text-[14px] font-semibold">
                  <Icon name="check-circle" size={16} />
                  {copy.welcome.signedInNote}
                </p>
              )}
              <div
                className="bg-surface flex items-center justify-center self-center rounded-full"
                style={{ width: clearMs > 0 ? 150 : 220, height: clearMs > 0 ? 150 : 220 }}
              >
                <Spuz mood={clearMs > 0 ? "cheer" : "proud"} size={clearMs > 0 ? 130 : 190} color={color} decorative />
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
                {saving ? W.saving : dest === "/library" ? W.ctaLibrary : dest === "/play/crownfall" ? W.ctaCrownfall : W.ctaMap}
              </Button>
            </Screen>
          )}
        </AnimatePresence>
      </Dir.Provider>
    </main>
  );
}

const STEP_ORDER: Record<Step, number> = { hello: 0, signin: 1, age: 1, under13: 2, start: 2, tutorial: 3, nickname: 4 };
const Dir = createContext(1);
const SCREEN = {
  enter: (d: number) => ({ opacity: 0, transform: `translateX(${24 * d}px)` }),
  center: { opacity: 1, transform: "translateX(0px)" },
  exit: (d: number) => ({ opacity: 0, transform: `translateX(${-24 * d}px)`, transition: { duration: 0.15, ease: EASE_OUT } }),
};

function Screen({ children }: { children: React.ReactNode }) {
  const dir = useContext(Dir);
  return (
    <motion.section
      className="flex min-h-dvh flex-col gap-4 px-5 pt-[60px] pb-7"
      custom={dir}
      variants={SCREEN}
      initial="enter"
      animate="center"
      exit="exit"
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
/** SPZ-15: the first-clear party, merged into "Make Spuz yours" so the lesson flows straight into naming. */
function ClearBanner({ ms }: { ms: number }) {
  const reduce = useReducedMotion();
  const instant = !!reduce;
  return (
    <motion.div
      className="bg-surface-raised relative flex flex-col items-center gap-2 overflow-hidden rounded-[24px] px-4 pt-4 pb-3.5"
      initial={instant ? false : { opacity: 0, transform: "scale(0.94)" }}
      animate={{ opacity: 1, transform: "scale(1)" }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      role="status"
    >
      {!instant && (
        <motion.div
          aria-hidden
          className="absolute top-1/2 left-1/2 -mt-[90px] -ml-[90px] size-[180px] rounded-full"
          style={{ boxShadow: "0 0 0 6px var(--accent)" }}
          initial={{ opacity: 0.9, transform: "scale(0.3)" }}
          animate={{ opacity: 0, transform: "scale(1.8)" }}
          transition={{ duration: 1.1, ease: EASE_OUT }}
        />
      )}
      <p className="font-display text-[28px] leading-none font-black tracking-[-0.03em]">{W.firstClear}</p>
      <p className="text-center text-[15px] font-semibold">{W.firstClearLine(formatClock(ms))}</p>
      <div className="flex gap-2">
        <Tile v="+150" c="var(--accent)" l="XP" d={0.25} instant={instant} />
        <Tile v="+50" c="var(--gold)" l="Sparks" d={0.4} instant={instant} />
        <Tile v="1" c="var(--gold)" l="Streak" icon="fire" d={0.55} instant={instant} />
      </div>
    </motion.div>
  );
}

function Tile({ v, c, l, icon, d, instant }: { v: string; c: string; l: string; icon?: string; d: number; instant: boolean }) {
  return (
    <motion.div
      className="bg-surface flex flex-col items-center rounded-[16px] px-3.5 py-2"
      initial={instant ? false : { opacity: 0, transform: "translateY(12px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ delay: instant ? 0 : d, duration: 0.4, ease: EASE_OUT }}
      onAnimationComplete={() => {
        if (instant) return;
        if (l === "XP") play("reward");
        if (l === "Streak") play("streak");
      }}
    >
      <span className="num flex items-center gap-1 text-[20px] font-semibold" style={{ color: c }}>
        {icon && <Icon name={icon} size={22} />}
        {v}
      </span>
      <span className="text-muted text-[13px] font-medium">{l}</span>
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
