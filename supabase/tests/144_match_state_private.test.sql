begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

-- R3 (20261207001501): rivals' board states are not readable through the Data API.
select ok(not has_column_privilege('authenticated', 'public.match_players', 'state', 'select'),
  'signed-in clients cannot read match_players.state');
select ok(has_column_privilege('authenticated', 'public.match_players', 'player_id', 'select')
  and has_column_privilege('authenticated', 'public.match_players', 'points', 'select'),
  'the other columns stay readable under the row policy');
select ok(not has_table_privilege('anon', 'public.match_players', 'select'), 'anonymous clients read nothing');

select * from finish();
rollback;
