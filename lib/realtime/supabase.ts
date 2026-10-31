"use client";

/**
 * Default transport: Supabase Realtime Broadcast + Presence on private channels. Access is checked
 * by RLS on realtime.messages (private.can_use_topic), so only members of a match can join it.
 */
import type { RealtimeChannel as SbChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  Listeners,
  MessageBus,
  type ChannelOptions,
  type ChannelStatus,
  type PresenceMember,
  type RealtimeChannel,
  type RealtimeTransport,
} from "./transport";

class SupabaseChannel implements RealtimeChannel {
  private ch: SbChannel | null = null;
  private bus = new MessageBus();
  private presence = new Listeners<[PresenceMember[]]>();
  private statusL = new Listeners<[ChannelStatus]>();
  private st: ChannelStatus = "idle";
  private joining: Promise<void> | null = null;
  constructor(
    readonly topic: string,
    private opts: ChannelOptions,
  ) {}

  status() {
    return this.st;
  }
  private set(s: ChannelStatus) {
    this.st = s;
    this.statusL.emit(s);
  }

  join() {
    this.joining ??= (async () => {
      this.set("joining");
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getSession();
      if (data.session) sb.realtime.setAuth(data.session.access_token);
      const ch = sb.channel(this.topic, {
        config: {
          private: true,
          broadcast: { self: !!this.opts.self, ack: false },
          ...(this.opts.presenceKey ? { presence: { key: this.opts.presenceKey } } : {}),
        },
      });
      ch.on("broadcast", { event: "*" }, (m) => this.bus.emit(m.event, m.payload));
      if (this.opts.presenceKey)
        ch.on("presence", { event: "sync" }, () => {
          const state = ch.presenceState<Record<string, unknown>>();
          this.presence.emit(
            Object.entries(state).map(([key, metas]) => ({ key, meta: (metas[metas.length - 1] ?? {}) as Record<string, unknown> })),
          );
        });
      this.ch = ch;
      await new Promise<void>((resolve) => {
        ch.subscribe((s) => {
          if (s === "SUBSCRIBED") {
            this.set("joined");
            resolve();
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
            this.set("error");
            resolve();
          } else if (s === "CLOSED") this.set("closed");
        });
      });
    })();
    return this.joining;
  }

  async broadcast(event: string, payload: unknown) {
    if (!this.ch || this.st !== "joined") return;
    await this.ch.send({ type: "broadcast", event, payload });
  }
  onMessage(event: string, cb: (payload: unknown, event: string) => void) {
    return this.bus.on(event, cb);
  }
  async track(meta: Record<string, unknown>) {
    if (this.ch && this.opts.presenceKey) await this.ch.track(meta);
  }
  onPresence(cb: (m: PresenceMember[]) => void) {
    return this.presence.add(cb);
  }
  onStatus(cb: (s: ChannelStatus) => void) {
    return this.statusL.add(cb);
  }
  async leave() {
    const ch = this.ch;
    this.ch = null;
    this.joining = null;
    this.bus.clear();
    this.presence.clear();
    if (ch) await supabaseBrowser().removeChannel(ch);
    this.set("closed");
    this.statusL.clear();
  }
}

export function createSupabaseTransport(): RealtimeTransport {
  return { name: "supabase", channel: (topic, opts = {}) => new SupabaseChannel(topic, opts) };
}
