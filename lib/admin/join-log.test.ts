import { describe, expect, it } from "vitest";
import { joinLogCsv, joinLogFilename, parseJoinLogFilters, type JoinLogRow } from "./join-log";

const row = (over: Partial<JoinLogRow> = {}): JoinLogRow => ({
  id: "r1",
  created_at: "2026-11-06T10:15:30.000Z",
  decided_at: "2026-11-06T10:16:02.000Z",
  status: "approved",
  room_kind: "party",
  room_code: "QJRA",
  requester_id: "p1",
  requester: "Ama",
  host_id: "h1",
  host: "Kofi",
  ...over,
});

describe("join-approval log (R2-13)", () => {
  it("accepts the known filters and refuses anything else", () => {
    expect(parseJoinLogFilters({})).toEqual({ ok: true, filters: { status: "", kind: "", q: "", from: "", to: "" } });
    expect(parseJoinLogFilters({ status: "declined", kind: "duel", q: "Kofi", from: "2026-11-01", to: "2026-11-06" }).ok).toBe(true);
    expect(parseJoinLogFilters({ status: "maybe" })).toEqual({ ok: false, error: "bad_status" });
    expect(parseJoinLogFilters({ kind: "bay" })).toEqual({ ok: false, error: "bad_kind" });
    expect(parseJoinLogFilters({ from: "6/11/2026" })).toEqual({ ok: false, error: "bad_date" });
    expect(parseJoinLogFilters({ from: "2026-11-07", to: "2026-11-01" })).toEqual({ ok: false, error: "bad_range" });
    expect(parseJoinLogFilters({ q: "a,b)" })).toEqual({ ok: false, error: "bad_query" });
    expect(parseJoinLogFilters({ q: "%" })).toEqual({ ok: false, error: "bad_query" });
  });

  it("writes one CSV row per request with who, host, room, outcome and times (GMT, to the minute)", () => {
    const csv = joinLogCsv([row(), row({ id: "r2", status: "pending", decided_at: null, requester: "=cmd", room_kind: "duel" })])
      .trimEnd()
      .split("\r\n");
    expect(csv[0]).toBe("asked_at_gmt,requester,requester_id,host,host_id,room,code,outcome,decided_at_gmt");
    expect(csv[1]).toBe("2026-11-06 10:15,Ama,p1,Kofi,h1,party,QJRA,approved,2026-11-06 10:16");
    expect(csv[2]).toBe("2026-11-06 10:15,'=cmd,p1,Kofi,h1,duel,QJRA,pending,");
  });

  it("names the file after the range", () => {
    expect(joinLogFilename({ status: "", kind: "", q: "", from: "2026-11-01", to: "" }, "2026-11-06")).toBe(
      "spuzl-join-requests-2026-11-01-to-2026-11-06.csv",
    );
  });
});
