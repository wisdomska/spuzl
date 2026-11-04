/**
 * Level variety for the Arcade course ladders (Gotcha, Dash). The designer can draw many rooms that play the same
 * way: the same hazards over the same kind of ground. `motif` sums a room up in those terms, and `curate` keeps
 * the ladder's order but drops a generated room once its motif has been used twice, and moves rooms a few places
 * so two in a row never share one. Hand rooms and set pieces always stay. Used by scripts/rage-design.ts and
 * scripts/rage-curate.ts; lib/game/levels.test.ts holds the ladders to it.
 */
import type { LevelDef } from "@/phaser/sim/level";

const bucket = (n: number, cuts: number[]) => cuts.filter((c) => n >= c).length;

/**
 * What a room asks of the player. A short room is summed up by its traps, static spikes, gaps and ledges,
 * coarsely. A long room with four or more traps (Gotcha's Level Devil rooms) has all of those, so it is told
 * apart by the order its tricks come in: "bdse" is a pop-up wall, a dropping floor, spikes, then a running exit.
 */
export function motif(l: LevelDef): string {
  const traps = l.traps ?? {};
  if (Object.keys(traps).length >= 4) {
    const firstX = (id: string) => Math.min(...(l.triggers ?? []).filter((t) => t.fire.includes(id)).map((t) => t.zone[0]));
    const letter = { drop: "d", spikes: "s", block: "b", exit: "e" } as const;
    return Object.keys(traps)
      .sort((a, b) => firstX(a) - firstX(b))
      .map((id) => letter[traps[id].kind])
      .join("");
  }
  return shortMotif(l);
}

function shortMotif(l: LevelDef): string {
  const rows = l.tiles;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const at = (x: number, y: number) => rows[y]?.[x] ?? ".";
  const kinds = [...new Set(Object.values(l.traps ?? {}).map((t) => t.kind))].sort();
  let spikes = 0;
  for (const r of rows) for (const c of r) if (c === "^") spikes++;
  // ground: the top solid tile of each column; a column with none (or only trap tiles) is a gap
  let gaps = 0;
  let steps = 0;
  let prev = -1;
  for (let x = 0; x < w; x++) {
    let top = -1;
    for (let y = 0; y < h; y++)
      if (at(x, y) === "#") {
        top = y;
        break;
      }
    if (top < 0) gaps++;
    else if (prev >= 0 && top !== prev) steps++;
    if (top >= 0) prev = top;
  }
  return [kinds.join("+") || "none", `s${bucket(spikes, [1, 4, 8])}`, `g${bucket(gaps, [1, 3])}`, `t${bucket(steps, [1, 3, 6])}`].join("|");
}

/**
 * Keeps `ladder` order, drops generated rooms whose motif is already used `cap` times, then reorders locally so
 * neighbours differ (a room may move a few places, never across far difficulty).
 */
export function curate(ladder: string[], byId: Map<string, LevelDef>, fixed: Set<string>, cap = 2): string[] {
  const used = new Map<string, number>();
  const kept: string[] = [];
  for (const id of ladder) {
    const m = motif(byId.get(id)!);
    const n = used.get(m) ?? 0;
    if (!fixed.has(id) && n >= cap) continue;
    used.set(m, n + 1);
    kept.push(id);
  }
  // no two neighbours alike: pull the next different room (within 4 places) forward
  const out = kept.slice();
  for (let i = 1; i < out.length; i++) {
    if (motif(byId.get(out[i])!) !== motif(byId.get(out[i - 1])!)) continue;
    for (let j = i + 1; j < Math.min(out.length, i + 5); j++) {
      if (motif(byId.get(out[j])!) !== motif(byId.get(out[i - 1])!)) {
        const [x] = out.splice(j, 1);
        out.splice(i, 0, x);
        break;
      }
    }
  }
  return out;
}
