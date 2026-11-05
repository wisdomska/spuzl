import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

/**
 * Web Push: a notification on the player's phone or computer even when SPUZL is closed (your turn, a nudge, a
 * friend's invite). The VAPID key pair lives in public.server_secrets (server-only); without it push is off and
 * everything else works as before. The service worker (public/sw.js) shows the notification only when no SPUZL
 * window is on screen, so an open app shows its own card instead (components/shell/Inbox.tsx).
 */
export interface PushMessage {
  title: string;
  body: string;
  /** opened when the notification is tapped */
  url: string;
  /** one notification per tag: a newer one replaces it */
  tag: string;
}

let keys: Promise<{ publicKey: string; privateKey: string } | null> | null = null;

/** The VAPID keys, read once per server instance. Null when push is not set up for this project. */
export function vapidKeys(admin: SupabaseClient) {
  keys ??= (async () => {
    const { data } = await admin.from("server_secrets").select("key, value").in("key", ["vapid_public", "vapid_private"]);
    const get = (k: string) => data?.find((r) => r.key === k)?.value as string | undefined;
    const publicKey = get("vapid_public");
    const privateKey = get("vapid_private");
    if (!publicKey || !privateKey) {
      keys = null; // try again next time (keys may be added later)
      return null;
    }
    return { publicKey, privateKey };
  })();
  return keys;
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://spuzl.vercel.app";

/** Sends to every device of a player. Gone subscriptions (404, 410) are removed. Never throws. */
export async function pushTo(admin: SupabaseClient, playerId: string, msg: PushMessage): Promise<number> {
  try {
    const k = await vapidKeys(admin);
    if (!k) return 0;
    const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("player_id", playerId);
    if (!subs?.length) return 0;
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
            JSON.stringify(msg),
            { vapidDetails: { subject: SITE, publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 60 * 60, urgency: "high" },
          );
          sent++;
          await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("endpoint", s.endpoint);
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }),
    );
    return sent;
  } catch (e) {
    console.error("[push] failed", e);
    return 0;
  }
}
