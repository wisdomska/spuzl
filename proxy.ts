import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { MERGED_WORLDS, type WorldId } from "@/lib/catalog";

/** Refreshes the Supabase session cookie on navigation so Server Components see a valid player. Signed-out "/" shows About. */
export async function proxy(request: NextRequest) {
  // Worlds folded into a broader one in the 2026-11 regroup (Line Lane into Puzzles, Rage Ridge into Arcade...):
  // old links get a real 308 to the group that took their games, before the page streams.
  const folded = /^\/world\/([a-z]+)\/?$/.exec(request.nextUrl.pathname)?.[1];
  const to = folded && Object.hasOwn(MERGED_WORLDS, folded) ? MERGED_WORLDS[folded as WorldId] : undefined;
  if (to) return NextResponse.redirect(new URL(`/world/${to}${request.nextUrl.search}`, request.url), 308);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Link prefetches skip the refresh: their responses (and any rotated token they carry) are often thrown away, and
  // the old refresh token used later would then count as reused, which ends the whole session. Real navigations and
  // the browser client keep the session fresh.
  const prefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch");
  if (!prefetch) await sb.auth.getUser();
  // Visitors with no session cookie at all (first visit, Google's OAuth branding review) get the public About page
  // at "/", not a redirect into the intro: the homepage must name the app and say what it does without a login.
  // Keyed on the cookie, not on getUser(), so a slow or failed token refresh never hides Home from a player.
  // Full page loads only: in-app navigations and prefetches (RSC requests) keep the old flow, so a Home prefetched
  // just before a guest account is created is never cached as About.
  const pageLoad =
    (request.headers.get("accept") ?? "").includes("text/html") && !request.headers.has("rsc") && !request.nextUrl.searchParams.has("_rsc");
  if (!hasSession && pageLoad && request.nextUrl.pathname === "/") return NextResponse.rewrite(new URL("/about", request.url));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|3d/|icons/|api/health|api/og|.*\\.(?:png|webp|svg|ico|riv|woff2)$).*)",
  ],
};
