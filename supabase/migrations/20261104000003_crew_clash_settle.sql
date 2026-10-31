-- Crew Clash results: when a clash week (Monday to Sunday, GMT) is over, record both crews' XP for that week
-- and the winner (null on a tie). Runs Monday 00:07 GMT, after the league rollover; safe to re-run.
alter table public.crew_clashes add column if not exists settled_at timestamptz;

create or replace function private.crew_clash_settle() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  a integer;
  b integer;
  n integer := 0;
begin
  for k in
    select id, crew_a, crew_b, week_start from public.crew_clashes
    where settled_at is null and week_start + 7 <= (now() at time zone 'utc')::date
    for update skip locked
  loop
    a := private.crew_week_xp(k.crew_a, k.week_start);
    b := private.crew_week_xp(k.crew_b, k.week_start);
    update public.crew_clashes
       set score_a = a, score_b = b, settled_at = now(),
           winner = case when a > b then k.crew_a when b > a then k.crew_b end
     where id = k.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function private.crew_clash_settle() from public, anon, authenticated;

select cron.unschedule('spuzl-crew-clash-settle') where exists (select 1 from cron.job where jobname = 'spuzl-crew-clash-settle');
select cron.schedule('spuzl-crew-clash-settle', '7 0 * * 1', $$select private.crew_clash_settle()$$);
