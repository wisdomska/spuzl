/** Supabase env. Missing values degrade to "backend offline" instead of crashing the shell. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const hasSupabase = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
