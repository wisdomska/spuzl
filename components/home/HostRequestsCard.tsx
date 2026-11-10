"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, useMe } from "@/lib/client/api";
import { useGameSettings } from "@/lib/game-settings/client";
import { hostIsUnder16 } from "@/lib/multiplayer/joinRules";
import { joinRequestsCopy as C } from "@/lib/copy/join-requests";
import { Avatar } from "@/components/multiplayer/ui";

type Pending = {
  id: string;
  code: string;
  kind: "duel" | "party";
  nickname: string;
  color: string | null;
  hat?: string | null;
  at: number;
};

/** How often Home asks again while the card could matter (and on focus, as every query does). */
const POLL_MS = 20_000;

/**
 * R4-17: a Party (or friend duel) host who left the lobby still hears about requests to join their friends-only
 * room (R2-13): a card on Home lists each asker with Let in and Say no, the same answers the lobby gives (the server
 * checks the player still hosts that open room). Only friends-only hosts (13 to 15, setting on) get requests at all,
 * so only they poll. Not a prompt: it is a person waiting on an answer, like the Inbox's invite cards, so it does
 * not wait for the prompt queue. Renders nothing when nobody is waiting.
 */
export function HostRequestsCard() {
  const me = useMe();
  const settings = useGameSettings();
  const enabled = settings["rooms.under16FriendsOnly"] && !!me.data && hostIsUnder16(me.data);
  const q = useQuery({
    queryKey: ["join-requests", "home"],
    queryFn: () => api<{ requests: Pending[] }>("/api/v1/join-requests"),
    enabled,
    refetchInterval: POLL_MS,
    retry: false,
  });
  const refetch = q.refetch;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const seen = useRef<Set<string>>(new Set());
  const data = q.data;
  const requests = data?.requests ?? [];
  useEffect(() => {
    const fresh = (data?.requests ?? []).filter((r) => !seen.current.has(r.id));
    fresh.forEach((r) => seen.current.add(r.id));
    if (fresh.length) setAnnounce(fresh.map((r) => C.hostAnnounce(r.nickname)).join(". "));
  }, [data]);

  const decide = async (r: Pending, decision: "approve" | "decline") => {
    setBusy(r.id);
    setErr(null);
    try {
      await api(`/api/v1/join-requests/${r.id}`, { json: { decision } });
      if (decision === "approve") setAnnounce(C.letInDone(r.nickname));
      await refetch();
    } catch {
      setErr(C.decideFailed);
    } finally {
      setBusy(null);
    }
  };

  if (!enabled) return null;
  // Party rooms the host can go back to (a room's lobby is its page); one link per room, oldest request first.
  const rooms = [...new Set(requests.filter((r) => r.kind === "party").map((r) => r.code))];
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {requests.length > 0 && (
        <section
          aria-labelledby="host-requests-title"
          data-testid="host-requests"
          className="bg-surface flex flex-col gap-2.5 rounded-[20px] p-3.5"
          style={{ boxShadow: "inset 0 0 0 2px var(--accent)" }}
        >
          <h2 id="host-requests-title" className="font-display text-[16px] font-extrabold">
            {C.homeTitle(requests.length)}
          </h2>
          <ul className="flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center gap-2.5">
                <Avatar name={r.nickname} color={r.color ?? "var(--accent)"} hat={r.hat} size={36} radius={12} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{r.nickname}</span>
                  <span className="text-muted truncate text-[13px]">{C.homeWants(r.kind, r.code)}</span>
                </span>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void decide(r, "decline")}
                  aria-label={C.declineAria(r.nickname)}
                  className="press bg-surface-raised h-11 shrink-0 rounded-[14px] px-3.5 text-[14px] font-semibold"
                >
                  {C.decline}
                </button>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void decide(r, "approve")}
                  aria-label={C.approveAria(r.nickname)}
                  className="press h-11 shrink-0 rounded-[14px] px-3.5 text-[14px] font-bold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                >
                  {C.approve}
                </button>
              </li>
            ))}
          </ul>
          {rooms.map((code) => (
            <Link
              key={code}
              href={`/party/${code}`}
              aria-label={C.backToRoomAria(code)}
              className="press text-accent flex min-h-11 items-center justify-center rounded-[14px] text-[14px] font-semibold"
            >
              {C.backToRoom}
              {rooms.length > 1 && <span className="num ml-1.5">{code}</span>}
            </Link>
          ))}
          {err && (
            <p role="alert" className="text-[14px] text-[var(--danger)]">
              {err}
            </p>
          )}
        </section>
      )}
    </>
  );
}
