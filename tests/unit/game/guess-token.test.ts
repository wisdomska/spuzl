import { describe, expect, it } from "vitest";
import five from "@/games/five/logic";
import penalty from "@/games/penalty/logic";
import hunch from "@/games/hunch/logic";
import { isGuessToken } from "@/games/_shared/guess";
import {
  TOKEN_TTL_S,
  bindPuzzle,
  contentRefOf,
  guessSecret,
  openGuessToken,
  sealGuessToken,
  type TokenPayload,
} from "@/lib/game/guess-token";

const KEY = "test-secret";
const NOW = Date.UTC(2026, 10, 14, 12);
const PLAYER = "11111111-1111-4111-8111-111111111111";
const ATTEMPT = "22222222-2222-4222-8222-222222222222";
const payload = (over: Partial<TokenPayload> = {}): TokenPayload => ({
  g: "five",
  i: 7,
  d: "medium",
  p: PLAYER,
  c: { k: "a", a: ATTEMPT },
  x: NOW / 1000 + 60,
  ...over,
});

describe("guess tokens", () => {
  it("round-trips a payload and hides it from the client", () => {
    const t = sealGuessToken(payload(), KEY);
    expect(openGuessToken(t, KEY, NOW)).toEqual(payload());
    // Nothing readable: the index, difficulty, player and attempt are not in the token.
    const text = Buffer.from(t.slice(2), "base64url").toString("latin1");
    for (const s of ["five", "medium", PLAYER, ATTEMPT, '"i":7']) expect(text).not.toContain(s);
    // Fresh IV each time: the same payload never gives the same token (no lookup table of indices).
    expect(sealGuessToken(payload(), KEY)).not.toBe(t);
  });

  it("refuses tampered, forged, foreign-key, expired and malformed tokens", () => {
    const t = sealGuessToken(payload(), KEY);
    const body = t.slice(2);
    const flipped = `1.${body.slice(0, 10)}${body[10] === "A" ? "B" : "A"}${body.slice(11)}`;
    expect(openGuessToken(flipped, KEY, NOW)).toBeNull();
    expect(openGuessToken(t, "other-secret", NOW)).toBeNull();
    expect(openGuessToken(t, KEY, NOW + 61_000)).toBeNull();
    expect(openGuessToken(`2.${body}`, KEY, NOW)).toBeNull();
    for (const bad of [null, 7, "", "1.", "1.AAAA", "x".repeat(700), { t }]) expect(openGuessToken(bad, KEY, NOW)).toBeNull();
    // A well-sealed but ill-formed payload is refused too.
    const odd = sealGuessToken({ ...payload(), d: "silly" } as unknown as TokenPayload, KEY);
    expect(openGuessToken(odd, KEY, NOW)).toBeNull();
    const noCtx = sealGuessToken({ ...payload(), c: { k: "z" } } as unknown as TokenPayload, KEY);
    expect(openGuessToken(noCtx, KEY, NOW)).toBeNull();
    const negative = sealGuessToken(payload({ i: -1 }), KEY);
    expect(openGuessToken(negative, KEY, NOW)).toBeNull();
  });

  it("keeps each context's fields", () => {
    for (const c of [{ k: "a", a: ATTEMPT }, { k: "m", m: ATTEMPT, s: 2, r: 3 }, { k: "p" }] as const) {
      const t = sealGuessToken(payload({ c }), KEY);
      expect(openGuessToken(t, KEY, NOW)?.c).toEqual(c);
    }
    const bad = sealGuessToken(payload({ c: { k: "m", m: ATTEMPT, s: 1.5, r: 1 } }), KEY);
    expect(openGuessToken(bad, KEY, NOW)).toBeNull();
  });

  it("binds a content puzzle: the reference becomes a token for that player and context", () => {
    const g = five.generateAt(7, "medium");
    const bound = bindPuzzle(g.puzzle, PLAYER, { k: "a", a: ATTEMPT }, KEY, NOW);
    expect(isGuessToken(bound.ref)).toBe(true);
    expect(bound.ref).toEqual({ game: "five", t: expect.any(String) });
    expect({ ...bound, ref: null }).toEqual({ ...g.puzzle, ref: null });
    // The generator's puzzle is left alone (the server still checks against it).
    expect(contentRefOf(g.puzzle)).toEqual({ game: "five", i: 7, d: "medium" });
    const p = openGuessToken((bound.ref as { t: string }).t, KEY, NOW)!;
    expect(p).toMatchObject({ g: "five", i: 7, d: "medium", p: PLAYER, c: { k: "a", a: ATTEMPT } });
    expect(p.x).toBe(Math.floor(NOW / 1000) + TOKEN_TTL_S.a);
    expect(openGuessToken((bound.ref as { t: string }).t, KEY, NOW + TOKEN_TTL_S.a * 1000)).toBeNull();
  });

  it("binds Penalty King without leaking the index the keeper's dives follow from", () => {
    const g = penalty.generateAt(3, "hard");
    const bound = bindPuzzle(g.puzzle, PLAYER, { k: "m", m: ATTEMPT, s: 1, r: 2 }, KEY, NOW);
    expect(JSON.stringify(bound)).not.toMatch(/"i":|"dives"/);
    expect(openGuessToken((bound.ref as { t: string }).t, KEY, NOW)?.x).toBe(Math.floor(NOW / 1000) + TOKEN_TTL_S.m);
  });

  it("leaves logic games, sealed quiz salts and odd values alone", () => {
    const h = hunch.generateAt(0, "easy");
    expect(bindPuzzle(h.puzzle, PLAYER, { k: "p" }, KEY, NOW)).toBe(h.puzzle);
    expect(bindPuzzle({ size: 5 }, PLAYER, { k: "p" }, KEY, NOW)).toEqual({ size: 5 });
    expect(bindPuzzle(null, PLAYER, { k: "p" }, KEY, NOW)).toBeNull();
    expect(contentRefOf({ ref: { game: "five", i: 1.5, d: "easy" } })).toBeNull();
    expect(contentRefOf({ ref: { game: "five", i: 1, d: "silly" } })).toBeNull();
    expect(contentRefOf({ ref: { game: "five", t: "x" } })).toBeNull();
  });

  it("takes its secret from GUESS_REF_SECRET, then the service key; production needs one", () => {
    expect(guessSecret({ GUESS_REF_SECRET: "a", SUPABASE_SERVICE_ROLE_KEY: "b" })).toBe("a");
    expect(guessSecret({ SUPABASE_SERVICE_ROLE_KEY: "b" })).toBe("b");
    expect(guessSecret({})).toBeTruthy();
    expect(() => guessSecret({ NODE_ENV: "production" })).toThrow();
  });
});
