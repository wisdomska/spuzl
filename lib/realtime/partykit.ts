"use client";

/**
 * PartyKit adapter, thin and SDK-free: one WebSocket per room on NEXT_PUBLIC_PARTYKIT_HOST, relayed
 * by lib/realtime/partykit-server.ts. The connection carries a short-lived token from
 * /api/v1/realtime/token that the party checks. Presence rides on heartbeat broadcasts.
 */
import {
  HeartbeatPresence,
  Listeners,
  MessageBus,
  type ChannelOptions,
  type ChannelStatus,
  type PresenceMember,
  type RealtimeChannel,
  type RealtimeTransport,
} from "./transport";

class PartyChannel implements RealtimeChannel {
  private ws: WebSocket | null = null;
  private bus = new MessageBus();
  private statusL = new Listeners<[ChannelStatus]>();
  private st: ChannelStatus = "idle";
  private presence: HeartbeatPresence;
  private closed = false;
  private retry = 0;
  private clientId = "";
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
    this.closed = false;
    this.set("joining");
    const res = await fetch(`/api/v1/realtime/token?topic=${encodeURIComponent(this.topic)}`, { credentials: "same-origin" });
    if (!res.ok) return this.set("error");
    const { token, clientId } = (await res.json()) as { token: string; clientId: string };
    this.clientId = clientId;
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
    const proto = host.startsWith("localhost") || host.startsWith("127.") ? "ws" : "wss";
    await new Promise<void>((resolve) => {
      const ws = new WebSocket(`${proto}://${host}/parties/main/${encodeURIComponent(this.topic)}?token=${encodeURIComponent(token)}`);
      this.ws = ws;
      ws.onopen = () => {
        this.retry = 0;
        this.set("joined");
        this.presence.start();
        resolve();
      };
      ws.onerror = () => resolve();
      ws.onclose = () => {
        this.set(this.closed ? "closed" : "joining");
        if (!this.closed && this.retry < 8) {
          const wait = Math.min(8000, 500 * 2 ** this.retry++);
          setTimeout(() => {
            this.st = "idle";
            void this.join();
          }, wait);
        }
      };
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(String(ev.data)) as { event: string; payload: unknown; from?: string };
          if (!this.opts.self && m.from && m.from === this.clientId) return;
          if (m.event === "$presence") this.presence.receive(m.payload);
          else this.bus.emit(m.event, m.payload);
        } catch {
          /* ignore */
        }
      };
    });
  }
  async broadcast(event: string, payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ event, payload }));
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
    this.closed = true;
    await this.presence.stop();
    this.ws?.close();
    this.ws = null;
    this.bus.clear();
    this.set("closed");
    this.statusL.clear();
  }
}

export function createPartyKitTransport(): RealtimeTransport {
  return { name: "partykit", channel: (topic, opts = {}) => new PartyChannel(topic, opts) };
}
