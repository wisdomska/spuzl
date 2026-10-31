"use client";

/**
 * Ably adapter, thin and SDK-free: Server-Sent Events to receive, REST to publish, presence over
 * heartbeat broadcasts. The token comes from /api/v1/realtime/token, scoped to this one channel
 * after the server checks membership. Select with NEXT_PUBLIC_REALTIME_TRANSPORT=ably.
 */
import { HeartbeatPresence, Listeners, MessageBus, type ChannelOptions, type ChannelStatus, type PresenceMember, type RealtimeChannel, type RealtimeTransport } from "./transport";

interface Token {
  token: string;
  clientId: string;
}

async function fetchToken(topic: string): Promise<Token> {
  const res = await fetch(`/api/v1/realtime/token?topic=${encodeURIComponent(topic)}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`realtime token ${res.status}`);
  return (await res.json()) as Token;
}

class AblyChannel implements RealtimeChannel {
  private es: EventSource | null = null;
  private token: Token | null = null;
  private bus = new MessageBus();
  private statusL = new Listeners<[ChannelStatus]>();
  private st: ChannelStatus = "idle";
  private presence: HeartbeatPresence;
  constructor(
    readonly topic: string,
    private opts: ChannelOptions,
  ) {
    this.presence = new HeartbeatPresence((e, p) => this.broadcast(e, p), opts.presenceKey);
  }
  status() {
    return this.st;
  }
  private set(s: ChannelStatus) {
    this.st = s;
    this.statusL.emit(s);
  }
  async join() {
    if (this.st === "joined" || this.st === "joining") return;
    this.set("joining");
    try {
      this.token = await fetchToken(this.topic);
    } catch {
      this.set("error");
      return;
    }
    const url = `https://realtime.ably.io/sse?v=1.2&channels=${encodeURIComponent(this.topic)}&accessToken=${encodeURIComponent(this.token.token)}`;
    const es = new EventSource(url);
    this.es = es;
    es.onopen = () => {
      this.set("joined");
      this.presence.start();
    };
    es.onerror = () => this.set(es.readyState === EventSource.CLOSED ? "closed" : "joining");
    es.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data) as { name: string; data: string; clientId?: string };
        if (!this.opts.self && m.clientId && m.clientId === this.token?.clientId) return;
        const payload = typeof m.data === "string" ? JSON.parse(m.data) : m.data;
        if (m.name === "$presence") this.presence.receive(payload);
        else this.bus.emit(m.name, payload);
      } catch {
        /* ignore malformed frames */
      }
    };
  }
  async broadcast(event: string, payload: unknown) {
    if (!this.token) return;
    await fetch(`https://rest.ably.io/channels/${encodeURIComponent(this.topic)}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${btoa(this.token.token)}`, "content-type": "application/json" },
      body: JSON.stringify({ name: event, data: JSON.stringify(payload) }),
    });
  }
  onMessage(event: string, cb: (payload: unknown, event: string) => void) {
    return this.bus.on(event, cb);
  }
  track(meta: Record<string, unknown>) {
    return this.presence.track(meta);
  }
  onPresence(cb: (m: PresenceMember[]) => void) {
    return this.presence.changed.add(cb);
  }
  onStatus(cb: (s: ChannelStatus) => void) {
    return this.statusL.add(cb);
  }
  async leave() {
    await this.presence.stop();
    this.es?.close();
    this.es = null;
    this.bus.clear();
    this.set("closed");
    this.statusL.clear();
  }
}

export function createAblyTransport(): RealtimeTransport {
  return { name: "ably", channel: (topic, opts = {}) => new AblyChannel(topic, opts) };
}
