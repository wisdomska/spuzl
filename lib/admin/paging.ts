import "server-only";
import { ApiError } from "@/lib/api/server";
import { parsePageQuery, rangeOf, type PageParams } from "./pagination";

/** `?page=&pageSize=` from a request, or 400 bad_page. */
export function pageParams(req: Request | URLSearchParams): PageParams {
  const sp = req instanceof URLSearchParams ? req : new URL(req.url).searchParams;
  const r = parsePageQuery(sp);
  if (!r.success) throw new ApiError(400, "bad_page", r.error.issues[0]?.message ?? "bad page");
  return r.data as PageParams;
}

type RangeResult<T> = { data: T[] | null; count: number | null; error: { code?: string } | null };
interface RangeQuery<T> {
  range(from: number, to: number): PromiseLike<RangeResult<T>>;
}

/**
 * One page from a Supabase select built with `{ count: "exact" }` and a stable order. `build` is called again
 * only when the page lies past the end (PostgREST answers 416 / PGRST103 there): that second call reads the
 * total so the console can step back to the last page.
 */
export async function fetchPage<T>(build: () => RangeQuery<T>, p: PageParams): Promise<{ rows: T[]; total: number }> {
  const { from, to } = rangeOf(p);
  const r = await build().range(from, to);
  if (r.error?.code === "PGRST103") {
    const head = await build().range(0, 0);
    if (head.error) throw head.error;
    return { rows: [], total: head.count ?? 0 };
  }
  if (r.error) throw r.error;
  return { rows: r.data ?? [], total: r.count ?? 0 };
}
