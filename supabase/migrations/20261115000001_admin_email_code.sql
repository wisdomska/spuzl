-- Admin second step by email code (replaces the authenticator app). After the password, the server has Supabase
-- email a 6-digit code to the admin; a correct code marks that sign-in session (the JWT `session_id`) as verified
-- for 12 hours. Server-only: forced RLS, no grants to anon or authenticated.
--
-- Rollback:
--   drop table if exists public.admin_verified_sessions;
--   delete from supabase_migrations.schema_migrations where version = '20261115000001';

create table if not exists public.admin_verified_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);
create index if not exists admin_verified_sessions_user on public.admin_verified_sessions (user_id);

alter table public.admin_verified_sessions enable row level security;
alter table public.admin_verified_sessions force row level security;
revoke all on public.admin_verified_sessions from anon, authenticated;
grant all on public.admin_verified_sessions to service_role;
