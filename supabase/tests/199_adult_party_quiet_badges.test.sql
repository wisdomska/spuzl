begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- R4-Q (20261210990101): an 18+ room's badge counts but never reaches the friends feed; other badges still do.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000099a1', 'quiet@test');
insert into public.players (id, nickname, age_band) values ('00000000-0000-0000-0000-0000000099a1', 'quiet_amy', '18+');
-- The seed has both badges; kept here so the test stands on an unseeded database too.
insert into public.badges (id, family, tier, name, description, secret, sparks, rule, sort) values
  ('party-1', 'party', 'bronze', 'Life of the Party', 'Win a Party Race.', false, 10, '{"kind":"party_wins","n":1}'::jsonb, 32),
  ('duel-10', 'duel', 'silver', 'Duellist', 'Win 10 Duels.', false, 25, '{"kind":"duel_wins","n":10}'::jsonb, 31)
on conflict (id) do nothing;

select ok(not has_function_privilege('authenticated', 'public.svc_award_badge_quiet(uuid, text)', 'execute'), 'players cannot call it');
select ok(has_function_privilege('service_role', 'public.svc_award_badge_quiet(uuid, text)', 'execute'), 'the server can');

select ok(public.svc_award_badge_quiet('00000000-0000-0000-0000-0000000099a1', 'party-1'), 'the badge is awarded');
select ok(not public.svc_award_badge_quiet('00000000-0000-0000-0000-0000000099a1', 'party-1'), 'once');
select is((select count(*)::int from public.feed_events where player_id = '00000000-0000-0000-0000-0000000099a1' and kind = 'badge'), 0,
  'and writes no feed event');
select is(coalesce(current_setting('spuzl.quiet_feed', true), ''), '', 'the quiet mark does not outlive the call');

insert into public.player_badges (player_id, badge_id) values ('00000000-0000-0000-0000-0000000099a1', 'duel-10');
select is((select count(*)::int from public.feed_events where player_id = '00000000-0000-0000-0000-0000000099a1' and kind = 'badge'), 1,
  'any other badge still reaches the feed');

select * from finish();
rollback;
