-- Trip Roulette Kerala — scheduled jobs (ARCHITECTURE §16, DATABASE_API_SPEC §6, §11)
--
-- daily_maintenance(): retention clean-up and a review-due summary for editors.
-- refresh_route_estimates(only_missing): fills or recomputes estimated routes.
-- Both are service-role only. pg_cron runs them directly (no keys stored in the database);
-- the `daily-maintenance` and `refresh-routes` Edge Functions run them on demand.
--
-- Retention (assumed until decided, ARCHITECTURE §17): trips 90 days (trips.expires_at),
-- share links 30 days (trip_share_links.expires_at), anonymous users 90 days, events 365 days,
-- rate-limit counters 1 day.

create function public.daily_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_links integer;
  n_trips integer;
  n_users integer;
  n_counters integer;
  n_events integer;
  overdue jsonb;
begin
  delete from public.trip_share_links where expires_at < now();
  get diagnostics n_links = row_count;

  -- Cascades to recommendations, results, itinerary items and links; events keep a null trip_id.
  delete from public.trips where expires_at < now();
  get diagnostics n_trips = row_count;

  -- Guests past retention with nothing left. Permanent (admin) accounts are never touched.
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '90 days'
    and not exists (select 1 from public.trips t where t.owner_user_id = u.id);
  get diagnostics n_users = row_count;

  delete from public.rate_limit_counters where window_start < now() - interval '1 day';
  get diagnostics n_counters = row_count;

  delete from public.analytics_events where created_at < now() - interval '365 days';
  get diagnostics n_events = row_count;

  -- Review-due records for editors (the admin dashboard flags the same destinations live).
  select coalesce(jsonb_agg(row_to_json(x) order by x.name), '[]'::jsonb) into overdue
  from (
    select d.id, d.name, d.publication_status,
      (select count(*) from public.access_information a where a.destination_id = d.id and a.review_due_at < now()) as access_due,
      (select count(*) from public.destination_costs c where c.destination_id = d.id and c.review_due_at < now()) as costs_due,
      (d.review_due_at is not null and d.review_due_at < now()) as destination_due
    from public.destinations d
    where d.publication_status <> 'archived'
  ) x
  where x.access_due > 0 or x.costs_due > 0 or x.destination_due;

  return jsonb_build_object(
    'ranAt', now(),
    'deleted', jsonb_build_object(
      'shareLinks', n_links, 'trips', n_trips, 'anonymousUsers', n_users,
      'rateLimitCounters', n_counters, 'analyticsEvents', n_events
    ),
    'costAssumptionsDue', (select count(*) from public.cost_assumptions where review_due_at < now()),
    'reviewDue', overdue
  );
end;
$$;

-- Estimated routes: straight-line distance × 1.35 road factor at average speeds (car 40 km/h,
-- bike 38 km/h), the same model as the sample seed. Only estimate rows are ever overwritten;
-- routes entered by editors or a routing provider are left alone. Public transport needs real
-- fares and timetables, so it is never estimated.
create function public.refresh_route_estimates(only_missing boolean default false)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select l.id as location_id, de.id as destination_id, m.mode,
      round((dist.km * 1.35)::numeric, 1) as distance_km,
      greatest(10, round(dist.km * 1.35 / m.kmh * 60))::integer as duration_minutes
    from public.locations l
    cross join public.destinations de
    cross join (values ('car'::public.transport_mode, 40.0), ('bike'::public.transport_mode, 38.0)) as m(mode, kmh)
    cross join lateral (
      select 2 * 6371 * asin(sqrt(
        power(sin(radians((de.latitude - l.latitude)::float8) / 2), 2)
        + cos(radians(l.latitude::float8)) * cos(radians(de.latitude::float8))
          * power(sin(radians((de.longitude - l.longitude)::float8) / 2), 2)
      )) as km
    ) as dist
    where l.is_active and de.publication_status <> 'archived'
  ),
  upserted as (
    insert into public.location_destination_routes as r
      (location_id, destination_id, transport_mode, distance_km, duration_minutes, provider, computed_at)
    select location_id, destination_id, mode, distance_km, duration_minutes, 'estimate-haversine', now()
    from candidates
    on conflict (location_id, destination_id, transport_mode) do update
      set distance_km = excluded.distance_km,
          duration_minutes = excluded.duration_minutes,
          provider = excluded.provider,
          computed_at = excluded.computed_at,
          updated_at = now()
      where not only_missing
        and r.provider in ('sample-haversine', 'estimate-haversine')
        and (r.distance_km, r.duration_minutes) is distinct from (excluded.distance_km, excluded.duration_minutes)
    returning (xmax = 0) as inserted
  )
  select jsonb_build_object(
    'inserted', count(*) filter (where inserted),
    'updated', count(*) filter (where not inserted)
  )
  from upserted;
$$;

revoke all on function public.daily_maintenance() from public, anon, authenticated;
revoke all on function public.refresh_route_estimates(boolean) from public, anon, authenticated;
grant execute on function public.daily_maintenance() to service_role;
grant execute on function public.refresh_route_estimates(boolean) to service_role;

-- Schedules (UTC): maintenance 03:00 IST daily, route estimates 03:30 IST on Sundays.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('daily-maintenance', '30 21 * * *', 'select public.daily_maintenance()');
select cron.schedule('refresh-routes', '0 22 * * 0', 'select public.refresh_route_estimates(false)');
