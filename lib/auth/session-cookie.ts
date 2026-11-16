/**
 * Whether a request carries a Supabase session cookie at all (sb-<project>-auth-token, or its .0/.1 chunks). Read
 * from the cookie names only, never by asking Supabase, so it costs nothing and a slow or failed token refresh can
 * never hide a player's own screens. Visitors and crawlers have none: they get the public pages instead.
 */
export function hasSessionCookie(cookies: { getAll(): { name: string }[] }): boolean {
  return cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

/**
 * A full page load (a browser, a search or AI crawler, curl), not an in-app RSC navigation or a prefetch. The Accept
 * header is not checked: crawlers often send *\/* or none at all.
 *
 * In the proxy, Next.js strips the RSC headers (rsc, next-router-prefetch...) and the `_rsc` query before the request
 * arrives, so those checks only help direct callers. What survives is the browser's own Sec-Fetch-Dest: "document"
 * (or a frame) for a page load, "empty" for the router's fetch() of an RSC payload. Clients that send none (crawlers,
 * curl) count as page loads. Without this, a Home prefetched on /welcome before the guest account existed was cached
 * as the landing page, and the new player landed on it after onboarding (production builds only).
 */
export function isDocumentRequest(request: { method: string; headers: Headers; nextUrl: { searchParams: URLSearchParams } }): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const dest = request.headers.get("sec-fetch-dest");
  if (dest && dest !== "document" && dest !== "iframe" && dest !== "frame") return false;
  return !request.headers.has("rsc") && !request.headers.has("next-router-prefetch") && !request.nextUrl.searchParams.has("_rsc");
}
