"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { ADMIN_COOKIE } from "@/lib/admin/session";

let client: SupabaseClient | null = null;

/**
 * Browser client for the admin session. Its own cookie (and not the shared singleton), so admin sign-in
 * never touches the player's guest session in the same browser.
 */
export function adminSupabase(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, { cookieOptions: { name: ADMIN_COOKIE }, isSingleton: false });
  return client;
}

export async function adminSignOut() {
  await adminSupabase().auth.signOut();
}
