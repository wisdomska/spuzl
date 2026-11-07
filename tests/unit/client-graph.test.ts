import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOGIC } from "@/games/logic-registry";
import { LOGIC_IDS } from "@/games/logic-ids";

/**
 * Client bundles never carry the Quickfire question bank (its rows hold the answers) nor its logic module.
 * Walks the import graph from every "use client" module (static, re-export and dynamic imports; type-only
 * imports are erased and skipped) and fails with the import chain when a server-only module is reachable.
 */
const ROOT = path.resolve(__dirname, "../..");
const SKIP = new Set(["node_modules", ".next", ".git", ".claude"]);

function sources(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")])
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}

const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function deps(file: string): string[] {
  const text = fs.readFileSync(file, "utf8");
  const out: string[] = [];
  for (const m of text.matchAll(IMPORT)) {
    if (m[1]) continue; // `import type` / `export type`: erased
    const r = resolve(file, m[2] ?? m[3]);
    if (r) out.push(r);
  }
  return out;
}

/** Every module reachable from a client module, with the module that first pulled it in. */
function clientGraph(): Map<string, string | null> {
  const files = ["app", "components", "lib", "games"].flatMap((d) => sources(path.join(ROOT, d)));
  const roots = files.filter((f) => /^\s*["']use client["']/.test(fs.readFileSync(f, "utf8")));
  const via = new Map<string, string | null>(roots.map((r) => [r, null]));
  const queue = [...roots];
  while (queue.length) {
    const f = queue.shift()!;
    // A "use server" module reaches the client as action references only; its imports stay on the server.
    if (/^\s*["']use server["']/.test(fs.readFileSync(f, "utf8"))) continue;
    for (const d of deps(f))
      if (!via.has(d)) {
        via.set(d, f);
        queue.push(d);
      }
  }
  return via;
}

function chain(via: Map<string, string | null>, target: string): string {
  const out: string[] = [];
  for (let c: string | null | undefined = target; c; c = via.get(c)) out.push(path.relative(ROOT, c));
  return out.reverse().join(" -> ");
}

describe("client bundles", () => {
  const via = clientGraph();

  it("logic-ids lists exactly the logic registry's games", () => {
    expect([...LOGIC_IDS].sort()).toEqual(Object.keys(LOGIC).sort());
  });

  it("finds client modules to start from", () => {
    expect(via.has(path.join(ROOT, "games/quickfire/Board.tsx"))).toBe(true);
  });

  it.each([
    "games/quickfire/content.ts",
    "games/quickfire/logic.ts",
    "games/twotruths/content.ts",
    "games/twotruths/logic.ts",
    "games/logic-registry.ts",
  ])("never reach %s", (target) => {
    const t = path.join(ROOT, target);
    expect(via.has(t) ? chain(via, t) : null).toBeNull();
  });
});
