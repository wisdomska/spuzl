import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { MERGED_WORLDS, isLiveWorld, type WorldId } from "@/lib/catalog";
import { ADMIN_COOKIE } from "@/lib/admin/session";
import { hasSessionCookie, isDocumentRequest } from "@/lib/auth/session-cookie";
import { indexNowKeyResponse } from "@/lib/seo/indexnow";

/** A path no route matches: rewriting to it renders the not-found page with a real 404 status. */
const NOT_FOUND_PATH = "/__not-found";

/** Refreshes the Supabase session cookie on navigation so Server Components see a valid player. Signed-out "/" shows About. */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // IndexNow ownership file (/<INDEXNOW_KEY>.txt) for Bing and Yandex; a 404 like any unknown file when unset.
  const keyFile = indexNowKeyResponse(path, process.env.INDEXNOW_KEY);
  if (keyFile) return keyFile;
  // Worlds folded into a broader one in the 2026-11 regroup (Line Lane into Puzzles, Rage Ridge into Arcade...):
  // old links get a real 308 to the group that took their games, before the page streams.
  const world = /^\/world\/([^/]+)\/?$/.exec(path)?.[1];
  const to = world && Object.hasOwn(MERGED_WORLDS, world) ? MERGED_WORLDS[world as WorldId] : undefined;
  if (to) return NextResponse.redirect(new URL(`/world/${to}${request.nextUrl.search}`, request.url), 308);
  // Unknown and emptied worlds (/world/puzzles, /world/number) answer a real 404 here: the world page streams (it has
  // a loading screen), so its own notFound() could only send a 200 with a noindex tag, a "soft 404" to crawlers.
  if (world && !isLiveWorld(world)) return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;
  const hasSession = hasSessionCookie(request.cookies);
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
  // The admin console signs in with its own cookie (lib/admin/session.ts): keep that session fresh the same way on
  // admin pages and admin API calls, so a page render never has to refresh it without being able to save it.
  const adminPath = request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/api/admin");
  if (!prefetch && adminPath && request.cookies.getAll().some((c) => c.name.startsWith(ADMIN_COOKIE))) {
    const admin = createServerClient(url, key, {
      cookieOptions: { name: ADMIN_COOKIE },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          const cookies = response.cookies.getAll();
          response = NextResponse.next({ request });
          cookies.forEach((c) => response.cookies.set(c));
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    await admin.auth.getUser();
  }
  // Visitors with no session cookie at all (first visit, search and AI crawlers, Google's OAuth branding review) get
  // the public landing page at "/", not a redirect into the intro: the homepage must name the app and say what it
  // does without a login. Keyed on the cookie, not on getUser(), so a slow or failed token refresh never hides Home
  // from a player. Every document request counts, whatever its Accept header (crawlers often send */* or none).
  // In-app navigations and prefetches (RSC requests) keep the old flow, so a Home prefetched just before a guest
  // account is created is never cached as the landing page.
  if (!hasSession && path === "/" && isDocumentRequest(request)) return NextResponse.rewrite(new URL("/about", request.url));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|3d/|icons/|api/health|api/og|robots.txt|sitemap.xml|llms.txt|llms-full.txt|.*opengraph-image|.*\\.(?:png|webp|svg|ico|riv|woff2)$).*)",
  ],
};
