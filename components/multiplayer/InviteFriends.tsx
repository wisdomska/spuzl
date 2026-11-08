"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { api, HttpError } from "@/lib/client/api";
import { useFriends } from "@/lib/client/social";
import type { InviteKind } from "@/lib/multiplayer/types";
import { noteAlertsTrigger } from "@/lib/prompts/alerts";
import { Avatar } from "./ui";

/**
 * Your friends, online ones first, each with an Invite button: one tap puts a card on their screen (wherever they
 * are in SPUZL) with a Join button. Sits next to the code and link on every "challenge a friend" screen: Duel,
 * Party room and Board Games.
 */
export function InviteFriends({ kind, target, collapsible = false }: { kind: InviteKind; target: string; collapsible?: boolean }) {
  const [open, setOpen] = useState(!collapsible);
  const q = useFriends(open);
  const [state, setState] = useState<Record<string, "sending" | "sent" | "failed">>({});
  const friends = [...(q.data?.friends ?? [])].sort((a, b) => Number(b.presence.online) - Number(a.presence.online));

  const invite = async (to: string) => {
    setState((s) => ({ ...s, [to]: "sending" }));
    try {
      await api("/api/v1/game-invites", { json: { to, kind, target } });
      setState((s) => ({ ...s, [to]: "sent" }));
      if (kind === "duel" || kind === "party") noteAlertsTrigger("invite"); // earns the notification ask (R2-04)
    } catch (e) {
      setState((s) => ({ ...s, [to]: "failed" }));
      if (e instanceof HttpError && e.code === "invite_closed") return;
    }
  };

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press bg-surface flex h-12 items-center justify-center gap-2 rounded-[16px] text-[15px] font-semibold"
      >
        <Icon name="user-plus" size={18} className="text-accent" />
        Invite your friends
      </button>
    );
  return (
    <section aria-labelledby="invite-friends" className="flex flex-col gap-2">
      <h2 id="invite-friends" className="font-display text-[17px] font-black">
        Invite your friends
      </h2>
      {q.isPending ? (
        <p className="text-muted text-[14px]">Loading your friends…</p>
      ) : friends.length === 0 ? (
        <p className="text-muted text-[14px]">
          No friends yet.{" "}
          <Link href="/friends" className="text-accent font-semibold underline-offset-2 hover:underline">
            Add some
          </Link>{" "}
          and they&apos;ll show up here.
        </p>
      ) : (
        <ul className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto">
          {friends.map((f) => {
            const st = state[f.id];
            return (
              <li key={f.id} className="bg-surface flex items-center gap-3 rounded-[16px] p-2 pr-2.5">
                <span className="relative">
                  <Avatar name={f.nickname} color={f.color} hat={f.hat} size={40} />
                  {f.presence.online && (
                    <span
                      aria-hidden
                      className="border-surface absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 bg-[var(--accent)]"
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{f.nickname}</span>
                  <span className="text-muted truncate text-[13px]">{f.presence.label}</span>
                </span>
                <button
                  type="button"
                  disabled={st === "sending" || st === "sent"}
                  onClick={() => void invite(f.id)}
                  aria-label={st === "sent" ? `Invite sent to ${f.nickname}` : `Invite ${f.nickname}`}
                  className="press font-display flex h-10 flex-none items-center gap-1.5 rounded-[12px] px-3.5 text-[14px] font-black disabled:opacity-80"
                  style={
                    st === "sent"
                      ? { background: "var(--surface-raised)", color: "var(--accent)" }
                      : { background: "var(--accent)", color: "var(--on-accent)" }
                  }
                >
                  {st === "sent" ? (
                    <>
                      <Icon name="check" size={16} /> Sent
                    </>
                  ) : st === "failed" ? (
                    "Retry"
                  ) : (
                    "Invite"
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-muted text-[13px]">Friends who are online get a pop-up to join. Anyone else can use the code or link.</p>
    </section>
  );
}
