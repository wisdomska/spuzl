-- Phone and desktop push notifications (Web Push): your turn in a board game, a nudge, a friend's invite, even
-- with SPUZL closed. push_subscriptions holds one row per device a player turned alerts on for; server_secrets
-- holds the VAPID key pair the server signs pushes with (inserted once per project by an operator, never in a
-- migration). Both are server-only: forced RLS, no grants to anon or authenticated.
--
-- Rollback:
--   drop table if exists public.push_subscriptions;
--   drop table if exists public.server_secrets;
--   delete from supabase_migrations.schema_migrations where version = '20261128000001';

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists push_subscriptions_player_idx on public.push_subscriptions (player_id);
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;

create table if not exists public.server_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.server_secrets enable row level security;
alter table public.server_secrets force row level security;
revoke all on public.server_secrets from anon, authenticated;
grant all on public.server_secrets to service_role;
