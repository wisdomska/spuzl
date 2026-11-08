-- R3 security: a match member could read rivals' saved board states (match_players.state) through the Data API,
-- because match_players_read lets every member see every row. In a Party score race that state can hold a rival's
-- answers. All app reads of match_players go through the server (service role), so signed-in and anonymous clients
-- now get every column except state; the row policy is unchanged. Columns are granted dynamically so later columns
-- are covered by re-running the block.
--
-- Rollback:
--   grant select on public.match_players to authenticated;
--   delete from supabase_migrations.schema_migrations where version = '20261207001501';

revoke select on public.match_players from anon, authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'match_players' and column_name <> 'state';
  execute format('grant select (%s) on public.match_players to authenticated', cols);
end $$;
alter table public.match_players force row level security;
