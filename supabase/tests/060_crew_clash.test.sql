begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000c1a51', 'c1@clash.test'), ('00000000-0000-0000-0000-0000000c1a52', 'c2@clash.test');
insert into public.players (id, nickname, age_band) values
  ('00000000-0000-0000-0000-0000000c1a51', 'ClashOne', '18+'), ('00000000-0000-0000-0000-0000000c1a52', 'ClashTwo', '18+');
insert into public.crews (id, name, owner_id, join_code) values
  ('00000000-0000-0000-0000-00000000c0a1', 'Alpha Test', '00000000-0000-0000-0000-0000000c1a51', 'TSTAA1'),
  ('00000000-0000-0000-0000-00000000c0b2', 'Beta Test', '00000000-0000-0000-0000-0000000c1a52', 'TSTBB2');
insert into public.crew_members (crew_id, player_id) values
  ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000c1a51'),
  ('00000000-0000-0000-0000-00000000c0b2', '00000000-0000-0000-0000-0000000c1a52');
-- last week's clash, with more XP for Alpha
insert into public.crew_clashes (id, crew_a, crew_b, week_start) values
  ('00000000-0000-0000-0000-0000000c1a00', '00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-00000000c0b2',
   date_trunc('week', now() at time zone 'utc')::date - 7);
insert into public.xp_ledger (player_id, source, ref_id, amount, created_at) values
  ('00000000-0000-0000-0000-0000000c1a51', 'test', 'clash-a', 120, date_trunc('week', now() at time zone 'utc') - interval '3 days'),
  ('00000000-0000-0000-0000-0000000c1a52', 'test', 'clash-b', 40, date_trunc('week', now() at time zone 'utc') - interval '3 days');

select is(private.crew_clash_settle(), 1, 'one finished clash is settled');
select is((select winner from public.crew_clashes where id = '00000000-0000-0000-0000-0000000c1a00'),
  '00000000-0000-0000-0000-00000000c0a1'::uuid, 'the crew with more XP that week wins');
select is((select array[score_a, score_b] from public.crew_clashes where id = '00000000-0000-0000-0000-0000000c1a00'),
  array[120, 40], 'both week scores are recorded');
select is(private.crew_clash_settle(), 0, 'settling again changes nothing');

select * from finish();
rollback;
