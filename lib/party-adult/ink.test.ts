import { describe, expect, it } from "vitest";
import {
  INK,
  INK_RELAY,
  InkBatcher,
  applyInk,
  checkBatch,
  inkTopic,
  decodePoints,
  encodePoints,
  livePath,
  parseInk,
  pruneLive,
  quantise,
  stepShown,
  visiblePoints,
  type InkBatch,
  type LiveLines,
} from "./ink";

const lead = "11111111-1111-1111-1111-111111111111";
const expect1 = { leadId: lead, round: 2, drawing: true };
const wire = (o: Record<string, unknown> = {}) => ({ by: lead, r: 2, s: 1, c: 0, w: 1, i: 0, p: [10, 10, 5, -3], ...o });

describe("live ink: quantise and encode", () => {
  it("rounds to whole board units and clamps to the board", () => {
    expect(quantise(10.4, 10.6)).toEqual([10, 11]);
    expect(quantise(-5, 1200)).toEqual([0, 1000]);
    expect(quantise(NaN, Infinity)).toEqual([0, 0]);
  });

  it("sends the first point absolute and the rest as deltas, and decodes back", () => {
    const abs = [100, 200, 103, 198, 110, 190];
    const enc = encodePoints(abs);
    expect(enc).toEqual([100, 200, 3, -2, 7, -8]);
    expect(decodePoints(enc)).toEqual(abs);
    expect(encodePoints([])).toEqual([]);
  });

  it("rejects malformed or off-board batches", () => {
    expect(decodePoints("nope")).toBeNull();
    expect(decodePoints([1, 2, 3])).toBeNull();
    expect(decodePoints([1.5, 2])).toBeNull();
    expect(decodePoints([990, 10, 20, 0])).toBeNull(); // walks off the board
    expect(decodePoints(Array.from({ length: INK.maxPerBatch * 2 + 2 }, () => 0))).toBeNull();
  });
});

describe("live ink: only the drawer, only this round", () => {
  it("keeps a valid batch from the drawer", () => {
    expect(parseInk(wire(), expect1)).toEqual({ s: 1, c: 0, w: 1, i: 0, p: [10, 10, 15, 7], end: false });
    expect(parseInk(wire({ p: [], e: 1 }), expect1)).toMatchObject({ p: [], end: true });
  });

  it("ignores anyone else, other rounds, and rounds not drawing", () => {
    expect(parseInk(wire({ by: "someone-else" }), expect1)).toBeNull();
    expect(parseInk(wire({ r: 3 }), expect1)).toBeNull();
    expect(parseInk(wire(), { ...expect1, drawing: false })).toBeNull();
    expect(parseInk(wire(), { ...expect1, leadId: null })).toBeNull();
  });

  it("ignores out-of-range fields and empty batches without the end mark", () => {
    expect(parseInk(wire({ c: 99 }), expect1)).toBeNull();
    expect(parseInk(wire({ w: -1 }), expect1)).toBeNull();
    expect(parseInk(wire({ s: 0 }), expect1)).toBeNull();
    expect(parseInk(wire({ i: 1.5 }), expect1)).toBeNull();
    expect(parseInk(wire({ p: [] }), expect1)).toBeNull();
    expect(parseInk(null, expect1)).toBeNull();
  });
});

describe("live ink: the relay's checks (R4-24)", () => {
  it("checks a posted batch with the viewers' rules, without a sender or round (the server stamps those)", () => {
    const posted: Record<string, unknown> = wire();
    delete posted.by;
    delete posted.r;
    expect(checkBatch(posted)).toEqual({ s: 1, c: 0, w: 1, i: 0, p: [10, 10, 15, 7], end: false });
    expect(checkBatch({ ...posted, c: 99 })).toBeNull();
    expect(checkBatch({ ...posted, p: [990, 10, 20, 0] })).toBeNull();
    expect(checkBatch({ ...posted, p: [] })).toBeNull();
    expect(checkBatch("nope")).toBeNull();
  });

  it("names the room's server-written ink channel and the relay route", () => {
    expect(inkTopic("abc")).toBe("ink:abc");
    expect(INK_RELAY).toBe("/api/v1/ink");
  });
});

describe("live ink: batching on the drawer's side", () => {
  it("batches points, drops near duplicates, and numbers lines", () => {
    const b = new InkBatcher();
    expect(b.take()).toBeNull(); // no line yet
    b.start(2, 0);
    b.add(100, 100);
    b.add(101, 100); // closer than minGap: dropped
    b.add(110.2, 100);
    const one = b.take()!;
    expect(one).toEqual({ s: 1, c: 2, w: 0, i: 0, p: [100, 100, 10, 0] });
    expect(b.take()).toBeNull(); // nothing new
    b.add(120, 100);
    const end = b.take(true)!;
    expect(end).toEqual({ s: 1, c: 2, w: 0, i: 2, p: [120, 100], e: 1 });
    expect(b.drawing).toBe(false);
    b.start(0, 0);
    expect(b.take(true)).toMatchObject({ s: 2, i: 0, p: [], e: 1 });
  });

  it("caps a batch and puts the end mark on the last one", () => {
    const b = new InkBatcher();
    b.start(0, 0);
    for (let k = 0; k < INK.maxPerBatch + 10; k++) b.add(k * 5, 0);
    const first = b.take(true)!;
    expect(first.p.length).toBe(INK.maxPerBatch * 2);
    expect(first.e).toBeUndefined();
    const last = b.take(true)!;
    expect(last.i).toBe(INK.maxPerBatch);
    expect(last.p.length).toBe(20);
    expect(last.e).toBe(1);
  });

  it("stops adding points past the per-line cap", () => {
    const b = new InkBatcher();
    b.start(0, 0);
    let n = 0;
    for (let k = 0; k < INK.maxPoints + 50; k++) {
      b.add((k * 7) % 1000, Math.floor((k * 7) / 1000) * 5);
      const t = b.take();
      if (t) n += t.p.length / 2;
    }
    expect(n).toBe(INK.maxPoints);
  });
});

describe("live ink: viewer lines", () => {
  const batch = (o: Partial<InkBatch> = {}): InkBatch => ({ s: 1, c: 0, w: 0, i: 0, p: [0, 0, 10, 0], end: false, ...o });

  it("appends in order, skips repeats and overlap", () => {
    const lines: LiveLines = new Map();
    applyInk(lines, batch(), 0, 0);
    applyInk(lines, batch(), 10, 0); // repeat
    applyInk(lines, batch({ i: 1, p: [10, 0, 20, 0] }), 20, 0); // one point overlaps
    expect(lines.get(1)!.pts).toEqual([0, 0, 10, 0, 20, 0]);
  });

  it("keeps at most INK.maxLines lines, dropping the oldest", () => {
    const lines: LiveLines = new Map();
    for (let s = 1; s <= INK.maxLines + 1; s++) applyInk(lines, batch({ s }), s, 0);
    expect(lines.size).toBe(INK.maxLines);
    expect(lines.has(1)).toBe(false);
  });

  it("drops a finished line once the stored drawing changes, or after the hold", () => {
    const lines: LiveLines = new Map();
    applyInk(lines, batch({ end: true }), 0, 3);
    expect(pruneLive(lines, 100, 3)).toBe(false);
    expect(pruneLive(lines, 100, 4)).toBe(true);
    applyInk(lines, batch({ s: 2, end: true }), 0, 4);
    expect(pruneLive(lines, INK.holdMs + 1, 4)).toBe(true);
    expect(lines.size).toBe(0);
  });

  it("drops an unfinished line that goes quiet", () => {
    const lines: LiveLines = new Map();
    applyInk(lines, batch(), 0, 0);
    expect(pruneLive(lines, INK.quietMs - 1, 9)).toBe(false); // stored changes don't drop a line still drawing
    expect(pruneLive(lines, INK.quietMs + 1, 9)).toBe(true);
  });
});

describe("live ink: interpolation", () => {
  it("eases the backlog in over about one batch, and shows everything with reduced motion", () => {
    expect(stepShown(0, 10, INK.batchMs / 2, false)).toBeCloseTo(5);
    expect(stepShown(0, 10, INK.batchMs, false)).toBe(10);
    expect(stepShown(4, 10, 0, true)).toBe(10);
    expect(stepShown(9.995, 10, 1, false)).toBe(10);
    // Never more than two batches behind.
    expect(stepShown(0, 500, 1, false)).toBeGreaterThanOrEqual(500 - INK.maxPerBatch * 2);
  });

  it("draws the tip part way along the next segment", () => {
    const pts = [0, 0, 10, 0, 10, 20];
    expect(visiblePoints(pts, 0)).toEqual([]);
    expect(visiblePoints(pts, 1.5)).toEqual([0, 0, 5, 0]);
    expect(visiblePoints(pts, 2.25)).toEqual([0, 0, 10, 0, 10, 5]);
    expect(visiblePoints(pts, 3)).toEqual(pts);
    expect(visiblePoints(pts, 99)).toEqual(pts);
  });

  it("builds path data, a dot for a single point", () => {
    expect(livePath([])).toBe("");
    expect(livePath([5, 6])).toBe("M5 6L5 6");
    expect(livePath([0, 0, 2.25, 3])).toBe("M0 0L2.3 3");
  });
});
