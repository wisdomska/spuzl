begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Service role only
select ok(not has_function_privilege('authenticated', 'public.svc_adult_party_lift_block(uuid, uuid, integer, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.svc_adult_party_lift_block(uuid, uuid, integer, uuid)', 'execute'),
  'clients cannot lift an 18+ block');
select ok(has_function_privilege('service_role', 'public.svc_adult_party_lift_block(uuid, uuid, integer, uuid)', 'execute'), 'the server can');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000003a1', 'bra@test'), ('00000000-0000-0000-0000-0000000003b1', 'brb@test'),
  ('00000000-0000-0000-0000-0000000003c1', 'brc@test'), ('00000000-0000-0000-0000-0000000003d1', 'brmod@test');
insert into public.players (id, nickname, age_band, is_guest) values
  ('00000000-0000-0000-0000-0000000003a1', 'br_alice', '18+', false), ('00000000-0000-0000-0000-0000000003b1', 'br_bobby', '18+', false),
  ('00000000-0000-0000-0000-0000000003c1', 'br_carol', '18+', false), ('00000000-0000-0000-0000-0000000003d1', 'br_mod', '18+', false);

-- Alice: one actioned party report (blocked 7 days from today). Bob: two actioned reports, the older one still in force.
-- Carol: one actioned report from long ago plus the one being reopened.
insert into public.reports (id, reporter_id, target_type, target_id, reason, status, handled_at) values
  ('00000000-0000-0000-0000-0000000003e1', '00000000-0000-0000-0000-0000000003b1', 'party', '00000000-0000-0000-0000-0000000003a1', 'other', 'actioned', now()),
  ('00000000-0000-0000-0000-0000000003e2', '00000000-0000-0000-0000-0000000003a1', 'party', '00000000-0000-0000-0000-0000000003b1', 'other', 'actioned', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000003e3', '00000000-0000-0000-0000-0000000003a1', 'party', '00000000-0000-0000-0000-0000000003b1', 'other', 'actioned', now()),
  ('00000000-0000-0000-0000-0000000003e4', '00000000-0000-0000-0000-0000000003a1', 'party', '00000000-0000-0000-0000-0000000003c1', 'other', 'actioned', now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000003e5', '00000000-0000-0000-0000-0000000003a1', 'party', '00000000-0000-0000-0000-0000000003c1', 'other', 'actioned', now()),
  -- an actioned report of another kind never keeps an 18+ block
  ('00000000-0000-0000-0000-0000000003e6', '00000000-0000-0000-0000-0000000003b1', 'player', '00000000-0000-0000-0000-0000000003a1', 'harassment', 'actioned', now());
update public.players set adult_party_blocked_until = now() + interval '7 days'
  where id in ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003c1');

-- The moderation route reopens the report first, then asks for the block to be lifted.
update public.reports set status = 'open', handled_at = null where id in
  ('00000000-0000-0000-0000-0000000003e1', '00000000-0000-0000-0000-0000000003e3', '00000000-0000-0000-0000-0000000003e5');

-- Alice: nothing else justifies the block, so it goes, with an audit row.
select is(public.svc_adult_party_lift_block('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003e1', 7,
  '00000000-0000-0000-0000-0000000003d1') ->> 'changed', 'true', 'reopening the only actioned report lifts the block');
select is((select adult_party_blocked_until from public.players where id = '00000000-0000-0000-0000-0000000003a1'), null, 'Alice is unblocked');
select is((select count(*)::int from public.audit_log where action = 'player.adult_party_unblock'
  and target = 'player:00000000-0000-0000-0000-0000000003a1' and actor_id = '00000000-0000-0000-0000-0000000003d1'
  and detail ->> 'report' = '00000000-0000-0000-0000-0000000003e1' and detail ? 'before' and detail -> 'after' = 'null'::jsonb), 1,
  'the lift is audited with the report and the block before and after');

-- Bob: the older actioned report still justifies 5 more days.
select is((public.svc_adult_party_lift_block('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003e3', 7,
  '00000000-0000-0000-0000-0000000003d1') ->> 'changed')::boolean, true, 'another actioned report keeps a shorter block');
select ok((select adult_party_blocked_until between now() + interval '5 days' - interval '1 minute' and now() + interval '5 days' + interval '1 minute'
  from public.players where id = '00000000-0000-0000-0000-0000000003b1'), 'Bob stays blocked until the older report''s block ends');

-- Carol: her other actioned report is too old to justify anything.
select is((public.svc_adult_party_lift_block('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003e5', 7,
  '00000000-0000-0000-0000-0000000003d1') ->> 'blockedUntil'), null, 'an expired older report does not keep the block');

-- Nothing to lift: no change and no audit row.
select is((public.svc_adult_party_lift_block('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003e1', 7,
  '00000000-0000-0000-0000-0000000003d1') ->> 'changed')::boolean, false, 'an unblocked player is left alone');
select is((select count(*)::int from public.audit_log where action = 'player.adult_party_unblock'
  and target = 'player:00000000-0000-0000-0000-0000000003a1'), 1, 'no audit row when nothing changes');

-- Never extends a block: Bob's block shortened by hand stays as it is.
update public.players set adult_party_blocked_until = now() + interval '1 day' where id = '00000000-0000-0000-0000-0000000003b1';
select is((public.svc_adult_party_lift_block('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003e3', 7,
  '00000000-0000-0000-0000-0000000003d1') ->> 'changed')::boolean, false, 'never makes a block longer');

-- A block that already ran out is left alone.
update public.players set adult_party_blocked_until = now() - interval '1 day' where id = '00000000-0000-0000-0000-0000000003c1';
select is((public.svc_adult_party_lift_block('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003e5', 7,
  '00000000-0000-0000-0000-0000000003d1') ->> 'changed')::boolean, false, 'an expired block is left as it is');

-- The report being reopened never counts, even if it were still marked actioned.
update public.players set adult_party_blocked_until = now() + interval '7 days' where id = '00000000-0000-0000-0000-0000000003a1';
update public.reports set status = 'actioned', handled_at = now() where id = '00000000-0000-0000-0000-0000000003e1';
select is((public.svc_adult_party_lift_block('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003e1', 7,
  '00000000-0000-0000-0000-0000000003d1') ->> 'blockedUntil'), null, 'the reopened report itself is never counted');
-- Another kind of actioned report (player, harassment) did not count either.
select is((select adult_party_blocked_until from public.players where id = '00000000-0000-0000-0000-0000000003a1'), null,
  'only party reports keep an 18+ block');

-- Bad input
select throws_ok($$select public.svc_adult_party_lift_block('00000000-0000-0000-0000-0000000003a1', null, -1, null)$$, '22023', null,
  'negative block days are refused');
select throws_ok($$select public.svc_adult_party_lift_block('00000000-0000-0000-0000-00000000ffff', null, 7, null)$$, 'P0002', null,
  'an unknown player is refused');

select * from finish();
rollback;
