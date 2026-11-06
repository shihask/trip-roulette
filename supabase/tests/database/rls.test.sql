-- RLS / privilege tests (DATABASE_API_SPEC v1.2 §7). Runs in a transaction and rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures (as the privileged test runner)
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, is_anonymous) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', true),   -- trip owner (guest)
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', true),   -- another guest
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', false),  -- editor
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', false),  -- admin
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', true);   -- anonymous, would-be admin

insert into public.admin_users (user_id, role) values
  ('33333333-3333-4333-8333-333333333333', 'editor'),
  ('44444444-4444-4444-8444-444444444444', 'admin');

select throws_ok(
  $$ insert into public.admin_users (user_id, role) values ('55555555-5555-4555-8555-555555555555', 'admin') $$,
  '23514', null, 'anonymous users cannot be added as admins'
);

insert into public.districts (id, name, slug) values ('d0000000-0000-4000-8000-000000000001', 'Test District', 'zz-test-district');
insert into public.locations (id, name, district_id, latitude, longitude)
  values ('10000000-0000-4000-8000-000000000001', 'Zz Test Town', 'd0000000-0000-4000-8000-000000000001', 10, 76);
insert into public.destinations (id, name, slug, district_id, destination_type, short_description, latitude, longitude, suitable_durations, publication_status) values
  ('de000000-0000-4000-8000-000000000001', 'Zz Published', 'zz-published', 'd0000000-0000-4000-8000-000000000001', 'Test', 'Test', 10, 76, '{one_day}', 'published'),
  ('de000000-0000-4000-8000-000000000002', 'Zz Draft', 'zz-draft', 'd0000000-0000-4000-8000-000000000001', 'Test', 'Test', 10, 76, '{one_day}', 'draft');
insert into public.algorithm_configs (version, weights, curves, diversity)
  values ('9.9.9', '{"mood":0.3,"budget":0.25,"travelTime":0.2,"group":0.15,"season":0.1}', '{}', '{}');

insert into public.trips (id, owner_user_id, start_location_id, travel_date, duration_code, budget_per_person_minor,
  traveller_count, travel_group, moods, preference_snapshot, algorithm_version)
values ('70000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000001',
  '2026-12-01', 'one_day', 200000, 2, 'friends', '{nature}', '{}', '9.9.9');
insert into public.trip_recommendations (id, trip_id, destination_id, position, match_score, score_components, match_reason, route_snapshot, cost_snapshot, access_snapshot)
values ('7e000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001',
  1, 0.8, '{}', 'Test', '{}', '{}', '{}');
insert into public.roulette_results (trip_id, recommendation_id, selection_index, idempotency_key, public_code, rng)
values ('70000000-0000-4000-8000-000000000001', '7e000000-0000-4000-8000-000000000001', 0, gen_random_uuid(), 'TR-TEST', 'test');
insert into public.trip_share_links (trip_id, token_hash, snapshot)
values ('70000000-0000-4000-8000-000000000001', repeat('a', 64), '{}');

-- Every public table has RLS enabled.
select is_empty(
  $$ select tablename from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'RLS is enabled on every public table'
);

-- ---------------------------------------------------------------------------
-- anon (no session)
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from public.destinations where slug = 'zz-published'), 1, 'anon sees published destinations');
select is((select count(*)::int from public.destinations where slug = 'zz-draft'), 0, 'anon cannot see drafts');
select throws_ok($$ select * from public.trips $$, '42501', null, 'anon has no access to trips');
select throws_ok($$ select * from public.algorithm_configs $$, '42501', null, 'anon cannot read configuration');
select throws_ok($$ select public.publish_destination('de000000-0000-4000-8000-000000000002') $$, '42501', null, 'anon cannot call publish_destination');
select throws_ok(
  $$ insert into public.destinations (name, slug, district_id, destination_type, short_description, latitude, longitude)
     values ('X', 'zz-x', 'd0000000-0000-4000-8000-000000000001', 'T', 'T', 10, 76) $$,
  '42501', null, 'anon cannot write the catalogue'
);

-- ---------------------------------------------------------------------------
-- Trip owner (anonymous user)
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}', true);

select is((select count(*)::int from public.trips), 1, 'owner sees their trip');
select is((select count(*)::int from public.trip_recommendations), 1, 'owner sees their recommendations');
select is((select count(*)::int from public.roulette_results), 1, 'owner sees their spin result');
select is((select count(*)::int from (select id, snapshot from public.trip_share_links) s), 1, 'owner sees their share link');
select throws_ok($$ select token_hash from public.trip_share_links $$, '42501', null, 'token_hash is never readable');
select throws_ok(
  $$ insert into public.trips (owner_user_id, start_location_id, travel_date, duration_code, budget_per_person_minor,
       traveller_count, travel_group, moods, preference_snapshot, algorithm_version)
     values ('11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000001', '2026-12-01', 'one_day', 1, 1, 'solo', '{nature}', '{}', '9.9.9') $$,
  '42501', null, 'clients cannot insert trips'
);
select throws_ok($$ update public.trips set status = 'spun' $$, '42501', null, 'clients cannot update trips');
select throws_ok(
  $$ insert into public.roulette_results (trip_id, recommendation_id, selection_index, idempotency_key, public_code, rng)
     values ('70000000-0000-4000-8000-000000000001', '7e000000-0000-4000-8000-000000000001', 0, gen_random_uuid(), 'TR-HACK', 'x') $$,
  '42501', null, 'clients cannot write spin results'
);
select is((select count(*)::int from public.destinations where slug = 'zz-draft'), 0, 'guests cannot see drafts');
select throws_ok(
  $$ insert into public.destinations (name, slug, district_id, destination_type, short_description, latitude, longitude)
     values ('X', 'zz-x', 'd0000000-0000-4000-8000-000000000001', 'T', 'T', 10, 76) $$,
  '42501', null, 'guests cannot write the catalogue'
);
select is((select count(*)::int from public.admin_users), 0, 'guests see no admin rows');

-- ---------------------------------------------------------------------------
-- Another guest
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":true}', true);

select is((select count(*)::int from public.trips), 0, 'another user cannot see the trip');
select is((select count(*)::int from public.trip_recommendations), 0, 'another user cannot see recommendations');
select is((select count(*)::int from public.roulette_results), 0, 'another user cannot see the spin result');
select is((select count(*)::int from (select id from public.trip_share_links) s), 0, 'another user cannot see share links');

-- ---------------------------------------------------------------------------
-- Editor
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":false}', true);

select is((select count(*)::int from public.destinations where slug = 'zz-draft'), 1, 'editor sees drafts');
select lives_ok(
  $$ insert into public.destinations (id, name, slug, district_id, destination_type, short_description, latitude, longitude)
     values ('de000000-0000-4000-8000-000000000003', 'Zz Editor', 'zz-editor', 'd0000000-0000-4000-8000-000000000001', 'T', 'T', 10, 76) $$,
  'editor can create a draft destination'
);
select throws_ok(
  $$ insert into public.destinations (name, slug, district_id, destination_type, short_description, latitude, longitude, publication_status)
     values ('Y', 'zz-y', 'd0000000-0000-4000-8000-000000000001', 'T', 'T', 10, 76, 'published') $$,
  '42501', null, 'editor cannot insert a published destination'
);
select throws_ok(
  $$ update public.destinations set publication_status = 'published' where slug = 'zz-draft' $$,
  '42501', null, 'editor cannot publish by updating the status'
);
select throws_ok(
  $$ update public.destinations set publication_status = 'archived' where slug = 'zz-published' $$,
  '42501', null, 'editor cannot archive'
);
select throws_ok($$ select public.publish_destination('de000000-0000-4000-8000-000000000002') $$, '42501', null, 'editor cannot call publish_destination');
select is((select count(*)::int from public.algorithm_configs where version = '9.9.9'), 1, 'editor reads configuration');
update public.algorithm_configs set notes = 'editor edit' where version = '9.9.9';
select is((select count(*)::int from public.trips), 0, 'editor cannot read trips');

-- Editor's insert was audited.
select is(
  (select count(*)::int from public.admin_audit_log where entity_id = 'de000000-0000-4000-8000-000000000003' and action = 'insert'),
  1, 'catalogue changes are audited'
);

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","is_anonymous":false}', true);

-- Count only the test's own trip: the live database may hold real trips too.
select is((select count(*)::int from public.trips where id = '70000000-0000-4000-8000-000000000001'), 1, 'admin can read trips');
select is((select notes from public.algorithm_configs where version = '9.9.9'), null, 'editor could not change configuration');
select is(
  (public.publish_destination('de000000-0000-4000-8000-000000000002') ->> 'published')::boolean,
  false, 'publish_destination rejects an incomplete destination'
);
select ok(
  (public.publish_destination('de000000-0000-4000-8000-000000000002') -> 'failures') @> '[{"code":"missing_current_essential_access"}]',
  'publish failures list missing essential access'
);
select is((select publication_status::text from public.destinations where slug = 'zz-draft'), 'draft', 'incomplete destination stays draft');
select lives_ok($$ update public.destinations set publication_status = 'archived' where slug = 'zz-published' $$, 'admin can archive');

-- An admin row used with an anonymous session grants nothing.
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","is_anonymous":true}', true);
select is((select count(*)::int from public.trips), 0, 'admin rights require a permanent user');

reset role;

-- Server-only functions (create-trip, spin): no client role can execute them.
select ok(not has_function_privilege('anon', 'public.create_trip_with_recommendations(jsonb, jsonb)', 'execute'), 'anon cannot create trips directly');
select ok(not has_function_privilege('authenticated', 'public.create_trip_with_recommendations(jsonb, jsonb)', 'execute'), 'users cannot create trips directly');
select ok(not has_function_privilege('authenticated', 'public.record_spin(uuid, uuid, smallint, uuid, text)', 'execute'), 'users cannot record a spin result');
select ok(not has_function_privilege('anon', 'public.record_spin(uuid, uuid, smallint, uuid, text)', 'execute'), 'anon cannot record a spin result');
select ok(not has_function_privilege('authenticated', 'public.replace_trip_itinerary(uuid, jsonb)', 'execute'), 'users cannot write itineraries');
select ok(not has_function_privilege('authenticated', 'public.rate_limit_hit(text, integer, integer)', 'execute'), 'users cannot touch rate limits');
select ok(has_function_privilege('service_role', 'public.record_spin(uuid, uuid, smallint, uuid, text)', 'execute'), 'service role can record a spin');

select * from finish();
rollback;
