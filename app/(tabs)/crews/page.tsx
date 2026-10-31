"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCreateCrew, useJoinCrew, useMyCrew } from "@/lib/client/social";
import { HttpError } from "@/lib/client/api";
import { TabPage } from "@/components/meta/TabPage";
import { BackButton, ErrorState, ListSkeleton } from "@/components/meta/ui";
import { Spuz } from "@/components/brand/Spuz";
import { Button } from "@/components/ui/Button";

/** Crews: create one or join by code. Members land on their crew page. */
export default function CrewsPage() {
  return (
    <Suspense>
      <Crews />
    </Suspense>
  );
}

const msg = (e: unknown) => (e instanceof HttpError && e.message !== e.code ? e.message : "That didn't work. Try again.");

function Crews() {
  const router = useRouter();
  const params = useSearchParams();
  const mine = useMyCrew();
  const create = useCreateCrew();
  const join = useJoinCrew();
  const [name, setName] = useState("");
  const [code, setCode] = useState(params.get("code") ?? "");
  const [err, setErr] = useState<{ where: "create" | "join"; text: string } | null>(null);

  useEffect(() => {
    if (mine.data?.crew) router.replace(`/crews/${mine.data.crew.id}`);
  }, [mine.data, router]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await create.mutateAsync(name.trim());
      router.push(`/crews/${r.id}`);
    } catch (x) {
      setErr({ where: "create", text: msg(x) });
    }
  };
  const onJoin = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await join.mutateAsync(code.trim());
      router.push(`/crews/${r.id}`);
    } catch (x) {
      setErr({ where: "join", text: msg(x) });
    }
  };

  return (
    <TabPage label="Crews">
      <div className="flex items-center gap-3">
        <BackButton href="/friends" />
        <h1 className="font-display text-[22px] font-black">Crews</h1>
      </div>
      {mine.isPending || mine.data?.crew ? (
        <ListSkeleton rows={3} height={64} />
      ) : mine.isError ? (
        <ErrorState onRetry={() => mine.refetch()} />
      ) : (
        <>
          <div className="flex items-center gap-3 py-2">
            <Spuz mood="wave" size={84} decorative />
            <p className="text-[15px] leading-snug font-medium text-pretty">
              A crew is up to 20 Spuzlers. Every clear adds XP to your crew, and each week you clash with another crew.
            </p>
          </div>
          <form onSubmit={onJoin} className="bg-surface flex flex-col gap-3 rounded-[20px] p-4">
            <label htmlFor="crew-code" className="text-[16px] font-bold">
              Join with a code
            </label>
            <input
              id="crew-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
              placeholder="K7QXPM"
              autoCapitalize="characters"
              autoComplete="off"
              className="num bg-surface-raised placeholder:text-muted h-12 rounded-[14px] px-3.5 text-[18px] font-semibold tracking-[0.15em] outline-none"
            />
            {err?.where === "join" && (
              <p role="alert" className="text-danger text-[14px]">
                {err.text}
              </p>
            )}
            <Button type="submit" disabled={code.length < 4} loading={join.isPending}>
              Join crew
            </Button>
          </form>
          <form onSubmit={onCreate} className="bg-surface flex flex-col gap-3 rounded-[20px] p-4">
            <label htmlFor="crew-name" className="text-[16px] font-bold">
              Start a crew
            </label>
            <input
              id="crew-name"
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 24))}
              placeholder="Shito Squad"
              autoComplete="off"
              className="bg-surface-raised placeholder:text-muted h-12 rounded-[14px] px-3.5 text-[16px] font-medium outline-none"
            />
            <p className="text-muted text-[13px]">3 to 24 letters, numbers or spaces. Keep it friendly, a human checks reports.</p>
            {err?.where === "create" && (
              <p role="alert" className="text-danger text-[14px]">
                {err.text}
              </p>
            )}
            <Button type="submit" variant="secondary" disabled={name.trim().length < 3} loading={create.isPending}>
              Start crew
            </Button>
          </form>
        </>
      )}
    </TabPage>
  );
}
