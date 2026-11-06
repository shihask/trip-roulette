-- Scheduled jobs (ARCHITECTURE §16): retention clean-up and route estimates. Runs in a transaction and rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, is_anonymous, created_at) values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', true,  now() - interval '100 days'), -- old guest, expired trip
  ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', true,  now() - interval '100 days'), -- old guest, current trip
  ('a1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', true,  now() - interval '10 days'),  -- recent guest, no trips
  ('a1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', false, now() - interval '400 days'); -- permanent account

insert into public.districts (id, name, slug) values ('d1000000-0000-4000-8000-000000000001', 'Zz Maint District', 'zz-maint-district');
insert into public.locations (id, name, district_id, latitude, longitude) values
  ('11000000-0000-4000-8000-000000000001', 'Zz Maint Town', 'd1000000-0000-4000-8000-000000000001', 10, 76),
  ('11000000-0000-4000-8000-000000000002', 'Zz Maint Inactive', 'd1000000-0000-4000-8000-000000000001', 10.1, 76.1);
update public.locations set is_active = false where id = '11000000-0000-4000-8000-000000000002';
insert into public.destinations (id, name, slug, district_id, destination_type, short_description, latitude, longitude, publication_status) values
  ('de100000-0000-4000-8000-000000000001', 'Zz Maint Dest', 'zz-maint-dest', 'd1000000-0000-4000-8000-000000000001', 'Test', 'Test', 10.5, 76.5, 'draft'),
  ('de100000-0000-4000-8000-000000000002', 'Zz Maint Archived', 'zz-maint-archived', 'd1000000-0000-4000-8000-000000000001', 'Test', 'Test', 10.6, 76.6, 'archived');

insert into public.trips (id, owner_user_id, start_location_id, travel_date, duration_code, budget_per_person_minor,
  traveller_count, travel_group, moods, preference_snapshot, algorithm_version, expires_at)
values
  ('71000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001',
   '2026-08-01', 'one_day', 200000, 2, 'friends', '{nature}', '{}', '1.0.0', now() - interval '1 day'),
  ('71000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001',
   '2026-12-01', 'one_day', 200000, 2, 'friends', '{nature}', '{}', '1.0.0', now() + interval '30 days');

insert into public.trip_share_links (trip_id, token_hash, snapshot, expires_at) values
  ('71000000-0000-4000-8000-000000000002', repeat('b', 64), '{}', now() - interval '1 hour'),
  ('71000000-0000-4000-8000-000000000002', repeat('c', 64), '{}', now() + interval '10 days');

insert into public.rate_limit_counters (bucket, window_start, count) values
  ('zz-maint:old', now() - interval '2 days', 1),
  ('zz-maint:new', now(), 1);

insert into public.analytics_events (event_type, trip_id, metadata, created_at) values
  ('zz_maint_old', null, '{}', now() - interval '400 days'),
  ('zz_maint_new', '71000000-0000-4000-8000-000000000001', '{}', now());

-- An editor-entered route that must survive a refresh.
insert into public.location_destination_routes (location_id, destination_id, transport_mode, distance_km, duration_minutes, provider, computed_at)
values ('11000000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000001', 'car', 99, 999, 'manual', now());

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.daily_maintenance()', 'execute'), 'anon cannot run maintenance');
select ok(not has_function_privilege('authenticated', 'public.daily_maintenance()', 'execute'), 'users cannot run maintenance');
select ok(not has_function_privilege('authenticated', 'public.refresh_route_estimates(boolean)', 'execute'), 'users cannot refresh routes');
select ok(has_function_privilege('service_role', 'public.daily_maintenance()', 'execute'), 'service role can run maintenance');
select ok((select count(*) = 2 from cron.job where jobname in ('daily-maintenance', 'refresh-routes')), 'both jobs are scheduled');

-- ---------------------------------------------------------------------------
-- daily_maintenance()
-- ---------------------------------------------------------------------------
create temp table run as select public.daily_maintenance() as r;

select is((select count(*)::int from public.trips where id = '71000000-0000-4000-8000-000000000001'), 0, 'expired trip deleted');
select is((select count(*)::int from public.trips where id = '71000000-0000-4000-8000-000000000002'), 1, 'current trip kept');
select is((select count(*)::int from public.trip_share_links where token_hash = repeat('b', 64)), 0, 'expired share link deleted');
select is((select count(*)::int from public.trip_share_links where token_hash = repeat('c', 64)), 1, 'current share link kept');
select is((select count(*)::int from auth.users where id = 'a1000000-0000-4000-8000-000000000001'), 0, 'guest past retention with no trips deleted');
select is((select count(*)::int from auth.users where id = 'a1000000-0000-4000-8000-000000000002'), 1, 'old guest with a current trip kept');
select is((select count(*)::int from auth.users where id = 'a1000000-0000-4000-8000-000000000003'), 1, 'recent guest kept');
select is((select count(*)::int from auth.users where id = 'a1000000-0000-4000-8000-000000000004'), 1, 'permanent account never deleted');
select is((select count(*)::int from public.rate_limit_counters where bucket like 'zz-maint:%'), 1, 'old rate-limit counters deleted');
select is((select count(*)::int from public.analytics_events where event_type = 'zz_maint_old'), 0, 'events past retention deleted');
select is(
  (select trip_id from public.analytics_events where event_type = 'zz_maint_new'), null,
  'recent events kept without the deleted trip'
);
select ok((select (r -> 'deleted' ->> 'trips')::int >= 1 from run), 'summary counts deleted trips');
select ok((select jsonb_typeof(r -> 'reviewDue') = 'array' from run), 'summary lists review-due records');

-- ---------------------------------------------------------------------------
-- refresh_route_estimates()
-- ---------------------------------------------------------------------------
select ok((public.refresh_route_estimates(true) ->> 'inserted')::int >= 1, 'missing routes are added');
select is(
  (select provider from public.location_destination_routes
   where location_id = '11000000-0000-4000-8000-000000000001' and destination_id = 'de100000-0000-4000-8000-000000000001' and transport_mode = 'bike'),
  'estimate-haversine', 'added routes are labelled as estimates'
);
select is(
  (select duration_minutes from public.location_destination_routes
   where location_id = '11000000-0000-4000-8000-000000000001' and destination_id = 'de100000-0000-4000-8000-000000000001' and transport_mode = 'car'),
  999, 'editor-entered routes are never overwritten'
);
select is(
  (select count(*)::int from public.location_destination_routes where location_id = '11000000-0000-4000-8000-000000000002'),
  0, 'inactive towns get no routes'
);
select is(
  (select count(*)::int from public.location_destination_routes where destination_id = 'de100000-0000-4000-8000-000000000002'),
  0, 'archived destinations get no routes'
);
select is((public.refresh_route_estimates(false) ->> 'updated')::int, 0, 'a second run changes nothing');

select * from finish();
rollback;
