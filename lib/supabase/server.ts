import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** Per-request client bound to the player's auth cookie. RLS applies. */
export async function supabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a Server Component: the proxy refreshes the session instead */
        }
      },
    },
  });
}

/**
 * The verified player identity for this request, or null.
 *
 * Uses `auth.getClaims()`: with the project's asymmetric (ES256) signing keys the JWT signature is checked
 * locally against the cached JWKS, so an API call costs no round trip to Supabase Auth. Legacy HS256
 * tokens (the local stack) fall back to a getUser() call inside supabase-js. The trade-off is that a
 * revoked session stays valid until its JWT expires (one hour); bans and deletions are still enforced
 * at once because every player route loads the `players` row (requirePlayer checks banned_at).
 *
 * Only `id`, `email`, `is_anonymous` and `role` are populated. Code that needs the full auth record
 * (e.g. created_at) reads it with the admin API.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  const auth = (await headers()).get("authorization");
  const sb = auth?.startsWith("Bearer ")
    ? createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: () => {} } })
    : await supabaseServer();
  const { data, error } = await sb.auth.getClaims(auth?.startsWith("Bearer ") ? auth.slice(7) : undefined);
  if (error || !data?.claims?.sub) return null;
  const c = data.claims;
  return {
    id: c.sub,
    email: c.email || undefined,
    is_anonymous: c.is_anonymous ?? false,
    role: c.role,
    aud: typeof c.aud === "string" ? c.aud : "authenticated",
    app_metadata: c.app_metadata ?? {},
    user_metadata: c.user_metadata ?? {},
    created_at: "",
  } as User;
});
