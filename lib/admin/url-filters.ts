/**
 * Admin list filters kept in the address bar (`?status=open&game=nine`), next to `page` and `pageSize`, so a
 * reload, Back or a shared link opens the same view. Pure, so the console and the unit tests share it.
 *
 * A filter is a plain string with a default; a value equal to its default is left out of the URL so an
 * unfiltered list keeps a clean address. `allowed` limits a filter to a fixed set (tabs, selects): anything
 * else in the address bar falls back to the default.
 */
export type FilterDefaults<K extends string> = Readonly<Record<K, string>>;
export type FilterAllowed<K extends string> = Partial<Readonly<Record<K, readonly string[]>>>;

type Search = Pick<URLSearchParams, "get">;

/** Lenient read: a missing, empty or not-allowed value takes the default. */
export function readFilters<K extends string>(sp: Search, defaults: FilterDefaults<K>, allowed: FilterAllowed<K> = {}): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of Object.keys(defaults) as K[]) {
    const raw = sp.get(key);
    const ok = raw !== null && raw !== "" && (!allowed[key] || allowed[key]!.includes(raw));
    out[key] = ok ? raw : defaults[key];
  }
  return out;
}

/**
 * The address-bar query string with `patch` applied. A value equal to its default (or empty, or null) removes
 * the param. Any change to a filter also drops `page`, so the list goes back to page 1; `pageSize` and
 * unrelated params are kept.
 */
export function withFilterParams<K extends string>(
  search: string,
  patch: Partial<Record<K, string | null>>,
  defaults: FilterDefaults<K>,
): string {
  const params = new URLSearchParams(search);
  for (const key of Object.keys(patch) as K[]) {
    const v = patch[key];
    if (v === null || v === undefined || v === "" || v === defaults[key]) params.delete(key);
    else params.set(key, v);
  }
  params.delete("page");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * A list's own query string (filters and page) carried to a detail page as `?list=`, so its Back link returns
 * to the same filtered page. Re-encoded through URLSearchParams: only a query string ever comes out, never a
 * path or another origin.
 */
export function listSearch(raw: string | string[] | null | undefined): string {
  if (typeof raw !== "string" || !raw) return "";
  const qs = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw).toString();
  return qs ? `?${qs}` : "";
}
