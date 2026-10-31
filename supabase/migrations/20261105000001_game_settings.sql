-- Admin-tunable game settings (lib/game-settings/schema.ts holds keys, defaults and ranges).
-- Readable by everyone (they are UI tunables, not secrets); written only through /api/admin/settings with the
-- service role, which validates against the schema and writes the audit log.
-- Rollback: drop table public.game_settings; (defaults apply automatically when the table is empty or absent).
create table if not exists public.game_settings (
  key text primary key check (key ~ '^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$'),
  value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.game_settings enable row level security;
alter table public.game_settings force row level security;
drop policy if exists game_settings_read on public.game_settings;
create policy game_settings_read on public.game_settings for select to anon, authenticated using (true);
revoke all on public.game_settings from anon, authenticated;
grant select on public.game_settings to anon, authenticated;
