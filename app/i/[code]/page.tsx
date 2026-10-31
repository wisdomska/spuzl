"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useMe, HttpError } from "@/lib/client/api";
import { useAcceptInvite } from "@/lib/client/social";
import { savePendingInvite } from "@/lib/client/invite";
import { readOnboarding } from "@/lib/client/onboarding";
import { Spuz } from "@/components/brand/Spuz";
import { Wordmark } from "@/components/brand/Wordmark";

/** Invite link and QR target: opening it makes you friends with whoever shared it (FR-SO-01). */
export default function InvitePage({ params }: PageProps<"/i/[code]">) {
  const { code } = use(params);
  const me = useMe();
  const accept = useAcceptInvite();
  const tried = useRef(false);
  const [who, setWho] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!me.isSuccess || tried.current) return;
    tried.current = true;
    if (!me.data) {
      savePendingInvite(code);
      return;
    }
    accept
      .mutateAsync(code)
      .then((r) => setWho(r.nickname))
      .catch((e) => setErr(e instanceof HttpError && e.message !== e.code ? e.message : "That invite didn't work."));
  }, [me.isSuccess, me.data, code, accept]);

  const start = readOnboarding().introSeen ? "/welcome" : "/intro";
  const cta = "toy bg-accent text-on-accent font-display flex h-[60px] w-full items-center justify-center rounded-[20px] text-[16px] font-black";

  return (
    <main className="safe-top dotgrid flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Wordmark size={40} />
      {me.isPending || (me.data && !who && !err) ? (
        <Spuz mood="thinking" size={120} decorative />
      ) : !me.data ? (
        <>
          <Spuz mood="wave" size={140} decorative />
          <h1 className="font-display text-[24px] font-black text-balance">You&apos;re invited. Pick your Spuz and you&apos;re friends.</h1>
          <p className="text-muted max-w-[320px] text-[15px]">Free daily puzzles and games. Takes 30 seconds, no sign-up needed.</p>
          <Link href={start} className={`${cta} max-w-[360px]`} style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}>
            Let&apos;s go
          </Link>
        </>
      ) : err ? (
        <>
          <Spuz mood="sad" size={130} decorative />
          <h1 className="font-display text-[22px] font-black">{err}</h1>
          <Link href="/friends" className={`${cta} max-w-[360px]`} style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}>
            Go to Friends
          </Link>
        </>
      ) : (
        <>
          <Spuz mood="cheer" size={140} decorative />
          <h1 className="font-display text-[24px] font-black" role="status">
            You and {who ?? "your friend"} are friends now.
          </h1>
          <Link href="/friends" className={`${cta} max-w-[360px]`} style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}>
            See your friends
          </Link>
        </>
      )}
    </main>
  );
}
