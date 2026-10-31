/**
 * Realtime transport: one channel per match or room. Clients broadcast intents (emotes, ready
 * taps, pings); the server broadcasts every result it decides (progress, finishes, rounds) after
 * validating it. Presence is used only in lobbies.
 *
 * The adapter is picked by NEXT_PUBLIC_REALTIME_TRANSPORT ("supabase" default, "ably", "partykit")
 * with no code changes. Every adapter implements this interface; the SDK of the chosen adapter is
 * loaded on demand, so the others cost nothing.
 */
export type TransportName = "supabase" | "ably" | "partykit";

export interface RealtimeMessage<T = unknown> {
  event: string;
  payload: T;
}

export interface PresenceMember {
  /** player id */
  key: string;
  /** what the member tracked, e.g. { nick, ready } */
  meta: Record<string, unknown>;
}

export type ChannelStatus = "idle" | "joining" | "joined" | "closed" | "error";

export interface ChannelOptions {
  /** track presence under this key (lobbies only) */
  presenceKey?: string;
  /** echo own broadcasts back (default false) */
  self?: boolean;
}

export interface RealtimeChannel {
  readonly topic: string;
  status(): ChannelStatus;
  join(): Promise<void>;
  broadcast(event: string, payload: unknown): Promise<void>;
  /** "*" receives every event. Returns an unsubscribe function. */
  onMessage(event: string, cb: (payload: unknown, event: string) => void): () => void;
  /** lobbies only: share this member's state */
  track(meta: Record<string, unknown>): Promise<void>;
  onPresence(cb: (members: PresenceMember[]) => void): () => void;
  onStatus(cb: (s: ChannelStatus) => void): () => void;
  leave(): Promise<void>;
}

export interface RealtimeTransport {
  name: TransportName;
  channel(topic: string, opts?: ChannelOptions): RealtimeChannel;
}

export function transportName(): TransportName {
  const v = (process.env.NEXT_PUBLIC_REALTIME_TRANSPORT ?? "supabase").toLowerCase();
  return v === "ably" || v === "partykit" ? v : "supabase";
}

let cached: Promise<RealtimeTransport> | null = null;

/** The configured transport (client only). */
export function getTransport(): Promise<RealtimeTransport> {
  cached ??= (async () => {
    switch (transportName()) {
      case "ably":
        return (await import("./ably")).createAblyTransport();
      case "partykit":
        return (await import("./partykit")).createPartyKitTransport();
      default:
        return (await import("./supabase")).createSupabaseTransport();
    }
  })();
  return cached;
}

/** Tiny listener registry used by every adapter. */
export class Listeners<T extends unknown[]> {
  private set = new Set<(...a: T) => void>();
  add(fn: (...a: T) => void) {
    this.set.add(fn);
    return () => void this.set.delete(fn);
  }
  emit(...a: T) {
    for (const fn of [...this.set]) {
      try {
        fn(...a);
      } catch (e) {
        console.error("[realtime]", e);
      }
    }
  }
  clear() {
    this.set.clear();
  }
}

/** Dispatches messages to "*" and per-event listeners. */
export class MessageBus {
  private byEvent = new Map<string, Listeners<[unknown, string]>>();
  on(event: string, cb: (payload: unknown, event: string) => void) {
    let l = this.byEvent.get(event);
    if (!l) this.byEvent.set(event, (l = new Listeners()));
    return l.add(cb);
  }
  emit(event: string, payload: unknown) {
    this.byEvent.get(event)?.emit(payload, event);
    this.byEvent.get("*")?.emit(payload, event);
  }
  clear() {
    this.byEvent.clear();
  }
}

/**
 * Presence over plain broadcasts, for transports without native presence on the client: members
 * announce themselves every 10 s and drop after 25 s of silence.
 */
export class HeartbeatPresence {
  private members = new Map<string, { meta: Record<string, unknown>; at: number }>();
  readonly changed = new Listeners<[PresenceMember[]]>();
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(
    private send: (event: string, payload: unknown) => Promise<void>,
    private key?: string,
  ) {}
  private meta: Record<string, unknown> = {};
  start() {
    if (this.timer || !this.key) return;
    this.timer = setInterval(() => {
      void this.send("$presence", { key: this.key, meta: this.meta });
      this.sweep();
    }, 10_000);
  }
  async track(meta: Record<string, unknown>) {
    if (!this.key) return;
    this.meta = meta;
    this.receive({ key: this.key, meta });
    await this.send("$presence", { key: this.key, meta });
  }
  receive(p: unknown) {
    const m = p as { key?: unknown; meta?: unknown; leave?: boolean };
    if (typeof m?.key !== "string") return;
    if (m.leave) this.members.delete(m.key);
    else this.members.set(m.key, { meta: (m.meta as Record<string, unknown>) ?? {}, at: Date.now() });
    this.changed.emit(this.list());
  }
  private sweep() {
    const now = Date.now();
    let dirty = false;
    for (const [k, v] of this.members) if (k !== this.key && now - v.at > 25_000) dirty = this.members.delete(k) || dirty;
    if (dirty) this.changed.emit(this.list());
  }
  list(): PresenceMember[] {
    return [...this.members].map(([key, v]) => ({ key, meta: v.meta }));
  }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.key) await this.send("$presence", { key: this.key, leave: true }).catch(() => {});
  }
}
