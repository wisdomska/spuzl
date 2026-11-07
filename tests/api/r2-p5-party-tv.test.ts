import { describe, expect, it } from "vitest";
import { BASE, guest, uniq } from "./helpers";
import { setSetting } from "./setup";

/**
 * R2-P5 big-screen Party view: /api/v1/rooms/<code>/tv is readable by code with no session, only while the host
 * keeps the room open to watchers (default on for classroom rooms, off otherwise), never for an under-16 host, and
 * it carries nicknames and scores only.
 */
type G = Awaited<ReturnType<typeof guest>>;

async function room(host: G, classroom: boolean) {
  const r = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 8, classroom } });
  expect(r.status, JSON.stringify(r.data)).toBe(200);
  return r.data.code as string;
}

/** The TV read with no session at all, as a projector would make it. */
async function watch(code: string) {
  const res = await fetch(`${BASE}/api/v1/rooms/${code}/tv`);
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

describe("api: party big-screen view", () => {
  it("opens a classroom room to watchers by default, with nicknames and scores only", async () => {
    const teacher = await guest(uniq("tv_t"));
    const code = await room(teacher, true);
    const kid = await guest(uniq("tv_k"), "13-15");
    expect((await kid.api(`/api/v1/rooms/${code}/join`, { json: {} })).status).toBe(200);
    const r = await watch(code);
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect(r.data).toMatchObject({ code, tvOpen: true, me: "", puzzle: null, myState: null, reward: null, party: null });
    const seat = r.data.players.find((p: { nickname: string }) => p.nickname.startsWith("tv_k"));
    expect(seat).toMatchObject({ city: null, country: null, level: 0, rating: 0 });
    expect(JSON.stringify(r.data)).not.toMatch(/"messages"|"chat"/);
  });

  it("keeps other rooms closed until the host opens them, and the host can close them again", async () => {
    const host = await guest(uniq("tv_h"));
    const code = await room(host, false);
    expect((await watch(code)).status).toBe(403);
    expect((await watch(code)).data.error).toBe("tv_closed");
    const open = await host.api(`/api/v1/rooms/${code}/tv`, { json: { open: true } });
    expect(open.data).toEqual({ tvOpen: true });
    expect((await watch(code)).status).toBe(200);
    expect((await host.api(`/api/v1/rooms/${code}`)).data.view.tvOpen).toBe(true);
    await host.api(`/api/v1/rooms/${code}/tv`, { json: { open: false } });
    expect((await watch(code)).status).toBe(403);
  });

  it("only the host may switch it, and never an under-16 host", async () => {
    const host = await guest(uniq("tv_o"));
    const code = await room(host, false);
    const other = await guest(uniq("tv_x"));
    await other.api(`/api/v1/rooms/${code}/join`, { json: {} });
    expect((await other.api(`/api/v1/rooms/${code}/tv`, { json: { open: true } })).data.error).toBe("host_only");

    const young = await guest(uniq("tv_y"), "13-15");
    const yc = await room(young, false);
    const r = await young.api(`/api/v1/rooms/${yc}/tv`, { json: { open: true } });
    expect(r.status).toBe(403);
    expect(r.data.error).toBe("age_restricted");
    expect((await watch(yc)).status).toBe(403);
  });

  it("refuses unknown codes, and every room while features.partyTv is off", async () => {
    expect((await watch("ZZZZ")).status).toBe(404);
    const teacher = await guest(uniq("tv_f"));
    const code = await room(teacher, true);
    await setSetting("features.partyTv", false);
    try {
      const r = await watch(code);
      expect(r.status).toBe(404);
      expect(r.data.error).toBe("tv_off");
      expect((await teacher.api(`/api/v1/rooms/${code}/tv`, { json: { open: true } })).status).toBe(404);
    } finally {
      await setSetting("features.partyTv", true);
    }
  });

  it("serves the page itself with no session", async () => {
    const res = await fetch(`${BASE}/party/ZZZZ/tv`, { redirect: "manual" });
    expect(res.status).toBe(200);
  });
});
