import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { can } from "@/lib/admin/roles";

const noDash = (s: string) => !/[–—]/.test(s);
const label = z.string().trim().min(1).max(80).refine(noDash, "No em or en dashes");
const Id = z.string().regex(/^[a-z0-9_-]{2,40}$/);

interface CatalogKind {
  table: string;
  cols: string;
  order: string;
  patch: z.ZodType<Record<string, unknown>>;
  create: z.ZodType<Record<string, unknown> & { id: string }>;
}

/** Editable fields per catalogue table (FR-AD-04). Sparks prices need the prices.write permission. */
const KINDS: Record<"badges" | "quests" | "cosmetics", CatalogKind> = {
  badges: {
    table: "badges",
    cols: "id, family, tier, name, description, secret, sparks, rule, sort",
    order: "sort",
    patch: z
      .object({
        name: label,
        description: z.string().trim().min(1).max(200).refine(noDash),
        secret: z.boolean(),
        sparks: z.number().int().min(0).max(5000),
        sort: z.number().int(),
      })
      .partial()
      .strict(),
    create: z.object({
      id: Id,
      family: z.string().min(2).max(30),
      tier: z.enum(["bronze", "silver", "gold", "prism"]),
      name: label,
      description: z.string().trim().min(1).max(200).refine(noDash),
      sparks: z.number().int().min(0).max(5000).default(10),
      secret: z.boolean().default(false),
      rule: z.record(z.string(), z.unknown()).default({}),
    }),
  },
  quests: {
    table: "quests",
    cols: "id, kind, title, goal, xp, sparks, step, active",
    order: "id",
    patch: z
      .object({
        title: label,
        xp: z.number().int().min(0).max(5000),
        sparks: z.number().int().min(0).max(5000),
        active: z.boolean(),
        goal: z.record(z.string(), z.unknown()),
      })
      .partial()
      .strict(),
    create: z.object({
      id: Id,
      kind: z.enum(["daily", "weekly"]),
      title: label,
      goal: z.record(z.string(), z.unknown()),
      xp: z.number().int().min(0).max(5000).default(30),
      sparks: z.number().int().min(0).max(5000).default(10),
      active: z.boolean().default(false),
    }),
  },
  cosmetics: {
    table: "cosmetics",
    cols: "id, type, name, price_sparks, rarity, payload, unlock_level, active, sort",
    order: "sort",
    patch: z
      .object({
        name: label,
        price_sparks: z.number().int().min(0).max(100_000),
        rarity: z.enum(["common", "rare", "epic", "legendary"]),
        active: z.boolean(),
        unlock_level: z.number().int().min(1).max(500).nullable(),
        sort: z.number().int(),
      })
      .partial()
      .strict(),
    create: z.object({
      id: Id,
      type: z.enum(["skin", "hat", "board_theme", "title", "frame", "freeze", "hint_pack"]),
      name: label,
      price_sparks: z.number().int().min(0).max(100_000),
      rarity: z.enum(["common", "rare", "epic", "legendary"]).default("common"),
      payload: z.record(z.string(), z.unknown()).default({}),
      active: z.boolean().default(false),
    }),
  },
};

type Kind = keyof typeof KINDS;
const kindOf = (k: string): Kind => {
  if (!(k in KINDS)) throw new ApiError(404, "unknown_catalog");
  return k as Kind;
};

/** GET /api/admin/catalog/:kind: badges, quests or cosmetics (all rows, active or not). */
export const GET = handle(async (_req: Request, rc: RouteContext<"/api/admin/catalog/[kind]">) => {
  const ctx = await requireAdmin("catalog.read");
  const k = KINDS[kindOf((await rc.params).kind)];
  const { data, error } = await ctx.db.from(k.table).select(k.cols).order(k.order);
  if (error) throw error;
  return ok({ rows: data ?? [] });
});

/** PATCH /api/admin/catalog/:kind  { id, patch } */
export const PATCH = handle(async (req: Request, rc: RouteContext<"/api/admin/catalog/[kind]">) => {
  const ctx = await requireAdmin("catalog.write");
  const kind = kindOf((await rc.params).kind);
  const k = KINDS[kind];
  const b = await body(req, z.object({ id: Id, patch: z.record(z.string(), z.unknown()) }));
  const patch = k.patch.parse(b.patch);
  if (!Object.keys(patch).length) throw new ApiError(400, "empty_patch");
  if ("price_sparks" in patch && !can(ctx.role, "prices.write"))
    throw new ApiError(403, "forbidden", "Only the owner changes Sparks prices.");
  const { data: before } = await ctx.db.from(k.table).select(Object.keys(patch).join(", ")).eq("id", b.id).maybeSingle();
  if (!before) throw new ApiError(404, "not_found");
  const { data, error } = await ctx.db.from(k.table).update(patch).eq("id", b.id).select(k.cols).single();
  if (error) throw error;
  await audit(ctx, "price_sparks" in patch ? `${kind}.price` : `${kind}.update`, `${kind}:${b.id}`, { before, after: patch });
  return ok(data);
});

/** POST /api/admin/catalog/:kind: a new badge, quest or cosmetic (inactive by default). */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/catalog/[kind]">) => {
  const ctx = await requireAdmin("catalog.write");
  const kind = kindOf((await rc.params).kind);
  const k = KINDS[kind];
  const row = k.create.parse(await body(req, z.record(z.string(), z.unknown())));
  if (kind === "cosmetics" && !can(ctx.role, "prices.write")) throw new ApiError(403, "forbidden", "Only the owner sets Sparks prices.");
  const { data, error } = await ctx.db.from(k.table).insert(row).select(k.cols).single();
  if (error) {
    if (error.code === "23505") throw new ApiError(409, "id_taken");
    throw error;
  }
  await audit(ctx, `${kind}.create`, `${kind}:${row.id}`, row);
  return ok(data);
});
