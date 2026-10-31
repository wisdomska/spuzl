/**
 * PartyKit relay for NEXT_PUBLIC_REALTIME_TRANSPORT=partykit. Deploy with `npx partykit deploy
 * lib/realtime/partykit-server.ts --name spuzl` and set REALTIME_SECRET on both sides. One party per
 * channel topic. Clients connect with a token from /api/v1/realtime/token; the API posts server
 * results with the shared secret. Typed structurally so the app needs no PartyKit dependency.
 */
interface Conn {
  id: string;
  state?: { player?: string };
  setState(s: { player: string }): void;
  send(msg: string): void;
  close(code?: number, reason?: string): void;
}
interface Room {
  id: string;
  env: Record<string, unknown>;
  broadcast(msg: string, without?: string[]): void;
}
interface Ctx {
  request: Request;
}

async function verify(topic: string, token: string, secret: string): Promise<string | null> {
  const [player, exp, sig] = token.split(".");
  if (!player || !exp || !sig || Number(exp) < Date.now()) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${topic}|${player}.${exp}`)));
  const want = btoa(String.fromCharCode(...mac))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return want === sig ? player : null;
}

export default class SpuzlParty {
  constructor(readonly room: Room) {}

  async onConnect(conn: Conn, ctx: Ctx) {
    const token = new URL(ctx.request.url).searchParams.get("token") ?? "";
    const player = await verify(this.room.id, token, String(this.room.env.REALTIME_SECRET ?? ""));
    if (!player) return conn.close(4001, "unauthorised");
    conn.setState({ player });
  }

  onMessage(message: string, sender: Conn) {
    const player = sender.state?.player;
    if (!player) return;
    try {
      const m = JSON.parse(message) as { event: string; payload: unknown };
      if (typeof m.event !== "string" || m.event.length > 40) return;
      this.room.broadcast(JSON.stringify({ event: m.event, payload: m.payload, from: player }), [sender.id]);
    } catch {
      /* ignore */
    }
  }

  async onRequest(req: Request) {
    if (req.method !== "POST" || req.headers.get("x-spuzl-secret") !== String(this.room.env.REALTIME_SECRET ?? ""))
      return new Response("forbidden", { status: 403 });
    const m = (await req.json()) as { event: string; payload: unknown };
    this.room.broadcast(JSON.stringify({ event: m.event, payload: m.payload, from: "server" }));
    return new Response("ok");
  }
}
