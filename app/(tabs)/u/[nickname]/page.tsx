"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccept, useAddFriend, useBlock, usePlayer, useRemoveFriend, useUnblock } from "@/lib/client/social";
import { HttpError } from "@/lib/client/api";
import { TabPage } from "@/components/meta/TabPage";
import { BackButton, EmptyState, ErrorState, ListSkeleton, StatCard } from "@/components/meta/ui";
import { Sheet } from "@/components/meta/Sheet";
import { ReportSheet } from "@/components/meta/ReportSheet";
import { SpuzWear } from "@/components/meta/SpuzWear";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { GAME_BY_ID } from "@/lib/catalog";

/** S3 Friend profile: public subset only. Under-16s show nickname and avatar only. */
export default function PlayerPage({ params }: PageProps<"/u/[nickname]">) {
  const { nickname } = use(params);
  const name = decodeURIComponent(nickname);
  const router = useRouter();
  const q = usePlayer(name);
  const add = useAddFriend();
  const accept = useAccept();
  const remove = useRemoveFriend();
  const block = useBlock();
  const unblock = useUnblock();
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [blockedId, setBlockedId] = useState<string | null>(null);
  const p = q.data;

  useEffect(() => {
    if (p?.relation === "self") router.replace("/me");
  }, [p?.relation, router]);

  return (
    <TabPage label={`${name}'s profile`}>
      <div className="flex justify-between">
        <BackButton />
        {p && (
          <button
            aria-label="More"
            onClick={() => setMenu(true)}
            className="press bg-surface-raised flex size-11 items-center justify-center rounded-[14px]"
          >
            <Icon name="dots-three" size={20} />
          </button>
        )}
      </div>
      {blockedId ? (
        <EmptyState
          mood="sleepy"
          title={`You blocked ${name}`}
          body="They can't find you, add you or see your activity."
          action={
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => unblock.mutate(blockedId, { onSuccess: () => setBlockedId(null) })}
            >
              Unblock
            </Button>
          }
        />
      ) : q.isError ? (
        q.error instanceof HttpError && q.error.status === 404 ? (
          <EmptyState mood="shocked" title="No Spuzler with that name" body="They may have changed their name or left SPUZL." />
        ) : (
          <ErrorState onRetry={() => q.refetch()} />
        )
      ) : !p ? (
        <ListSkeleton rows={3} height={80} />
      ) : (
        <>
          <div className="flex flex-col items-center gap-2">
            <div
              className="bg-surface relative flex size-[120px] items-center justify-center rounded-[36px]"
              style={{ boxShadow: `0 0 0 4px ${p.color}` }}
            >
              <SpuzWear size={106} color={p.color} hat={p.hat} label={`${p.nickname}'s Spuz`} />
              {p.presence?.online && (
                <span
                  aria-hidden
                  className="bg-accent absolute -right-1 -bottom-1 size-5 rounded-full"
                  style={{ boxShadow: "0 0 0 4px var(--bg)" }}
                />
              )}
            </div>
            <h1 className="font-display text-[22px] font-black">{p.nickname}</h1>
            {p.presence ? (
              <p className="text-muted flex items-center gap-1.5 text-[15px] font-medium">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: p.presence.online ? "var(--accent)" : "var(--text-muted)" }}
                />
                {p.presence.label}
              </p>
            ) : p.title ? (
              <p className="text-muted text-[15px] font-medium">{p.title}</p>
            ) : null}
          </div>

          {p.public && p.versus && (
            <section aria-label={`You vs ${p.nickname}`} className="bg-surface flex flex-col gap-3 rounded-[20px] p-4">
              <h2 className="text-[16px] font-bold">You vs {p.nickname}</h2>
              <div className="flex items-center gap-3">
                <span className="num text-accent text-[32px] font-semibold">{p.versus.me}</span>
                <div className="relative h-3 flex-1 overflow-hidden rounded-[6px]" style={{ background: "var(--w-shape)" }} aria-hidden>
                  <div
                    className="bg-accent absolute inset-0 origin-left"
                    style={{ transform: `scaleX(${p.versus.me + p.versus.them ? p.versus.me / (p.versus.me + p.versus.them) : 0.5})` }}
                  />
                </div>
                <span className="num text-[32px] font-semibold" style={{ color: "var(--w-shape)" }}>
                  {p.versus.them}
                </span>
              </div>
              <div className="text-muted flex justify-between gap-3 text-[14px] font-medium">
                <span>Duel wins</span>
                {(p.versus.myBest || p.versus.theirBest) && (
                  <span className="text-right">
                    {p.versus.myBest ? `Your best: ${GAME_BY_ID[p.versus.myBest]?.name}` : ""}
                    {p.versus.myBest && p.versus.theirBest ? " · " : ""}
                    {p.versus.theirBest ? `${p.nickname}'s: ${GAME_BY_ID[p.versus.theirBest]?.name}` : ""}
                  </span>
                )}
              </div>
            </section>
          )}

          {p.public ? (
            <div className="grid grid-cols-3 gap-2">
              <StatCard value={p.streak ?? 0} label="day streak" color="var(--gold)" />
              <StatCard value={p.clears ?? 0} label="clears" />
              <StatCard value={p.league ? p.league.split(" ")[0] : "None"} label="league" color="var(--gold)" />
            </div>
          ) : (
            <p className="text-muted bg-surface rounded-[16px] px-3.5 py-3 text-center text-[14px]">This profile is private.</p>
          )}

          <div className="mt-auto grid grid-cols-2 gap-2.5 pt-6">
            {p.relation === "friend" ? (
              <>
                <Link
                  href={`/duel?friend=${encodeURIComponent(p.nickname)}`}
                  className="toy bg-accent text-on-accent font-display flex h-[60px] items-center justify-center gap-2 rounded-[20px] text-[16px] font-black"
                  style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
                >
                  <Icon name="sword" size={18} />
                  Duel
                </Link>
                <Link
                  href={`/play/${p.versus?.theirBest ?? "crownfall"}`}
                  className="toy bg-surface-raised font-display flex h-[60px] items-center justify-center gap-2 rounded-[20px] text-[16px] font-extrabold"
                >
                  <Icon name="timer" size={18} />
                  Beat time
                </Link>
              </>
            ) : p.relation === "incoming" ? (
              <Button
                size="lg"
                className="col-span-2"
                icon="check"
                loading={accept.isPending}
                onClick={() => accept.mutate(p.id, { onSuccess: () => q.refetch() })}
              >
                Accept friend request
              </Button>
            ) : p.relation === "requested" ? (
              <Button size="lg" variant="secondary" className="col-span-2" disabled icon="hourglass">
                Request sent
              </Button>
            ) : p.minor ? (
              <p className="text-muted col-span-2 text-center text-[14px]">Players under 16 add friends with an invite link or QR code.</p>
            ) : (
              <Button
                size="lg"
                className="col-span-2"
                icon="user-plus"
                loading={add.isPending}
                onClick={() => add.mutate(p.nickname, { onSuccess: () => q.refetch() })}
              >
                Add friend
              </Button>
            )}
          </div>

          <Sheet open={menu} onOpenChange={setMenu} title={p.nickname}>
            <div className="flex flex-col gap-2">
              {p.relation === "friend" && (
                <button
                  onClick={() => remove.mutate(p.id, { onSuccess: () => (setMenu(false), q.refetch()) })}
                  className="press bg-surface-raised flex h-[52px] items-center gap-3 rounded-[14px] px-3.5 text-[15px] font-semibold"
                >
                  <Icon name="user" size={20} />
                  Remove friend
                </button>
              )}
              <button
                onClick={() => {
                  setMenu(false);
                  setReport(true);
                }}
                className="press bg-surface-raised flex h-[52px] items-center gap-3 rounded-[14px] px-3.5 text-[15px] font-semibold"
              >
                <Icon name="flag" size={20} />
                Report
              </button>
              <button
                onClick={() =>
                  block.mutate(p.id, {
                    onSuccess: () => {
                      setMenu(false);
                      setBlockedId(p.id);
                    },
                  })
                }
                className="press flex h-[52px] items-center gap-3 rounded-[14px] px-3.5 text-[15px] font-semibold"
                style={{ background: "var(--danger-tint)", color: "var(--danger)" }}
              >
                <Icon name="prohibit" size={20} />
                Block
              </button>
            </div>
          </Sheet>
          <ReportSheet
            target={report ? { id: p.id, nickname: p.nickname } : null}
            onClose={() => setReport(false)}
            onDone={(blocked) => blocked && setBlockedId(p.id)}
          />
        </>
      )}
    </TabPage>
  );
}
