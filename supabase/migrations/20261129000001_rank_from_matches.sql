-- Duels and Parties count towards the player's rank: each round played against people moves the rating of that
-- round's game category (lib/multiplayer/server/rewards.ts countRounds). rank_contributions records which rounds
-- already counted, so a finish that is processed twice never counts twice. Server-only.
--
-- Rollback:
--   drop table if exists public.rank_contributions;
--   delete from supabase_migrations.schema_migrations where version = '20261129000001';

create table if not exists public.rank_contributions (
  player_id uuid not null references public.players (id) on delete cascade,
  ref text not null,
  created_at timestamptz not null default now(),
  primary key (player_id, ref)
);
alter table public.rank_contributions enable row level security;
alter table public.rank_contributions force row level security;
revoke all on public.rank_contributions from anon, authenticated;
grant all on public.rank_contributions to service_role;
