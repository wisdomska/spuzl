"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { Spuz } from "@/components/brand/Spuz";
import { api, HttpError, useMe } from "@/lib/client/api";
import { useGameSettings } from "@/lib/game-settings/client";
import { hostIsUnder16, type JoinRequestStatus } from "@/lib/multiplayer/joinRules";
import { joinRequestsCopy as C } from "@/lib/copy/join-requests";
import type { RealtimeChannel } from "@/lib/realtime/transport";
import { Avatar, Cta } from "./ui";

/** Must match JOIN_REQUEST_EVENT in lib/multiplayer/server/joinRequests.ts (the room's match channel). */
const EVENT = "join_request";

type Pending = { id: string; nickname: string; color: string | null; hat?: string | null; at: number };

/**
 * R2-13, host side: the room's pending requests to join, with Let in and Say no. Refreshed the moment one arrives
 * (the room's realtime channel) and on a slow poll as a fallback; new names are announced to screen readers.
 * Under-16 hosts with the admin setting on also see a one-line note that the room is friends only.
 */
export function HostJoinRequests({ matchId, channel }: { matchId: string; channel: RealtimeChannel | null }) {
  const me = useMe();
  const friendsOnly = useGameSettings()["rooms.under16FriendsOnly"] && !!me.data && hostIsUnder16(me.data);
  const q = useQuery({
    queryKey: ["join-requests", matchId],
    queryFn: () => api<{ requests: Pending[] }>(`/api/v1/join-requests?match=${matchId}`),
    refetchInterval: 15_000,
    retry: false,
  });
  const refetch = q.refetch;
  useEffect(() => channel?.onMessage(EVENT, () => void refetch()), [channel, refetch]);
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
  const decide = async (id: string, decision: "approve" | "decline") => {
    setBusy(id);
    setErr(null);
    try {
      await api(`/api/v1/join-requests/${id}`, { json: { decision } });
      await refetch();
    } catch {
      setErr(C.decideFailed);
    } finally {
      setBusy(null);
    }
  };
  if (!friendsOnly && requests.length === 0) return null;
  return (
    <section aria-label={requests.length ? C.hostTitle(requests.length) : undefined} className="flex flex-col gap-2">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {friendsOnly && (
        <p className="text-muted flex items-center gap-2 text-[14px] font-medium">
          <Icon name="lock-simple" size={16} className="shrink-0" />
          {C.hostNote}
        </p>
      )}
      {requests.length > 0 && (
        <div className="bg-surface flex flex-col gap-2 rounded-[20px] p-3" style={{ boxShadow: "inset 0 0 0 2px var(--accent)" }}>
          <h2 className="font-display text-[16px] font-extrabold">{C.hostTitle(requests.length)}</h2>
          <ul className="flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center gap-2.5">
                <Avatar name={r.nickname} color={r.color ?? "var(--accent)"} hat={r.hat} size={36} radius={12} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{r.nickname}</span>
                  <span className="text-muted text-[13px]">{C.wantsIn}</span>
                </span>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void decide(r.id, "decline")}
                  aria-label={C.declineAria(r.nickname)}
                  className="press bg-surface-raised h-11 shrink-0 rounded-[14px] px-3.5 text-[14px] font-semibold"
                >
                  {C.decline}
                </button>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void decide(r.id, "approve")}
                  aria-label={C.approveAria(r.nickname)}
                  className="press h-11 shrink-0 rounded-[14px] px-3.5 text-[14px] font-bold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                >
                  {C.approve}
                </button>
              </li>
            ))}
          </ul>
          {err && (
            <p role="alert" className="text-[14px] text-[var(--danger)]">
              {err}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

type Asked = { id: string; status: JoinRequestStatus };

/**
 * R2-13, asker side: a friends-only room. Says so plainly, sends one request, waits for the host (a poll every
 * couple of seconds, the asker isn't on the room's channel), and calls `onApproved` to join once the host lets
 * them in. `initial` is the latest request for this room, if the server already has one.
 */
export function RequestToJoin({
  code,
  host,
  initial,
  onApproved,
  onBack,
}: {
  code: string;
  host: string | null;
  initial?: Asked | null;
  onApproved: () => void;
  onBack: () => void;
}) {
  const [req, setReq] = useState<Asked | null>(initial ?? null);
  const [hostName, setHostName] = useState(host);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const status = req?.status ?? null;
  const done = useRef(false);

  useEffect(() => {
    if (status === "approved" && !done.current) {
      done.current = true;
      onApproved();
    }
  }, [status, onApproved]);

  useEffect(() => {
    if (!req || req.status !== "pending") return;
    const t = setInterval(async () => {
      try {
        const r = await api<{ id: string; status: JoinRequestStatus; host: string | null }>(`/api/v1/join-requests/${req.id}`);
        setReq({ id: r.id, status: r.status });
        if (r.host) setHostName(r.host);
      } catch {
        /* keep waiting */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [req]);

  const ask = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ id?: string; status: "pending" | "approved" | "not_needed"; host: string | null }>("/api/v1/join-requests", {
        json: { code },
      });
      if (r.host) setHostName(r.host);
      if (r.status === "not_needed") onApproved();
      else setReq({ id: r.id!, status: r.status });
    } catch (e) {
      if (e instanceof HttpError && e.code === "declined") setReq({ id: "", status: "declined" });
      else
        setErr(
          e instanceof HttpError && e.code === "too_many" ? C.tooMany : e instanceof HttpError && e.status === 404 ? C.gone : C.failed,
        );
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (req?.id) await api(`/api/v1/join-requests/${req.id}`, { method: "DELETE" }).catch(() => {});
    setReq(null);
  };

  const pending = status === "pending";
  const declined = status === "declined";
  return (
    <div
      className="flex flex-1 flex-col items-center gap-4 px-5 pt-[max(80px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))] text-center"
      data-screen-label="Friends-only room"
    >
      <Spuz mood={declined ? "shocked" : pending ? "thinking" : "wave"} size={120} decorative />
      <h1 className="font-display text-[24px] font-black" aria-live="polite">
        {declined ? C.declinedTitle : pending ? C.waitingTitle : status === "approved" ? C.approved : C.friendsOnlyTitle(hostName)}
      </h1>
      <p className="text-muted text-[16px]" aria-live="polite">
        {declined ? C.declined : pending ? C.waiting(hostName) : status === "approved" ? "" : C.friendsOnlyBody}
      </p>
      {err && (
        <p role="alert" className="text-[var(--danger)]">
          {err}
        </p>
      )}
      <div className="mt-auto flex w-full max-w-[528px] flex-col gap-3">
        {!pending && !declined && status !== "approved" && (
          <Cta className="w-full" icon="hand-waving" onClick={() => void ask()} disabled={busy}>
            {busy ? C.asking : C.ask}
          </Cta>
        )}
        {pending && (
          <Cta tone="raised" className="w-full" onClick={() => void cancel()}>
            {C.cancel}
          </Cta>
        )}
        {!pending && (
          <Cta tone="raised" className="w-full" onClick={onBack}>
            {C.back}
          </Cta>
        )}
      </div>
    </div>
  );
}
