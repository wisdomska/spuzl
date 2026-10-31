"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCreateCup, useCups } from "@/lib/client/social";
import { HttpError, useMe } from "@/lib/client/api";
import { TabPage } from "@/components/meta/TabPage";
import { BackButton, ListSkeleton, Switch } from "@/components/meta/ui";
import { Qr } from "@/components/meta/Qr";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { GAMES, LAUNCH_IDS, WORLD_BY_ID, type GameMeta } from "@/lib/catalog";
import { CLASSROOM_GAMES, MAX_CUP_GAMES, addDays, nextMonday, shortDate } from "@/lib/meta";
import { gmtDate } from "@/lib/format";

const ordered = (gs: GameMeta[]) => [...gs].sort((a, b) => Number(LAUNCH_IDS.includes(b.id)) - Number(LAUNCH_IDS.includes(a.id)));

/** T1 Teacher setup, 3 steps: class and school code, games and run, share with the class. */
export default function NewCupPage() {
  const me = useMe();
  const cups = useCups();
  const create = useCreateCup();
  const today = gmtDate();
  const [step, setStep] = useState(1);
  const [school, setSchool] = useState("");
  const [klass, setKlass] = useState("");
  const [games, setGames] = useState<string[]>(["crownfall", "quads", "deadon"].filter((g) => CLASSROOM_GAMES.some((c) => c.id === g)));
  const mondays = useMemo(() => Array.from({ length: 4 }, (_, i) => addDays(nextMonday(today), 7 * i)), [today]);
  const thisMonday = addDays(today, -((new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7));
  const starts = thisMonday < today ? [thisMonday, ...mondays] : mondays;
  const [start, setStart] = useState(starts[0]);
  const [endOffset, setEndOffset] = useState(4);
  const [relaxed, setRelaxed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [made, setMade] = useState<{ id: string; code: string } | null>(null);
  const [more, setMore] = useState(false);
  const allowed = ordered(CLASSROOM_GAMES);
  const shown = more ? allowed : allowed.slice(0, 8);
  const hiddenExample = GAMES.find((g) => g.id === "gotcha");

  const toggle = (id: string) =>
    setGames((g) => (g.includes(id) ? g.filter((x) => x !== id) : g.length >= MAX_CUP_GAMES ? g : [...g, id]));

  const submit = async () => {
    setErr(null);
    try {
      const r = await create.mutateAsync({ schoolCode: school, className: klass.trim(), games, weekStart: start, endsOn: addDays(start, endOffset), relaxed });
      setMade(r);
      setStep(3);
    } catch (x) {
      setErr(x instanceof HttpError && x.message !== x.code ? x.message : "That didn't save. Try again.");
      if (x instanceof HttpError && x.code === "school") setStep(1);
    }
  };

  const link = made && typeof window !== "undefined" ? `${window.location.origin}/school-cup?code=${made.code}` : "";

  if (cups.isPending || !me.data) return <TabPage label="Class challenge"><ListSkeleton rows={5} height={60} /></TabPage>;
  if (!cups.data?.canTeach)
    return (
      <TabPage label="Class challenge">
        <BackButton href="/school-cup" />
        <p className="bg-surface rounded-[16px] p-4 text-[15px]">
          Teachers sign in with an adult account to set up a class challenge.{" "}
          <Link href="/settings#account" className="text-accent font-semibold">
            Sign in
          </Link>
        </p>
      </TabPage>
    );

  return (
    <TabPage label="Class challenge">
      <div className="flex items-center gap-3">
        {step === 2 ? (
          <button aria-label="Back" onClick={() => setStep(1)} className="press bg-surface-raised flex size-11 shrink-0 items-center justify-center rounded-[14px]">
            <Icon name="arrow-left" size={20} />
          </button>
        ) : (
          <BackButton href="/school-cup" />
        )}
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-[20px] font-black">Class challenge</h1>
          <p className="text-muted truncate text-[14px] font-medium">
            {me.data.nickname}
            {klass ? ` · ${klass}` : ""}
          </p>
        </div>
      </div>
      <div className="flex gap-1.5" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step}>
        {[1, 2, 3].map((s) => (
          <span key={s} className="h-1.5 flex-1 rounded-[3px]" style={{ background: s <= step ? "var(--accent)" : "var(--line)" }} />
        ))}
      </div>

      {step === 1 && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setStep(2);
          }}
        >
          <h2 className="text-[17px] font-bold">Your class</h2>
          <label className="flex flex-col gap-1.5">
            <span className="text-[15px] font-semibold">School code</span>
            <input
              value={school}
              onChange={(e) => setSchool(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
              placeholder="From your school's SPUZL letter"
              autoCapitalize="characters"
              className="num bg-surface placeholder:text-muted h-12 rounded-[14px] px-3.5 text-[16px] font-semibold tracking-[0.1em] outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[15px] font-semibold">Class</span>
            <input
              value={klass}
              onChange={(e) => setKlass(e.target.value.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 24))}
              placeholder="Form 2B"
              className="bg-surface placeholder:text-muted h-12 rounded-[14px] px-3.5 text-[16px] font-medium outline-none"
            />
          </label>
          <p className="text-muted text-[13px]">Only verified schools can run a School Cup. Students see first names only, never where they live.</p>
          {err && (
            <p role="alert" className="text-danger text-[14px]">
              {err}
            </p>
          )}
          <Button size="lg" type="submit" className="mt-2 w-full" disabled={school.length < 4 || !klass.trim()}>
            Next: pick games
          </Button>
        </form>
      )}

      {step === 2 && (
        <>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold">Pick this week&apos;s games</h2>
            <span className="text-muted num text-[13px]">
              {games.length} of {MAX_CUP_GAMES}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {shown.map((g) => {
              const on = games.includes(g.id);
              const w = WORLD_BY_ID[g.world];
              const full = !on && games.length >= MAX_CUP_GAMES;
              return (
                <li key={g.id}>
                  <button
                    role="checkbox"
                    aria-checked={on}
                    aria-disabled={full}
                    onClick={() => toggle(g.id)}
                    className="flex h-[60px] w-full items-center gap-3 rounded-[16px] px-3 text-left"
                    style={{ background: on ? "var(--success-tint)" : "var(--surface)", boxShadow: on ? "inset 0 0 0 2px var(--accent)" : undefined, opacity: full ? 0.55 : 1 }}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px]" style={{ background: w.color, color: "#0E0F1A" }}>
                      <Icon name={g.icon} size={20} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[16px] font-semibold">{g.name}</span>
                      <span className="text-muted truncate text-[13px] font-medium">
                        {w.name} · {g.blurb}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="flex size-7 items-center justify-center rounded-[9px]"
                      style={{ background: on ? "var(--accent)" : "transparent", boxShadow: on ? undefined : "inset 0 0 0 2px var(--text-muted)", color: "#0E0F1A" }}
                    >
                      {on && <Icon name="check" size={16} />}
                    </span>
                  </button>
                </li>
              );
            })}
            {!more && (
              <li>
                <button onClick={() => setMore(true)} className="text-accent h-11 w-full text-[14px] font-semibold">
                  Show all {allowed.length} classroom games
                </button>
              </li>
            )}
            {hiddenExample && (
              <li className="bg-surface flex h-[60px] items-center gap-3 rounded-[16px] px-3 opacity-80" aria-disabled>
                <span className="bg-line text-muted flex size-10 items-center justify-center rounded-[12px]">
                  <Icon name={hiddenExample.icon} size={20} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-[16px] font-semibold">{hiddenExample.name}</span>
                  <span className="text-muted text-[13px] font-medium">Hidden in classroom mode, like all of Rage Ridge</span>
                </span>
                <span aria-hidden className="text-muted flex size-7 items-center justify-center rounded-[9px]" style={{ boxShadow: "inset 0 0 0 2px var(--text-muted)" }}>
                  <Icon name="minus" size={16} />
                </span>
              </li>
            )}
          </ul>
          <div className="mt-1 flex flex-col gap-2">
            <span className="text-[15px] font-bold">Runs</span>
            <div className="flex items-center gap-2">
              <label className="bg-surface relative flex h-12 flex-1 items-center justify-center rounded-[14px] text-[15px] font-semibold">
                <span className="sr-only">Starts</span>
                <select value={start} onChange={(e) => setStart(e.target.value)} className="h-full w-full appearance-none bg-transparent text-center outline-none">
                  {starts.map((m) => (
                    <option key={m} value={m} className="bg-surface">
                      {shortDate(m)}
                    </option>
                  ))}
                </select>
              </label>
              <Icon name="arrow-right" size={18} className="text-muted" />
              <label className="bg-surface relative flex h-12 flex-1 items-center justify-center rounded-[14px] text-[15px] font-semibold">
                <span className="sr-only">Ends</span>
                <select value={endOffset} onChange={(e) => setEndOffset(Number(e.target.value))} className="h-full w-full appearance-none bg-transparent text-center outline-none">
                  {[0, 1, 2, 3, 4, 5, 6].map((o) => (
                    <option key={o} value={o} className="bg-surface">
                      {shortDate(addDays(start, o))}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="bg-surface flex items-center justify-between rounded-[14px] px-3.5 py-3">
            <span className="text-[15px] font-semibold">Relaxed mode for everyone</span>
            <Switch checked={relaxed} onChange={setRelaxed} label="Relaxed mode for everyone" />
          </div>
          {err && (
            <p role="alert" className="text-danger text-[14px]">
              {err}
            </p>
          )}
          <Button size="lg" className="mt-2 w-full" disabled={!games.length} loading={create.isPending} onClick={submit}>
            Next: share with class
          </Button>
        </>
      )}

      {step === 3 && made && (
        <div className="flex flex-col items-center gap-4 pt-2">
          <h2 className="text-[17px] font-bold">Share with {klass}</h2>
          <p className="text-muted text-center text-[15px]">Students open SPUZL, go to Friends, School Cup, and enter this code. Or they scan.</p>
          <span className="font-display text-accent text-[40px] font-black tracking-[0.12em]">{made.code}</span>
          {link && (
            <div className="rounded-[20px] p-4" style={{ background: "#F4F5FB" }}>
              <Qr value={link} size={200} label="QR code to join the class challenge" />
            </div>
          )}
          <div className="grid w-full grid-cols-2 gap-2.5">
            <Link href={`/school-cup/${made.id}`} className="toy bg-surface-raised font-display flex h-14 items-center justify-center rounded-[18px] text-[15px] font-extrabold">
              Class board
            </Link>
            <Link
              href={`/school-cup/${made.id}/tv`}
              className="toy bg-accent text-on-accent font-display flex h-14 items-center justify-center gap-2 rounded-[18px] text-[15px] font-extrabold"
              style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
            >
              <Icon name="television" size={18} />
              TV mode
            </Link>
          </div>
        </div>
      )}
    </TabPage>
  );
}
