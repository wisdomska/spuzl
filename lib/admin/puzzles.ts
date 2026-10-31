import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_BY_ID } from "@/lib/catalog";
import { LOGIC } from "@/games/logic-registry";
import { createRng } from "@/lib/rng";
import { dailyNumber } from "@/lib/format";
import { difficultyForDate, type ContentLogic, type Difficulty, type GameLogic, type Generated } from "@/games/types";
import { decodeSolution, encodeSolution } from "@/lib/game/solution-codec";
import { ApiError } from "@/lib/api/server";
import { solvedStates } from "./solved-state";

export type AnyLogic = GameLogic<unknown, unknown, unknown> & Partial<ContentLogic<unknown, unknown, unknown>>;

export async function logicFor(gameId: string): Promise<AnyLogic> {
  const l = LOGIC[gameId];
  if (!l) throw new ApiError(404, "game_not_ready");
  return (await l()).default as AnyLogic;
}

export const hashSolution = (solution: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(solution ?? null))
    .digest("hex");

export interface PuzzleRow {
  id: string;
  game_id: string;
  seed: string;
  difficulty: Difficulty;
  grade: number;
  data: unknown;
  solution: unknown;
  solution_hash: string;
  source: "generated" | "human";
  status: string;
  created_at: string;
  check_report: SolveReport | null;
  checked_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
  content_item_id: string | null;
}

export const PUZZLE_COLS =
  "id, game_id, seed, difficulty, grade, data, solution, solution_hash, source, status, created_at, check_report, checked_at, reviewed_by, reviewed_at, reviewer_note, content_item_id";

export async function getPuzzle(db: SupabaseClient, id: string): Promise<PuzzleRow> {
  const { data } = await db.from("puzzles").select(PUZZLE_COLS).eq("id", id).maybeSingle();
  if (!data) throw new ApiError(404, "puzzle_not_found");
  return data as PuzzleRow;
}

/* ---------------- Solve-check (FR-AD-02) ---------------- */

export type CheckStatus = "pass" | "warn" | "fail" | "info";
export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  value: string;
}
export interface SolveReport {
  ok: boolean;
  checks: Check[];
  ranAt: string;
}

const fmtMs = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Rebuilds a generated puzzle from its seed (daily:<game>:<date>, content:<game>:<i>[:tag], or any rng seed). */
export function regenerateFromSeed(logic: AnyLogic, seed: string, difficulty: Difficulty): Generated<unknown, unknown> | null {
  const content = /^content:[a-z]+:(\d+)(?::[\w-]+)?$/.exec(seed);
  if (content && logic.generateAt) return logic.generateAt(Number(content[1]), difficulty);
  const daily = /^daily:[a-z]+:(\d{4}-\d{2}-\d{2})$/.exec(seed);
  if (daily && logic.generateAt) return logic.generateAt(dailyNumber(daily[1]), difficulty);
  if (logic.generateAt) return null; // content games ignore rng seeds for Dailies
  return logic.generate(createRng(seed), difficulty);
}

export async function runSolveCheck(db: SupabaseClient, p: PuzzleRow, opts: { date?: string } = {}): Promise<SolveReport> {
  const meta = GAME_BY_ID[p.game_id];
  const logic = await logicFor(p.game_id);
  const solution = decodeSolution(p.solution);
  const checks: Check[] = [];

  // 1. Uniqueness
  if (logic.countSolutions) {
    const t = performance.now();
    let n = -1;
    try {
      n = logic.countSolutions(p.data, 2);
    } catch {
      n = -1;
    }
    const ms = Math.round(performance.now() - t);
    const required = !!meta?.unique;
    checks.push({
      id: "unique",
      label: "Unique solution",
      status: n === 1 ? "pass" : required ? "fail" : "warn",
      value: n === 1 ? `solver ${ms} ms` : n < 0 ? "solver error" : n === 0 ? "no solution" : "2 or more",
    });
  } else {
    checks.push({ id: "unique", label: "Unique solution", status: "info", value: meta?.unique ? "no solver" : "not required" });
  }

  // 2. verify() accepts the stored answer key
  let verified: string | null = null;
  for (const c of solvedStates(p.game_id, p.data, solution)) {
    try {
      if (logic.verify(p.data, solution, c.state as never).ok) {
        verified = c.via;
        break;
      }
    } catch {
      /* try the next shape */
    }
  }
  checks.push({
    id: "verify",
    label: "Verify accepts stored solution",
    status: verified ? "pass" : "warn",
    value: verified ? "verify ok" : solution === null ? "replay game, play test" : "needs play test",
  });

  // 3. Integrity of the stored answer key
  const hashOk = hashSolution(solution) === p.solution_hash || hashSolution(p.solution) === p.solution_hash;
  checks.push({ id: "hash", label: "Solution hash", status: hashOk ? "pass" : "fail", value: hashOk ? "matches" : "mismatch" });

  // 4. Difficulty against the weekly curve
  const want = opts.date ? difficultyForDate(opts.date) : null;
  checks.push({
    id: "difficulty",
    label: "Difficulty score",
    status: want && want !== p.difficulty ? "warn" : "pass",
    value: `${(p.grade / 10).toFixed(1)} / ${p.difficulty}${want && want !== p.difficulty ? `, day wants ${want}` : ""}`,
  });

  // 5. Generated puzzles must rebuild from their seed
  if (p.source === "generated") {
    let same: boolean | null = null;
    try {
      const g = regenerateFromSeed(logic, p.seed, p.difficulty);
      same = g ? hashSolution(g.solution) === p.solution_hash : null;
    } catch {
      same = false;
    }
    checks.push({
      id: "seed",
      label: "Rebuilds from its seed",
      status: same === false ? "warn" : same ? "pass" : "info",
      value: same === null ? "custom seed" : same ? "yes" : "differs",
    });
  } else {
    checks.push({ id: "seed", label: "Rebuilds from its seed", status: "info", value: "written content" });
  }

  // 6. Not a repeat of the last 365 days
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const { data: twins } = await db
    .from("puzzles")
    .select("id, dailies!dailies_puzzle_id_fkey(date)")
    .eq("game_id", p.game_id)
    .eq("solution_hash", p.solution_hash)
    .neq("id", p.id)
    .limit(20);
  const dupDates = (twins ?? [])
    .flatMap((t) => ((t as unknown as { dailies: { date: string }[] }).dailies ?? []).map((d) => d.date))
    .filter((d) => d >= since && d !== opts.date)
    .sort();
  checks.push({
    id: "duplicate",
    label: "Duplicate of past 365 days",
    status: dupDates.length ? "warn" : "pass",
    value: dupDates.length ? `same as ${dupDates[dupDates.length - 1]}` : "none",
  });

  // 7. Real solve times on this exact puzzle
  const { data: times } = await db.from("attempts").select("time_ms").eq("puzzle_id", p.id).eq("status", "cleared").limit(2000);
  const ts = (times ?? []).map((t) => t.time_ms as number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  checks.push({
    id: "median",
    label: "Median test solve",
    status: "info",
    value: ts.length ? `${fmtMs(ts[Math.floor(ts.length / 2)])} (n=${ts.length})` : "no clears yet",
  });

  return { ok: !checks.some((c) => c.status === "fail"), checks, ranAt: new Date().toISOString() };
}

/** Runs the check and stores its report on the puzzle. */
export async function checkAndStore(db: SupabaseClient, p: PuzzleRow, date?: string): Promise<SolveReport> {
  const report = await runSolveCheck(db, p, { date });
  await db.from("puzzles").update({ check_report: report, checked_at: report.ranAt }).eq("id", p.id);
  return report;
}

/* ---------------- Fresh puzzles (regenerate, swap, fill gaps) ---------------- */

/**
 * A new, verified puzzle for (game, date): unique where the game requires it, and verify() accepts the
 * answer key whenever the game has a solved-state shape. Tries a few seeds before giving up.
 */
export async function freshPuzzle(gameId: string, date: string, tag: string, avoidHash?: string) {
  const logic = await logicFor(gameId);
  const meta = GAME_BY_ID[gameId];
  const difficulty = difficultyForDate(date);
  for (let attempt = 0; attempt < 6; attempt++) {
    let seed: string;
    let g: Generated<unknown, unknown>;
    if (logic.generateAt && logic.contentCount) {
      const i = createRng(`${tag}:${gameId}:${date}:${randomUUID()}`).int(0, logic.contentCount - 1);
      seed = `content:${gameId}:${i}:${tag}-${randomUUID().slice(0, 8)}`;
      g = logic.generateAt(i, difficulty);
    } else {
      seed = `${tag}:${gameId}:${date}:${randomUUID().slice(0, 8)}`;
      g = logic.generate(createRng(seed), difficulty);
    }
    const hash = hashSolution(g.solution);
    if (avoidHash && hash === avoidHash) continue;
    if (meta?.unique && logic.countSolutions && logic.countSolutions(g.puzzle, 2) !== 1) continue;
    return { seed, difficulty, gen: g, hash };
  }
  throw new ApiError(422, "no_valid_puzzle", "Could not generate a verified puzzle. Try again.");
}

export async function insertPuzzle(
  db: SupabaseClient,
  row: { game_id: string; seed: string; difficulty: Difficulty; gen: Generated<unknown, unknown>; hash: string },
  extra: { status: string; source?: "generated" | "human"; content_item_id?: string; reviewed_by?: string | null },
): Promise<string> {
  const { data, error } = await db
    .from("puzzles")
    .insert({
        game_id: row.game_id,
        seed: row.seed,
        difficulty: row.difficulty,
        grade: row.gen.grade,
        data: row.gen.puzzle,
        solution: encodeSolution(row.gen.solution),
        solution_hash: row.hash,
        source: extra.source ?? "generated",
        status: extra.status,
        content_item_id: extra.content_item_id ?? null,
        reviewed_by: extra.reviewed_by ?? null,
        reviewed_at: extra.reviewed_by ? new Date().toISOString() : null,
      })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
