begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Migration 20261212030101: games against the bot on the player's record, server-only.
select has_table('public', 'bot_games', 'bot_games exists');
select col_not_null('public', 'bot_games', 'player_id', 'every row belongs to a player');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.bot_games'::regclass), 'RLS is on and forced');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'bot_games'), 0, 'no client policies');
select ok(not has_table_privilege('authenticated', 'public.bot_games', 'select'), 'players cannot read it directly');
select ok(not has_table_privilege('anon', 'public.bot_games', 'insert'), 'visitors cannot write it');

insert into auth.users (id, email, is_anonymous) values ('b2600000-0000-4000-8000-000000000001', null, true);
insert into public.players (id, nickname, age_band) values ('b2600000-0000-4000-8000-000000000001', 'zbot_one', '18+');
select throws_ok(
  $$insert into public.bot_games (player_id, game_id, level, outcome) values ('b2600000-0000-4000-8000-000000000001', 'crownfall', 'easy', 'won')$$,
  '23514', null, 'only bot games are accepted'
);
insert into public.bot_games (player_id, game_id, level, outcome, duration_ms) values ('b2600000-0000-4000-8000-000000000001', 'chess', 'hard', 'won', 600000);
delete from public.players where id = 'b2600000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.bot_games where player_id = 'b2600000-0000-4000-8000-000000000001'), 0, 'deleting the player deletes their bot games');

select * from finish();
rollback;
