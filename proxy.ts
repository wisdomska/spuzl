import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Refreshes the Supabase session cookie on navigation so Server Components see a valid player. Signed-out "/" shows About. */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;
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
  const { data } = await sb.auth.getUser();
  // Signed-out visitors (and Google's OAuth branding review) get the public About page at "/", not a redirect
  // into the intro: the homepage must name the app and say what it does without a login.
  if (!data.user && request.nextUrl.pathname === "/") {
    const rewrite = NextResponse.rewrite(new URL("/about", request.url));
    response.cookies.getAll().forEach((c) => rewrite.cookies.set(c));
    return rewrite;
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|3d/|icons/|api/health|api/og|.*\\.(?:png|webp|svg|ico|riv|woff2)$).*)",
  ],
};
