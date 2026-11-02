import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * A throwaway Supabase client (no cookies, no stored session) for the admin email code: it asks Supabase to email
 * a 6-digit code to an existing account and checks one, without touching the admin's own sign-in session.
 */
export const codeClient = () =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
