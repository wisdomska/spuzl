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
 */
export function isDocumentRequest(request: { method: string; headers: Headers; nextUrl: { searchParams: URLSearchParams } }): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return !request.headers.has("rsc") && !request.headers.has("next-router-prefetch") && !request.nextUrl.searchParams.has("_rsc");
}
