"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCups, useJoinCup, type CupDTO } from "@/lib/client/social";
import { HttpError } from "@/lib/client/api";
import { TabPage } from "@/components/meta/TabPage";
import { BackButton, ErrorState, ListSkeleton } from "@/components/meta/ui";
import { Spuz } from "@/components/brand/Spuz";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { GAME_BY_ID } from "@/lib/catalog";
import { shortDate } from "@/lib/meta";

function CupRow({ c, teacher }: { c: CupDTO; teacher?: boolean }) {
  return (
    <Link href={`/school-cup/${c.id}`} className="bg-surface flex items-center gap-3 rounded-[16px] px-3.5 py-3">
      <Icon name={teacher ? "users-three" : "graduation-cap"} size={22} className="text-accent shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">
          {c.className}
          {c.school ? ` · ${c.school}` : ""}
        </span>
        <span className="text-muted truncate text-[13px]">
          {shortDate(c.weekStart)} to {shortDate(c.endsOn ?? c.weekStart)} · {c.games.map((g) => GAME_BY_ID[g]?.name ?? g).join(", ")}
        </span>
      </span>
      <Icon name="caret-right" size={16} className="text-muted" />
    </Link>
  );
}

/** School Cup hub: join a class with the teacher's code, see your cups, or set one up (signed-in adults). */
export default function SchoolCupPage() {
  return (
    <Suspense>
      <SchoolCup />
    </Suspense>
  );
}

function SchoolCup() {
  const router = useRouter();
  const params = useSearchParams();
  const q = useCups();
  const join = useJoinCup();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [err, setErr] = useState<string | null>(null);
  const onJoin = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await join.mutateAsync(code);
      router.push(`/school-cup/${r.id}`);
    } catch (x) {
      setErr(x instanceof HttpError && x.message !== x.code ? x.message : "That didn't work. Try again.");
    }
  };
  return (
    <TabPage label="School Cup">
      <div className="flex items-center gap-3">
        <BackButton href="/friends" />
        <h1 className="font-display text-[22px] font-black">School Cup</h1>
      </div>
      <div className="flex items-center gap-3 py-1">
        <Spuz mood="proud" size={80} decorative />
        <p className="text-[15px] leading-snug font-medium text-pretty">
          Your class against the clock. Your teacher picks the games, everyone plays, the board fills up all week.
        </p>
      </div>
      <form onSubmit={onJoin} className="bg-surface flex flex-col gap-3 rounded-[20px] p-4">
        <label htmlFor="cup-code" className="text-[16px] font-bold">
          Join your class
        </label>
        <input
          id="cup-code"
          value={code}
          onChange={(e) =>
            setCode(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 8),
            )
          }
          placeholder="Class code"
          autoCapitalize="characters"
          autoComplete="off"
          className="num bg-surface-raised placeholder:text-muted h-12 rounded-[14px] px-3.5 text-[18px] font-semibold tracking-[0.15em] outline-none"
        />
        {err && (
          <p role="alert" className="text-danger text-[14px]">
            {err}
          </p>
        )}
        <Button type="submit" disabled={code.length < 4} loading={join.isPending}>
          Join class
        </Button>
      </form>
      {q.isPending ? (
        <ListSkeleton rows={2} height={64} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <>
          {q.data.joined.length > 0 && (
            <section aria-label="Your classes" className="flex flex-col gap-2">
              <h2 className="text-[15px] font-bold">Your classes</h2>
              {q.data.joined.map((c) => (
                <CupRow key={c.id} c={c} />
              ))}
            </section>
          )}
          <section aria-label="For teachers" className="flex flex-col gap-2 pt-2">
            <h2 className="text-[15px] font-bold">For teachers</h2>
            {q.data.teaching.map((c) => (
              <CupRow key={c.id} c={c} teacher />
            ))}
            {q.data.canTeach ? (
              <Link
                href="/school-cup/new"
                className="toy bg-surface-raised font-display flex h-14 items-center justify-center gap-2 rounded-[18px] text-[15px] font-extrabold"
              >
                <Icon name="plus" size={18} />
                Set up a class challenge
              </Link>
            ) : (
              <p className="text-muted bg-surface rounded-[16px] px-3.5 py-3 text-[14px]">
                Teachers sign in with an adult account to set up a class challenge.{" "}
                <Link href="/settings#account" className="text-accent font-semibold">
                  Sign in
                </Link>
              </p>
            )}
          </section>
        </>
      )}
    </TabPage>
  );
}
