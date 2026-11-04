"use client";

/**
 * Multiplayer client: TanStack Query for the server's view, the realtime channel for live events.
 * The server's view is the truth; realtime events only patch it early or trigger a refetch.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/multiplayer/chat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ensureSession, HttpError } from "@/lib/client/api";
import { getTransport, type ChannelStatus, type PresenceMember, type RealtimeChannel } from "@/lib/realtime/transport";
import { useSettings, prefersReducedMotion } from "@/lib/settings/store";
import { play } from "@/lib/audio";
import { TIMING, isEmoteId, type EmoteId } from "@/lib/multiplayer/constants";
import type { BayView, MatchView } from "@/lib/multiplayer/types";

/* ---------------- Clock: render phases on the server's clock ---------------- */

/** Offset between the server and this device, from the latest view. */
export function useServerNow(serverNow: number | undefined, tickMs = 200) {
  const offset = useRef(0);
  useEffect(() => {
    if (serverNow) offset.current = serverNow - Date.now();
  }, [serverNow]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset.current), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

export function useReduce() {
  const hydrated = useSettings((s) => s.hydrated);
  const reduced = useSettings((s) => prefersReducedMotion(s));
  return hydrated && reduced;
}

/* ---------------- Channel ---------------- */

export function useChannel(topic: string | null, opts: { presenceKey?: string } = {}) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [status, setStatus] = useState<ChannelStatus>("idle");
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const key = opts.presenceKey;
  useEffect(() => {
    if (!topic) return;
    let ch: RealtimeChannel | null = null;
    let dead = false;
    const offs: (() => void)[] = [];
    void (async () => {
      const t = await getTransport();
      if (dead) return;
      ch = t.channel(topic, { presenceKey: key });
      offs.push(ch.onStatus(setStatus));
      offs.push(ch.onPresence(setMembers));
      setChannel(ch);
      await ch.join();
    })();
    return () => {
      dead = true;
      offs.forEach((f) => f());
      void ch?.leave();
      setChannel(null);
    };
  }, [topic, key]);
  return { channel, status, members };
}

/* ---------------- Matches (Duel and Party) ---------------- */

export const matchKey = (id: string) => ["match", id] as const;

/** Live match view: fetch, realtime patches, and a heartbeat tick that also resolves timeouts. */
export function useMatch(id: string | null, opts: { presenceKey?: string } = {}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: matchKey(id ?? "none"),
    enabled: !!id,
    queryFn: () => api<MatchView>(`/api/v1/matches/${id}`),
    retry: (n, e) => n < 4 && !(e instanceof HttpError && (e.status === 403 || e.status === 404)),
    retryDelay: 600,
  });
  const { channel, status, members } = useChannel(id ? `match:${id}` : null, opts);
  const [offline, setOffline] = useState(false);
  const failSince = useRef<number | null>(null);

  const refetch = q.refetch;
  useEffect(() => {
    if (!channel) return;
    const offs = [
      channel.onMessage("changed", () => void refetch()),
      channel.onMessage("progress", (p) => {
        const e = p as { player: string; progress: number; mistakes: number; round: number };
        qc.setQueryData<MatchView>(matchKey(id!), (v) =>
          v && v.round === e.round
            ? {
                ...v,
                players: v.players.map((x) => (x.id === e.player ? { ...x, progress: e.progress, mistakes: e.mistakes, stale: false } : x)),
              }
            : v,
        );
      }),
      channel.onMessage("finish", (p) => {
        const e = p as { player: string; timeMs: number; round: number };
        qc.setQueryData<MatchView>(matchKey(id!), (v) =>
          v && v.round === e.round
            ? { ...v, players: v.players.map((x) => (x.id === e.player ? { ...x, progress: 1, finishedMs: e.timeMs } : x)) }
            : v,
        );
        void refetch();
      }),
    ];
    return () => offs.forEach((f) => f());
  }, [channel, id, qc, refetch]);

  // Heartbeat: keeps us "here", and lets the server settle bot finishes, disconnects and race caps.
  useEffect(() => {
    if (!id) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Live rounds beat every 2.5 s (disconnects, bot finishes, race caps); lobbies and results every 8 s.
    const next = () => {
      if (stop) return;
      const v = qc.getQueryData<MatchView>(matchKey(id));
      timer = setTimeout(beat, v && v.status === "playing" ? 2500 : 8000);
    };
    let busy = false;
    const beat = async () => {
      if (stop || busy) return;
      busy = true;
      try {
        const v = await api<MatchView>(`/api/v1/matches/${id}/tick`, { json: {} });
        qc.setQueryData(matchKey(id), v);
        failSince.current = null;
        setOffline(false);
      } catch (e) {
        if (!(e instanceof HttpError && e.status < 500 && e.status !== 429)) {
          failSince.current ??= Date.now();
          if (Date.now() - failSince.current > 4000) setOffline(true);
        }
      } finally {
        busy = false;
        next();
      }
    };
    next();
    const onLine = () => void beat();
    window.addEventListener("online", onLine);
    const onOff = () => setOffline(true);
    window.addEventListener("offline", onOff);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", onLine);
      window.removeEventListener("offline", onOff);
    };
  }, [id, qc]);

  return { ...q, channel, channelStatus: status, offline, members };
}

export function matchAction<T = MatchView>(id: string, action: string, json: unknown = {}) {
  return api<T>(`/api/v1/matches/${id}/${action}`, { json });
}

/* ---------------- Emotes (preset only, peer to peer) ---------------- */

export interface EmoteEvent {
  from: string;
  e: EmoteId;
  n: number;
}

/** Sends and receives preset emotes on a channel. Rate limited to one per 1.5 s. */
export function useEmotes(channel: RealtimeChannel | null, me: string | undefined) {
  const [last, setLast] = useState<EmoteEvent | null>(null);
  const n = useRef(0);
  const sentAt = useRef(0);
  useEffect(() => {
    if (!channel) return;
    return channel.onMessage("emote", (p) => {
      const m = p as { from?: unknown; e?: unknown };
      if (typeof m.from !== "string" || !isEmoteId(m.e)) return;
      setLast({ from: m.from, e: m.e, n: ++n.current });
    });
  }, [channel]);
  const send = useCallback(
    (e: EmoteId) => {
      if (!me || Date.now() - sentAt.current < 1500) return false;
      sentAt.current = Date.now();
      setLast({ from: me, e, n: ++n.current });
      void channel?.broadcast("emote", { from: me, e });
      return true;
    },
    [channel, me],
  );
  return { last, send };
}

/* ---------------- Board Bay ---------------- */

export const bayKey = (id: string) => ["bay", id] as const;

export function useBay(id: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: bayKey(id ?? "none"),
    enabled: !!id,
    queryFn: () => api<BayView>(`/api/v1/bay/${id}`),
    retry: (n, e) => n < 3 && !(e instanceof HttpError && (e.status === 403 || e.status === 404)),
    refetchInterval: (query) => {
      const v = query.state.data;
      return v?.mode === "live" && v.status === "active" ? 5000 : 20_000;
    },
  });
  const mine = q.data?.mySeat !== null && q.data?.mySeat !== undefined;
  const { channel } = useChannel(id && mine ? `bay:${id}` : null);
  const refetch = q.refetch;
  useEffect(() => {
    if (!channel) return;
    const offs = [channel.onMessage("move", () => void refetch()), channel.onMessage("changed", () => void refetch())];
    return () => offs.forEach((f) => f());
  }, [channel, refetch]);
  const set = useCallback((v: BayView) => qc.setQueryData(bayKey(v.id), v), [qc]);
  return { ...q, channel, set };
}

/* ---------------- Session guard ---------------- */

/** Multiplayer needs a profile. Returns "ready", "loading" or "no_profile". */
export function useProfileGate() {
  const [state, setState] = useState<"loading" | "ready" | "no_profile">("loading");
  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        await ensureSession();
        await api("/api/v1/me");
        if (!dead) setState("ready");
      } catch {
        if (!dead) setState("no_profile");
      }
    })();
    return () => {
      dead = true;
    };
  }, []);
  return state;
}

export { TIMING };

/* ---------------- Match chat (Duels and Parties) ---------------- */

/**
 * The room's chat: loads it, refetches on each realtime ping (the ping carries no text; everything shown comes
 * from the server after its filter), counts unread messages from others while the panel is closed, and can be
 * muted for this match (incoming messages stop popping up; the panel still shows them).
 */
export function useMatchChat(
  matchId: string | null,
  channel: RealtimeChannel | null,
  me: string | undefined,
  /** "bay" for a Board Games match; Duels and Parties are "match" */
  kind: "match" | "bay" = "match",
) {
  const base = kind === "bay" ? "/api/v1/bay" : "/api/v1/matches";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [open, setOpenState] = useState(false);
  const [unread, setUnread] = useState(0);
  const [incoming, setIncoming] = useState<ChatMessage | null>(null);
  const [muted, setMuted] = useState(false);
  const lastId = useRef(0);
  const openRef = useRef(false);
  const mutedRef = useRef(false);

  // Which match the loaded messages belong to: a new match starts the list (and the unread count) afresh.
  const loadedFor = useRef<string | null>(null);
  const pull = useCallback(async () => {
    if (!matchId) return;
    const fresh0 = loadedFor.current !== matchId;
    if (fresh0) {
      loadedFor.current = matchId;
      lastId.current = 0;
    }
    try {
      const r = await api<{ messages: ChatMessage[]; typing: boolean }>(`${base}/${matchId}/chat?after=${lastId.current}`);
      setTyping(r.typing);
      const fresh = r.messages.filter((m) => m.id > lastId.current);
      if (fresh0) {
        setMessages(fresh.slice(-60));
        setUnread(0);
      }
      if (!fresh.length) return;
      lastId.current = fresh[fresh.length - 1].id;
      if (fresh0) return;
      setMessages((prev) => [...prev, ...fresh].slice(-60));
      const theirs = fresh.filter((m) => m.from !== me);
      if (theirs.length && !openRef.current) {
        setUnread((n) => n + theirs.length);
        if (!mutedRef.current) setIncoming(theirs[theirs.length - 1]);
      }
    } catch {
      /* chat is a nicety: a failed fetch just waits for the next ping */
    }
  }, [matchId, me, base]);

  useEffect(() => {
    void pull();
  }, [pull]);
  useEffect(() => {
    if (!channel) return;
    return channel.onMessage("chat", () => void pull());
  }, [channel, pull]);
  // A safety net under the realtime ping: check every few seconds while the tab is open, so a missed ping never
  // leaves a message unseen.
  useEffect(() => {
    if (!matchId) return;
    const t = setInterval(() => {
      if (!document.hidden) void pull();
    }, 5000);
    return () => clearInterval(t);
  }, [matchId, pull]);
  // A popped-up message stays a few seconds (longer for longer lines), with a soft sound.
  useEffect(() => {
    if (!incoming) return;
    play("notify", { gain: 0.5 });
    const t = setTimeout(() => setIncoming(null), Math.min(9000, 5000 + incoming.body.length * 60));
    return () => clearTimeout(t);
  }, [incoming]);

  const setOpen = useCallback((o: boolean) => {
    openRef.current = o;
    setOpenState(o);
    if (o) {
      setUnread(0);
      setIncoming(null);
    }
  }, []);
  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  }, []);
  const send = useCallback(
    async (input: { quick: number } | { text: string }) => {
      if (!matchId) return;
      await api(`${base}/${matchId}/chat`, { json: input });
      await pull();
    },
    [matchId, pull, base],
  );
  return { messages, typing, open, setOpen, unread, incoming, muted, toggleMute, send };
}
export type MatchChat = ReturnType<typeof useMatchChat>;
