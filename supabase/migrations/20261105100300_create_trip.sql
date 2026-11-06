-- Trip Roulette Kerala — create-trip support (ARCHITECTURE §5, DATABASE_API_SPEC §8.3, §11.4)
--
-- 1. create_trip_with_recommendations(): inserts a trip and exactly three recommendations in one
--    transaction. Service role only (called by the create-trip Edge Function after it has
--    verified the caller); clients still have no write path to trip tables.
-- 2. rate_limit_hit(): fixed-window counter in rate_limit_counters. Service role only.
-- 3. Corrects the 1.0.0 ranking curves to the values in ARCHITECTURE §5.3. No trips existed when
--    this ran, so no stored recommendation was scored with the old values.

create function public.create_trip_with_recommendations(p_trip jsonb, p_recommendations jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trip_id uuid;
begin
  if jsonb_typeof(p_recommendations) <> 'array' or jsonb_array_length(p_recommendations) <> 3 then
    raise exception 'exactly three recommendations are required' using errcode = '22023';
  end if;

  insert into public.trips (
    owner_user_id, start_location_id, travel_date, date_flexible, duration_code,
    budget_per_person_minor, currency, traveller_count, travel_group, moods, transport_mode,
    overnight_stay, accessibility_needs, preference_snapshot, algorithm_version
  )
  values (
    (p_trip ->> 'owner_user_id')::uuid,
    (p_trip ->> 'start_location_id')::uuid,
    (p_trip ->> 'travel_date')::date,
    (p_trip ->> 'date_flexible')::boolean,
    (p_trip ->> 'duration_code')::public.duration_code,
    (p_trip ->> 'budget_per_person_minor')::bigint,
    coalesce(p_trip ->> 'currency', 'INR'),
    (p_trip ->> 'traveller_count')::smallint,
    (p_trip ->> 'travel_group')::public.travel_group,
    array(select jsonb_array_elements_text(p_trip -> 'moods')),
    (p_trip ->> 'transport_mode')::public.transport_mode,
    (p_trip ->> 'overnight_stay')::boolean,
    array(select jsonb_array_elements_text(coalesce(p_trip -> 'accessibility_needs', '[]'))),
    p_trip -> 'preference_snapshot',
    p_trip ->> 'algorithm_version'
  )
  returning id into v_trip_id;

  insert into public.trip_recommendations (
    trip_id, destination_id, position, match_score, score_components, match_reason,
    warnings, route_snapshot, cost_snapshot, access_snapshot
  )
  select
    v_trip_id,
    (r ->> 'destination_id')::uuid,
    (r ->> 'position')::smallint,
    (r ->> 'match_score')::numeric,
    r -> 'score_components',
    r ->> 'match_reason',
    coalesce(r -> 'warnings', '[]'),
    r -> 'route_snapshot',
    r -> 'cost_snapshot',
    r -> 'access_snapshot'
  from jsonb_array_elements(p_recommendations) as r;

  return v_trip_id;
end;
$$;

create function public.rate_limit_hit(p_bucket text, p_window_seconds integer, p_limit integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limit_counters (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set count = public.rate_limit_counters.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke all on function public.create_trip_with_recommendations(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.create_trip_with_recommendations(jsonb, jsonb) to service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

update public.algorithm_configs
set curves = '{"budget": {"fullScoreAtShare": 0.7, "scoreAtLimit": 0.5},
               "travelTime": {"fullScoreAtShare": 0.5, "scoreAtLimit": 0.3},
               "season": {"inSeason": 1.0, "unknown": 0.5, "offSeason": 0.2},
               "group": {"suitable": 1.0, "unknown": 0.5, "notSuitable": 0.0}}'
where version = '1.0.0'
  and not exists (select 1 from public.trips t where t.algorithm_version = '1.0.0');
