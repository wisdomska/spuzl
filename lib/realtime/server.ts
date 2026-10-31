import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { transportName } from "./transport";

/**
 * Server broadcasts: every result the server decides (validated progress, finishes, rounds, moves)
 * goes out on the match channel from here, through the configured transport's REST API.
 * Broadcast failures never fail the request: clients also refetch the match on every event and on
 * a slow poll, so a lost message only delays the screen.
 */
export async function serverBroadcast(topic: string, event: string, payload: unknown): Promise<void> {
  try {
    switch (transportName()) {
      case "ably":
        return await ablyPublish(topic, event, payload);
      case "partykit":
        return await partyPublish(topic, event, payload);
      default:
        return await supabasePublish(topic, event, payload);
    }
  } catch (e) {
    console.error("[realtime] broadcast failed", topic, event, e);
  }
}

async function supabasePublish(topic: string, event: string, payload: unknown) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ topic, event, payload, private: true }] }),
  });
  if (!res.ok) throw new Error(`supabase broadcast ${res.status}`);
}

async function ablyPublish(topic: string, event: string, payload: unknown) {
  const key = process.env.ABLY_API_KEY;
  if (!key) return;
  await fetch(`https://rest.ably.io/channels/${encodeURIComponent(topic)}/messages`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(key).toString("base64")}`, "content-type": "application/json" },
    body: JSON.stringify({ name: event, data: JSON.stringify(payload), clientId: "server" }),
  });
}

async function partyPublish(topic: string, event: string, payload: unknown) {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  const secret = process.env.REALTIME_SECRET;
  if (!host || !secret) return;
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  await fetch(`${proto}://${host}/parties/main/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers: { "x-spuzl-secret": secret, "content-type": "application/json" },
    body: JSON.stringify({ event, payload }),
  });
}

/** Channel tokens for the Ably and PartyKit adapters (Supabase checks RLS instead). */
export async function channelToken(topic: string, playerId: string): Promise<{ token: string; clientId: string }> {
  if (transportName() === "ably") {
    const key = process.env.ABLY_API_KEY ?? "";
    const keyName = key.split(":")[0];
    const res = await fetch(`https://rest.ably.io/keys/${encodeURIComponent(keyName)}/requestToken`, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(key).toString("base64")}`, "content-type": "application/json" },
      body: JSON.stringify({
        keyName,
        clientId: playerId,
        ttl: 60 * 60 * 1000,
        capability: JSON.stringify({ [topic]: ["subscribe", "publish"] }),
        timestamp: Date.now(),
      }),
    });
    if (!res.ok) throw new Error(`ably token ${res.status}`);
    const t = (await res.json()) as { token: string };
    return { token: t.token, clientId: playerId };
  }
  return { token: signPartyToken(topic, playerId, Date.now() + 60 * 60 * 1000), clientId: playerId };
}

export function signPartyToken(topic: string, playerId: string, exp: number, secret = process.env.REALTIME_SECRET ?? "") {
  const body = `${playerId}.${exp}`;
  const sig = createHmac("sha256", secret).update(`${topic}|${body}`).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPartyToken(topic: string, token: string, now = Date.now(), secret = process.env.REALTIME_SECRET ?? "") {
  const [player, exp, sig] = token.split(".");
  if (!player || !exp || !sig || Number(exp) < now) return null;
  const want = createHmac("sha256", secret).update(`${topic}|${player}.${exp}`).digest();
  const got = Buffer.from(sig, "base64url");
  return got.length === want.length && timingSafeEqual(got, want) ? player : null;
}
