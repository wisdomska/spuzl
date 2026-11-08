begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- R3-10 (20261207001001): weekly recap shown, shared, played and closed, per day and for the range. 2037 dates keep
-- other test data out of the window. No new client_metrics names: the recap is a prompt, and its shares are share
-- rows with kind 'recap'.
insert into public.client_metrics (name, mode, kind, created_at) values
  ('prompt_shown', 'weekly_recap', 'week', '2037-03-02 08:00+00'),
  ('prompt_shown', 'weekly_recap', 'week', '2037-03-02 09:00+00'),
  ('prompt_shown', 'weekly_recap', 'week', '2037-03-03 09:00+00'),
  ('prompt_accepted', 'weekly_recap', 'week', '2037-03-02 08:01+00'),
  ('prompt_dismissed', 'weekly_recap', 'week', '2037-03-03 09:01+00'),
  ('share', null, 'recap', '2037-03-02 08:02+00'),
  -- not the recap: another prompt and another share
  ('prompt_shown', 'alerts', 'friend', '2037-03-02 10:00+00'),
  ('share', null, 'status', '2037-03-02 10:00+00');

select is((public.svc_admin_metrics('2037-03-02', '2037-03-03') -> 'total' ->> 'wr_shown')::int, 3, 'range: recaps shown');
select is((public.svc_admin_metrics('2037-03-02', '2037-03-03') -> 'total' ->> 'wr_shared')::int, 1, 'range: recap shares only');
select is((public.svc_admin_metrics('2037-03-02', '2037-03-03') -> 'total' ->> 'wr_played')::int
        + (public.svc_admin_metrics('2037-03-02', '2037-03-03') -> 'total' ->> 'wr_dismissed')::int, 2, 'range: played and closed');
select is((select (d ->> 'wr_shown')::int from jsonb_array_elements(public.svc_admin_metrics('2037-03-02', '2037-03-03') -> 'days') d
            where d ->> 'date' = '2037-03-03'), 1, 'day rows carry their own counts');
select is((public.svc_admin_metrics('2037-03-02', '2037-03-03') -> 'total' -> 'prompts' -> 'weekly_recap.week' ->> 'shown')::int, 3,
  'the prompts card counts the recap by its trigger too');
select ok(not has_function_privilege('authenticated', 'private.admin_weekly_recap(date, date)', 'execute')
  and (public.svc_admin_metrics('2037-03-02', '2037-03-03') -> 'total' ->> 'sn_sent') is not null
  and (public.svc_admin_metrics('2037-03-02', '2037-03-03') -> 'total' ->> 'gr_tv_views') is not null
  and (public.svc_admin_metrics('2037-03-02', '2037-03-03') -> 'total' ->> 'go_bot_won') is not null,
  'the recap part is service-role only, and every earlier part (streak nudge included) is still merged');

select * from finish();
rollback;
