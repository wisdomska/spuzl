-- API helpers: fixed-window rate limiting and day statistics.

create or replace function private.rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.rate_limits;
begin
  insert into public.rate_limits (key, count, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    count = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1 else public.rate_limits.count + 1 end,
    window_start = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now() else public.rate_limits.window_start end
  returning * into r;
  return r.count <= p_max;
end $$;

-- Median clear time for a game's Daily (speed bonus, SRS 4.1). Null under 5 clears.
create or replace function private.daily_median(p_game text, p_date date) returns integer
language sql stable security definer set search_path = '' as $$
  select case when count(*) >= 5 then percentile_cont(0.5) within group (order by time_ms)::integer end
  from public.daily_results where game_id = p_game and date = p_date
$$;

-- Percentile of a time among today's clears (results screen: "Faster than 82% of Spuzlers today").
create or replace function private.daily_percentile(p_game text, p_date date, p_time integer) returns numeric
language sql stable security definer set search_path = '' as $$
  select case when count(*) <= 1 then 100 else round(100.0 * count(*) filter (where time_ms > p_time) / (count(*) - 1), 0) end
  from public.daily_results where game_id = p_game and date = p_date
$$;

create or replace function public.svc_rate_limit(p_key text, p_max integer, p_window_seconds integer) returns boolean
language sql security definer set search_path = '' as $$ select private.rate_limit(p_key, p_max, p_window_seconds) $$;
create or replace function public.svc_daily_median(p_game text, p_date date) returns integer
language sql stable security definer set search_path = '' as $$ select private.daily_median(p_game, p_date) $$;
create or replace function public.svc_daily_percentile(p_game text, p_date date, p_time integer) returns numeric
language sql stable security definer set search_path = '' as $$ select private.daily_percentile(p_game, p_date, p_time) $$;

revoke execute on function private.rate_limit(text, integer, integer), private.daily_median(text, date), private.daily_percentile(text, date, integer) from public, anon, authenticated;
revoke execute on function public.svc_rate_limit(text, integer, integer), public.svc_daily_median(text, date), public.svc_daily_percentile(text, date, integer) from public, anon, authenticated;
grant execute on function public.svc_rate_limit(text, integer, integer), public.svc_daily_median(text, date), public.svc_daily_percentile(text, date, integer) to service_role;
