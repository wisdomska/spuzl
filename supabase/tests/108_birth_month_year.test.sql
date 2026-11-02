begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Birth month and year: the age rule (public.age_band_of), the stored band derived and locked by trigger, the daily
-- refresh, the admin correction (audited, never holding the birth date), forced RLS, and deletion with the account.

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.players'::regclass),
  'players still has forced RLS');
select has_column('public', 'players', 'birth_year', 'players.birth_year exists');
select has_column('public', 'players', 'birth_month', 'players.birth_month exists');

-- The rule: a year older on the 1st of the month after the birth month.
select is(public.age_band_of(2013, 6, '2026-06-30'), null, 'under 13: no band');
select is(public.age_band_of(2013, 6, '2026-07-01'), '13-15', 'turns 13 the month after the birth month');
select is(public.age_band_of(2010, 9, '2026-09-30'), '13-15', 'still 15 through the birth month');
select is(public.age_band_of(2010, 9, '2026-10-01'), '16-17', 'turns 16 the month after');
select is(public.age_band_of(2008, 11, '2026-11-30'), '16-17', 'still 17 through the birth month');
select is(public.age_band_of(2008, 11, '2026-12-01'), '18+', 'turns 18 the month after');
select is(public.age_band_of(2010, 12, '2027-01-01'), '16-17', 'December births cross the year end');
select is(public.age_band_of(null, 3, '2026-01-01'), null, 'missing input: no band');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000c01', 'a@birth.test'),
  ('00000000-0000-0000-0000-000000000c02', 'b@birth.test'),
  ('00000000-0000-0000-0000-000000000c03', 'c@birth.test'),
  ('00000000-0000-0000-0000-000000000c09', 'admin@birth.test');

-- A new player with birth month and year: the band is derived, whatever was sent.
insert into public.players (id, nickname, age_band, birth_year, birth_month)
  values ('00000000-0000-0000-0000-000000000c01', 'birth_a', '18+', extract(year from now())::int - 14, 1);
select is((select age_band from public.players where id = '00000000-0000-0000-0000-000000000c01'), '13-15',
  'the stored band comes from birth month and year, not from the client');

select throws_ok(
  $$ insert into public.players (id, nickname, age_band, birth_year, birth_month)
     values ('00000000-0000-0000-0000-000000000c02', 'birth_b', '18+', extract(year from now())::int - 10, 1) $$,
  '23514', 'too_young', 'under-13 birth month and year: no profile');
select throws_ok(
  $$ insert into public.players (id, nickname, age_band, birth_year)
     values ('00000000-0000-0000-0000-000000000c02', 'birth_b', '18+', 2000) $$,
  '23514', null, 'birth year without month is refused');

-- Locked once set.
select throws_ok(
  $$ update public.players set birth_year = birth_year - 10 where id = '00000000-0000-0000-0000-000000000c01' $$,
  'P0001', 'age_locked', 'birth month and year cannot be changed once set');
select throws_ok(
  $$ update public.players set birth_year = null, birth_month = null where id = '00000000-0000-0000-0000-000000000c01' $$,
  'P0001', 'age_locked', 'nor cleared');
update public.players set age_band = '18+' where id = '00000000-0000-0000-0000-000000000c01';
select is((select age_band from public.players where id = '00000000-0000-0000-0000-000000000c01'), '13-15',
  'writing age_band directly does not move a derived band');

-- A player from before: keeps the stored band, can add birth month and year once.
insert into public.players (id, nickname, age_band) values ('00000000-0000-0000-0000-000000000c03', 'birth_c', '16-17');
select is((select age_band from public.players where id = '00000000-0000-0000-0000-000000000c03'), '16-17',
  'a player without birth month and year keeps their band');
update public.players set birth_year = extract(year from now())::int - 30, birth_month = 2 where id = '00000000-0000-0000-0000-000000000c03';
select is((select age_band from public.players where id = '00000000-0000-0000-0000-000000000c03'), '18+',
  'adding birth month and year once derives the band');

-- Daily refresh moves stale bands (a band stored before a birthday month passed).
alter table public.players disable trigger players_age_band;
update public.players set age_band = '16-17' where id = '00000000-0000-0000-0000-000000000c03';
alter table public.players enable trigger players_age_band;
select is(private.refresh_age_bands(), 1, 'the refresh moves one stale band');
select is((select age_band from public.players where id = '00000000-0000-0000-0000-000000000c03'), '18+', 'to the derived band');

-- Admin correction: audited with the bands and reason, never the birth date.
select throws_ok(
  $$ select public.svc_admin_set_birth('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c09', 1990, 5, '') $$,
  '22023', null, 'a correction needs a reason');
select throws_ok(
  $$ select public.svc_admin_set_birth('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c09',
       extract(year from now())::int - 5, 1, 'typo at sign-up') $$,
  '22023', null, 'a correction cannot make a player under 13');
select is(
  public.svc_admin_set_birth('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c09', 1990, 5, 'typo at sign-up') ->> 'age_band',
  '18+', 'an admin correction moves the band');
select is(
  (select detail from public.audit_log where action = 'player.birth_correct' and target = 'player:00000000-0000-0000-0000-000000000c01'),
  '{"from_band": "13-15", "to_band": "18+", "reason": "typo at sign-up"}'::jsonb,
  'the audit row holds the bands and the reason, not the birth date');

delete from auth.users where id = '00000000-0000-0000-0000-000000000c01';
select is((select count(*)::int from public.players where id = '00000000-0000-0000-0000-000000000c01'), 0,
  'deleting the account deletes the birth month and year with the player row');

select * from finish();
rollback;
