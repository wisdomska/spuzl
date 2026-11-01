/**
 * Admin list sorting, shared by the API routes and the console: `?sort=<column>&dir=asc|desc`. Each list has a
 * spec with an allow-list of sortable columns; the API rejects anything else (400 bad_sort) and the console
 * falls back to the default. Pure, so the client, the server and the unit tests all use it.
 */
export type SortDir = "asc" | "desc";
export const SORT_DIRS: readonly SortDir[] = ["asc", "desc"];

export interface SortSpec<K extends string = string> {
  /** Columns the API accepts, in no particular order. */
  keys: readonly K[];
  /** Column and direction when the URL names none. */
  default: K;
  dir: SortDir;
  /** Direction a column takes when first picked; ascending unless listed (dates and counts read best descending). */
  firstDir?: Partial<Record<K, SortDir>>;
}

export interface SortState<K extends string = string> {
  sort: K;
  dir: SortDir;
}

type Search = Pick<URLSearchParams, "get">;

const isDir = (v: unknown): v is SortDir => v === "asc" || v === "desc";
const isKey = <K extends string>(spec: SortSpec<K>, v: unknown): v is K =>
  typeof v === "string" && (spec.keys as readonly string[]).includes(v);

/** Strict parse for the API: missing params take the default, anything else must be on the allow-list. */
export function parseSortQuery<K extends string>(
  sp: Search,
  spec: SortSpec<K>,
): { success: true; data: SortState<K> } | { success: false; error: string } {
  const sort = sp.get("sort");
  const dir = sp.get("dir");
  if (sort !== null && !isKey(spec, sort)) return { success: false, error: `sort must be one of ${spec.keys.join(", ")}` };
  if (dir !== null && !isDir(dir)) return { success: false, error: "dir must be asc or desc" };
  const key = sort ?? spec.default;
  return { success: true, data: { sort: key, dir: dir ?? (sort === null ? spec.dir : (spec.firstDir?.[key] ?? "asc")) } };
}

/** Lenient read for the console: an unknown column or direction falls back to the default. */
export function readSortParams<K extends string>(sp: Search, spec: SortSpec<K>): SortState<K> {
  const sort = sp.get("sort");
  const dir = sp.get("dir");
  if (!isKey(spec, sort)) return { sort: spec.default, dir: spec.dir };
  return { sort, dir: isDir(dir) ? dir : (spec.firstDir?.[sort] ?? "asc") };
}

/** Next state when a column header is pressed: the same column flips, a new column starts in its first direction. */
export function toggleSort<K extends string>(current: SortState<K>, key: K, spec: SortSpec<K>): SortState<K> {
  if (current.sort === key) return { sort: key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { sort: key, dir: key === spec.default ? spec.dir : (spec.firstDir?.[key] ?? "asc") };
}

/** The address-bar query string with the sort applied. The default sort is left out; the page goes back to 1. */
export function withSortParams<K extends string>(search: string, next: SortState<K>, spec: SortSpec<K>): string {
  const params = new URLSearchParams(search);
  if (next.sort === spec.default && next.dir === spec.dir) {
    params.delete("sort");
    params.delete("dir");
  } else {
    params.set("sort", next.sort);
    params.set("dir", next.dir);
  }
  params.delete("page");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** The API query string for a sort. */
export const sortQueryString = ({ sort, dir }: SortState) => `sort=${encodeURIComponent(sort)}&dir=${dir}`;

/** `aria-sort` for a column header. */
export function ariaSort(current: SortState, key: string): "ascending" | "descending" | "none" {
  if (current.sort !== key) return "none";
  return current.dir === "asc" ? "ascending" : "descending";
}

/** Builds a spec with its keys type-checked against `default` and `firstDir`. */
export const sortSpec = <const K extends string>(spec: SortSpec<K>): SortSpec<K> => spec;

/* ---------- Sortable columns per admin list. The API maps each key to a column; the console labels them. ---------- */

export const PUZZLE_SORT = sortSpec({
  keys: ["created_at", "game", "grade", "status", "source", "checked_at"],
  default: "created_at",
  dir: "desc",
  firstDir: { grade: "desc", checked_at: "desc" },
});

export const MODERATION_SORT = sortSpec({
  keys: ["created_at", "kind", "status"],
  default: "created_at",
  dir: "desc",
});

export const CONTENT_SORT = sortSpec({
  keys: ["updated_at", "game", "status"],
  default: "updated_at",
  dir: "desc",
});

export const AUDIT_SORT = sortSpec({
  keys: ["created_at", "action", "target"],
  default: "created_at",
  dir: "desc",
});

export const EVENT_SORT = sortSpec({
  keys: ["starts_at", "ends_at", "name"],
  default: "starts_at",
  dir: "desc",
  firstDir: { ends_at: "desc" },
});

export const TEAM_SORT = sortSpec({
  keys: ["created_at", "email", "role", "totp"],
  default: "created_at",
  dir: "desc",
});

export const CATALOG_SORT = {
  cosmetics: sortSpec({
    keys: ["sort", "name", "type", "price", "active"],
    default: "sort",
    dir: "asc",
    firstDir: { price: "desc", active: "desc" },
  }),
  badges: sortSpec({
    keys: ["sort", "name", "family", "sparks", "secret"],
    default: "sort",
    dir: "asc",
    firstDir: { sparks: "desc", secret: "desc" },
  }),
  quests: sortSpec({
    keys: ["id", "title", "kind", "xp", "sparks", "active"],
    default: "id",
    dir: "asc",
    firstDir: { xp: "desc", sparks: "desc", active: "desc" },
  }),
} as const;

export const PLAYER_SORT = sortSpec({
  keys: ["joined", "nickname", "account", "age_band", "level", "sparks", "streak", "last_active", "reports"],
  default: "joined",
  dir: "desc",
  firstDir: { level: "desc", sparks: "desc", streak: "desc", last_active: "desc", reports: "desc" },
});
