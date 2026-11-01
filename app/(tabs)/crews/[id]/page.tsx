"use client";

import { InviteShare } from "@/components/share/InviteShare";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useCrew, useLeaveCrew } from "@/lib/client/social";
import { TabPage } from "@/components/meta/TabPage";
import { AvatarChip, BackButton, EmptyState, ErrorState, Hex, ListSkeleton } from "@/components/meta/ui";
import { Sheet } from "@/components/meta/Sheet";
import { Qr } from "@/components/meta/Qr";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatNumber } from "@/lib/format";
import { formatLeft } from "@/lib/leagues";

/** C1 Crew page + crew clash: weekly XP vs the paired crew, the members' carry, crew race and invite. */
export default function CrewPage({ params }: PageProps<"/crews/[id]">) {
  const { id } = use(params);
  const router = useRouter();
  const q = useCrew(id);
  const leave = useLeaveCrew();
  const [invite, setInvite] = useState(false);
  const [all, setAll] = useState(false);
  const c = q.data;
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const link = c?.code ? `${site}/crews?code=${c.code}` : "";
  const lead = c?.clash ? c.clash.us - c.clash.them : 0;

  return (
    <TabPage label="Crew">
      <BackButton href="/friends" />
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !c ? (
        <ListSkeleton rows={5} />
      ) : (
        <>
          <header className="flex items-center gap-3.5">
            <Hex w={72} h={80} bg={c.color} inner={56} innerBg="var(--bg)">
              <Icon name="pepper" size={28} style={{ color: c.color }} />
            </Hex>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h1 className="font-display truncate text-[22px] font-black">{c.name}</h1>
              <p className="text-muted text-[14px] font-medium">
                {c.size} of {c.max}
                {c.city ? ` · ${c.city}` : ""}
              </p>
            </div>
          </header>

          {c.clash ? (
            <section aria-label="Crew clash" className="bg-surface flex flex-col gap-3 rounded-[24px] p-4">
              <div className="flex justify-between text-[14px] font-semibold">
                <span>Crew clash · week {c.clash.week}</span>
                <span className="num text-muted">{formatLeft(c.clash.endsInMs)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
                <div className="flex min-w-0 flex-col items-center gap-1">
                  <span className="font-display max-w-full truncate text-[15px] font-extrabold">{c.name}</span>
                  <span className="num text-accent text-[30px] font-semibold">{formatNumber(c.clash.us)}</span>
                </div>
                <span className="font-display text-muted text-[16px] font-black">vs</span>
                <div className="flex min-w-0 flex-col items-center gap-1">
                  <span className="font-display max-w-full truncate text-[15px] font-extrabold">{c.clash.opponent}</span>
                  <span className="num text-[30px] font-semibold">{formatNumber(c.clash.them)}</span>
                </div>
              </div>
              <div className="relative h-3.5 overflow-hidden rounded-[7px]" style={{ background: "var(--w-shape)" }} aria-hidden>
                <div
                  className="bg-accent absolute inset-0 origin-left transition-transform duration-500"
                  style={{ transform: `scaleX(${c.clash.us + c.clash.them ? c.clash.us / (c.clash.us + c.clash.them) : 0.5})` }}
                />
              </div>
              <p className="text-muted text-[14px] font-medium">
                Every clear by a member adds XP.{" "}
                {lead > 0
                  ? `Up ${formatNumber(lead)}. Don't sleep.`
                  : lead < 0
                    ? `Down ${formatNumber(-lead)}. Time to carry.`
                    : "Dead level. Make the next clear count."}
              </p>
            </section>
          ) : (
            <p className="bg-surface text-muted rounded-[20px] p-4 text-[14px]">
              No crew to clash with yet this week. As soon as another crew is free, you&apos;re paired up.
            </p>
          )}

          <div className="flex justify-between">
            <h2 className="text-[15px] font-bold">This week&apos;s carry</h2>
            {c.carry.length > 5 && (
              <button onClick={() => setAll(!all)} className="text-accent text-[14px] font-medium">
                {all ? "Top 5" : "All members"}
              </button>
            )}
          </div>
          {c.carry.length === 0 ? (
            <EmptyState mood="sleepy" title="Nobody yet" />
          ) : (
            <ol className="flex flex-col gap-[3px]">
              {(all ? c.carry : c.carry.slice(0, 5)).map((r) => (
                <li key={r.id}>
                  <Link
                    href={r.me ? "/me" : `/u/${r.nickname}`}
                    className="flex h-12 items-center gap-2.5 rounded-[12px] px-2.5"
                    style={{ background: r.me ? "var(--success-tint)" : "var(--surface)" }}
                    aria-label={`${r.pos}, ${r.me ? "you" : r.nickname}, ${formatNumber(r.xp)} XP this week`}
                  >
                    <span className="num text-muted w-5 text-[14px] font-semibold">{r.pos}</span>
                    <AvatarChip nickname={r.nickname} color={r.color} size={30} radius={9} />
                    <span className={`flex-1 truncate text-[15px] ${r.me ? "font-bold" : "font-medium"}`}>{r.me ? "You" : r.nickname}</span>
                    <span className="num text-[15px] font-semibold">{formatNumber(r.xp)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}

          {c.member && (
            <>
              <div className="grid grid-cols-2 gap-2.5 pt-3">
                <Link
                  href={`/party?crew=${c.id}`}
                  className="toy bg-accent text-on-accent font-display flex h-14 items-center justify-center rounded-[18px] text-[15px] font-extrabold"
                  style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
                >
                  Crew race
                </Link>
                <Button variant="secondary" className="h-14" onClick={() => setInvite(true)}>
                  Invite
                </Button>
              </div>
              <button
                onClick={() => leave.mutate(undefined, { onSuccess: () => router.replace("/crews") })}
                className="text-muted mx-auto h-11 px-3 text-[14px] font-medium"
              >
                Leave crew
              </button>
            </>
          )}

          <Sheet
            open={invite}
            onOpenChange={setInvite}
            title="Bring your people"
            description="Share the code or the link. Up to 20 in a crew."
          >
            <div className="flex flex-col items-center gap-3">
              <span className="font-display text-accent text-[34px] font-black tracking-[0.12em]">{c.code}</span>
              {link && (
                <div className="rounded-[18px] p-3" style={{ background: "#F4F5FB" }}>
                  <Qr value={link} size={168} label={`QR code to join ${c.name}`} />
                </div>
              )}
              <InviteShare
                url={link}
                text={`Join my SPUZL crew ${c.name}. Code ${c.code}: ${link}`}
                title="Invite to your crew"
                iconSize={18}
                className="toy bg-accent text-on-accent font-display flex h-14 w-full items-center justify-center gap-2 rounded-[18px] text-[15px] font-extrabold"
                style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
              />
            </div>
          </Sheet>
        </>
      )}
    </TabPage>
  );
}
