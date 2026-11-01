"use client";

import { InviteShare } from "@/components/share/InviteShare";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAccept, useAddFriend, useFeed, useFriends, useInvite, useReact, useRemoveFriend, type FeedItem } from "@/lib/client/social";
import { useMe, HttpError } from "@/lib/client/api";
import { TabPage } from "@/components/meta/TabPage";
import { AvatarChip, EmptyState, ErrorState, ListSkeleton, PageTitle, Segmented } from "@/components/meta/ui";
import { Sheet } from "@/components/meta/Sheet";
import { ReportSheet } from "@/components/meta/ReportSheet";
import { Qr } from "@/components/meta/Qr";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { BADGES } from "@/lib/gamification/badges";
import { REACTIONS, REACTION_GLYPH, REACTION_LABEL, agoShort, feedLine, isUnder16, type Reaction } from "@/lib/social";
import { play } from "@/lib/audio";

const badgeName = (id: string) => BADGES.find((b) => b.id === id)?.name;

/** F1 Friends + F2 Activity: invite (link, QR, share sheet), add by username, requests, presence, feed, report. */
export default function FriendsPage() {
  const [tab, setTab] = useState<"friends" | "activity">("friends");
  const me = useMe();
  const friends = useFriends(!!me.data);
  const total = friends.data?.friends.length ?? 0;
  return (
    <TabPage label="Friends">
      <PageTitle
        right={
          friends.data && total > 0 ? (
            <span className="text-muted text-[14px] font-medium">
              {friends.data.online} of {total} online
            </span>
          ) : undefined
        }
      >
        Friends
      </PageTitle>
      <Segmented
        label="Friends or activity"
        items={[
          { id: "friends", label: "Friends" },
          { id: "activity", label: "Activity" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "friends" ? <FriendsTab minor={isUnder16(me.data?.age_band)} /> : <ActivityTab />}
    </TabPage>
  );
}

function InviteCard() {
  const invite = useInvite();
  const [copied, setCopied] = useState(false);
  const [big, setBig] = useState(false);
  const url = invite.data?.url ?? "";
  const pretty = url.replace(/^https?:\/\//, "");
  const share = `Race me on SPUZL. Tap to be friends: ${url}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      play("pop");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the link is selectable on screen */
    }
  };
  return (
    <section aria-label="Your invite" className="bg-surface flex items-center gap-3 rounded-[22px] p-3.5">
      <button
        onClick={() => setBig(true)}
        disabled={!url}
        aria-label="Show QR code"
        className="press flex size-[84px] shrink-0 items-center justify-center rounded-[16px] p-2"
        style={{ background: "#F4F5FB" }}
      >
        {url ? <Qr value={url} size={68} label="QR code for your invite link" /> : null}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-[15px] font-semibold">Your invite</span>
        <span className="num text-accent truncate text-[14px] font-medium select-all">{pretty || " "}</span>
        <div className="flex gap-1.5">
          <InviteShare
            url={url}
            text={share}
            title="Invite friends"
            className="press bg-accent text-on-accent flex h-11 items-center gap-1.5 rounded-[10px] px-3 text-[14px] font-semibold"
          />
          <button
            onClick={copy}
            disabled={!url}
            className="press bg-surface-raised flex h-11 items-center gap-1.5 rounded-[10px] px-2.5 text-[14px] font-semibold"
          >
            <Icon name={copied ? "check" : "copy"} size={16} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <span role="status" className="sr-only">
          {copied ? "Invite link copied" : ""}
        </span>
      </div>
      <Sheet open={big} onOpenChange={setBig} title="Scan to be friends" description="Point a phone camera at this code.">
        <div className="flex flex-col items-center gap-3 pb-2">
          <div className="rounded-[20px] p-4" style={{ background: "#F4F5FB" }}>
            {url && <Qr value={url} size={232} label="QR code for your invite link" />}
          </div>
          <span className="num text-accent text-[15px]">{pretty}</span>
        </div>
      </Sheet>
    </section>
  );
}

function AddByName({ minor }: { minor: boolean }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const add = useAddFriend();
  if (minor)
    return (
      <p className="bg-surface text-muted flex items-center gap-2.5 rounded-[14px] px-3.5 py-3 text-[14px]">
        <Icon name="shield-check" size={18} className="text-accent shrink-0" />
        Players under 16 add friends with an invite link or QR code. Share yours above.
      </p>
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 3) return;
    try {
      const r = await add.mutateAsync(n);
      setMsg({ ok: true, text: r.status === "friends" ? `You and ${n} are friends now.` : `Request sent to ${n}.` });
      setName("");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof HttpError && err.message !== err.code ? err.message : "That didn't work. Try again." });
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="bg-surface flex h-12 items-center gap-2.5 rounded-[14px] pr-1.5 pl-3.5">
        <Icon name="magnifying-glass" size={18} className="text-muted shrink-0" />
        <label htmlFor="add-name" className="sr-only">
          Add by username
        </label>
        <input
          id="add-name"
          value={name}
          onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 16))}
          placeholder="Add by username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="placeholder:text-muted min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none"
        />
        {name.length >= 3 && (
          <button
            type="submit"
            className="press bg-accent text-on-accent h-9 rounded-[10px] px-3 text-[14px] font-semibold"
            disabled={add.isPending}
          >
            Add
          </button>
        )}
      </div>
      <p role="status" className="min-h-0 px-1 text-[14px]" style={{ color: msg?.ok ? "var(--accent)" : "var(--danger)" }}>
        {msg?.text}
      </p>
    </form>
  );
}

function FriendsTab({ minor }: { minor: boolean }) {
  const me = useMe();
  const q = useFriends(!!me.data);
  const accept = useAccept();
  const remove = useRemoveFriend();
  const d = q.data;
  return (
    <>
      <InviteCard />
      <AddByName minor={minor} />
      {q.isPending ? (
        <ListSkeleton rows={5} height={52} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <>
          {d!.incoming.length > 0 && (
            <section aria-label="Requests" className="flex flex-col gap-2">
              <h2 className="text-[15px] font-bold">Requests · {d!.incoming.length}</h2>
              {d!.incoming.map((r) => (
                <div key={r.id} className="bg-surface flex h-14 items-center gap-2.5 rounded-[16px] px-2.5">
                  <AvatarChip nickname={r.nickname} color={r.color} size={36} radius={11} />
                  <Link href={`/u/${r.nickname}`} className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold">{r.nickname}</span>
                    <span className="text-muted text-[12px] font-medium">
                      {r.mutual > 0 ? `${r.mutual} mutual` : "Wants to be friends"}
                    </span>
                  </Link>
                  <button
                    aria-label={`Decline ${r.nickname}`}
                    onClick={() => remove.mutate(r.id)}
                    className="press bg-surface-raised flex size-11 items-center justify-center rounded-[12px]"
                  >
                    <Icon name="x" size={18} />
                  </button>
                  <button
                    aria-label={`Accept ${r.nickname}`}
                    onClick={() => {
                      accept.mutate(r.id);
                      play("chime");
                    }}
                    className="press bg-accent text-on-accent flex size-11 items-center justify-center rounded-[12px]"
                  >
                    <Icon name="check" size={18} />
                  </button>
                </div>
              ))}
            </section>
          )}
          {d!.friends.length === 0 ? (
            <EmptyState
              mood="sad"
              title="No rivals yet. Send a link, start beef."
              body="Friends you add show up here with their streaks and who's online."
            />
          ) : (
            <section aria-label="Your friends" className="flex flex-col">
              <h2 className="pb-1 text-[15px] font-bold">{d!.online > 0 ? "Online" : "Your friends"}</h2>
              <ul className="flex flex-col">
                {d!.friends.map((f) => (
                  <li key={f.id} className="flex h-[52px] items-center gap-2.5 px-1">
                    <Link href={`/u/${f.nickname}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                      <AvatarChip nickname={f.nickname} color={f.color} size={36} radius={11} online={f.presence.online} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[15px] font-semibold">{f.nickname}</span>
                        <span className="text-muted truncate text-[13px] font-medium">{f.presence.label}</span>
                      </span>
                    </Link>
                    <Link
                      href={`/duel?friend=${encodeURIComponent(f.nickname)}`}
                      aria-label={`Duel ${f.nickname}`}
                      className="press bg-surface-raised text-accent flex size-11 items-center justify-center rounded-[12px]"
                    >
                      <Icon name="sword" size={18} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d!.outgoing.length > 0 && (
            <p className="text-muted px-1 text-[14px]">Waiting on {d!.outgoing.map((o) => o.nickname).join(", ")}.</p>
          )}
          <nav aria-label="Groups" className="grid grid-cols-2 gap-2 pt-1">
            <Link href="/crews" className="press bg-surface flex h-14 items-center gap-2.5 rounded-[16px] px-3.5 text-[15px] font-semibold">
              <Icon name="users-three" size={20} className="text-accent" />
              Crew
            </Link>
            <Link
              href="/school-cup"
              className="press bg-surface flex h-14 items-center gap-2.5 rounded-[16px] px-3.5 text-[15px] font-semibold"
            >
              <Icon name="graduation-cap" size={20} className="text-accent" />
              School Cup
            </Link>
          </nav>
        </>
      )}
    </>
  );
}

function ActivityTab() {
  const q = useFeed();
  const react = useReact();
  const [menu, setMenu] = useState<FeedItem | null>(null);
  const [report, setReport] = useState<{ id: string; nickname: string } | null>(null);
  if (q.isPending) return <ListSkeleton rows={4} height={96} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const items = q.data!.items;
  if (!items.length)
    return (
      <EmptyState
        mood="wave"
        title="Quiet in here."
        body="Clears, streaks and badges from you and your friends show up here. Go make some noise."
      />
    );
  const tap = (it: FeedItem, r: Reaction) => {
    const next = it.mine === r ? null : r;
    if (next) play("emote");
    react.mutate({ id: it.id, reaction: next });
  };
  return (
    <>
      <ul className="flex flex-col gap-2.5" aria-label="Activity">
        {items.map((it) => {
          const line = feedLine(it.player.me ? "You" : it.player.nickname, it.kind, it.game, it.payload, badgeName);
          return (
            <li key={it.id} className="bg-surface flex flex-col gap-2.5 rounded-[18px] px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <AvatarChip nickname={it.player.nickname} color={it.player.color} size={36} radius={11} />
                <p className="flex-1 text-[15px] leading-[1.35] font-medium">{line}</p>
                <span className="text-muted self-start text-[12px] font-medium">
                  <time dateTime={it.at}>{agoShort(it.at)}</time>
                </span>
                {!it.player.me && (
                  <button
                    aria-label={`More for ${it.player.nickname}`}
                    onClick={() => setMenu(it)}
                    className="text-muted -mr-1.5 flex size-11 items-center justify-center self-start"
                  >
                    <Icon name="dots-three" size={20} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reactions">
                {REACTIONS.map((r) => {
                  const on = it.mine === r;
                  const n = it.counts[r];
                  return (
                    <button
                      key={r}
                      onClick={() => tap(it, r)}
                      aria-pressed={on}
                      aria-label={`${REACTION_LABEL[r]}${n ? `, ${n}` : ""}`}
                      className="press flex h-11 min-w-11 items-center justify-center gap-1 rounded-[10px] px-2.5 text-[14px] font-semibold"
                      style={{
                        background: on ? "var(--warn-tint)" : "var(--surface-raised)",
                        boxShadow: on ? "inset 0 0 0 2px var(--gold)" : undefined,
                      }}
                      data-no-tick
                    >
                      <span aria-hidden className={r === "gg" ? "font-display font-black" : undefined}>
                        {REACTION_GLYPH[r]}
                      </span>
                      {n > 0 && <span className="num text-muted text-[12px] font-medium">{n}</span>}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <Sheet open={!!menu} onOpenChange={(o) => !o && setMenu(null)} title={menu?.player.nickname ?? ""}>
        {menu && (
          <div className="flex flex-col gap-2">
            <Link
              href={`/u/${menu.player.nickname}`}
              className="press bg-surface-raised flex h-[52px] items-center gap-3 rounded-[14px] px-3.5 text-[15px] font-semibold"
            >
              <Icon name="user" size={20} />
              View profile
            </Link>
            <button
              onClick={() => {
                setReport({ id: menu.player.id, nickname: menu.player.nickname });
                setMenu(null);
              }}
              className="press bg-surface-raised flex h-[52px] items-center gap-3 rounded-[14px] px-3.5 text-[15px] font-semibold"
            >
              <Icon name="flag" size={20} />
              Report or block
            </button>
            <Button variant="ghost" className="w-full" onClick={() => setMenu(null)}>
              Cancel
            </Button>
          </div>
        )}
      </Sheet>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </>
  );
}
