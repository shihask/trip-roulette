-- =============================================================================
-- DEVELOPMENT SEED — SAMPLE DATA, NOT VERIFIED
-- -----------------------------------------------------------------------------
-- Coordinates are approximate. Costs, access statuses, routes and review dates
-- are placeholders so the recommendation engine has something to work with.
-- Every record cites the "SAMPLE DATA — NOT VERIFIED" source. Replace all of it
-- with verified editorial data (and real routes) before any public launch.
-- Idempotent: safe to run more than once.
-- =============================================================================

-- Districts (all 14)
insert into public.districts (name, slug) values
  ('Thiruvananthapuram', 'thiruvananthapuram'), ('Kollam', 'kollam'), ('Pathanamthitta', 'pathanamthitta'),
  ('Alappuzha', 'alappuzha'), ('Kottayam', 'kottayam'), ('Idukki', 'idukki'), ('Ernakulam', 'ernakulam'),
  ('Thrissur', 'thrissur'), ('Palakkad', 'palakkad'), ('Malappuram', 'malappuram'), ('Kozhikode', 'kozhikode'),
  ('Wayanad', 'wayanad'), ('Kannur', 'kannur'), ('Kasaragod', 'kasaragod')
on conflict (slug) do nothing;

-- Mood taxonomy
insert into public.categories (slug, name, sort_order) values
  ('nature', 'Nature', 1), ('beach', 'Beach', 2), ('adventure', 'Adventure', 3), ('culture', 'Culture', 4),
  ('relaxation', 'Relaxation', 5), ('wildlife', 'Wildlife', 6), ('food', 'Food', 7)
on conflict (slug) do nothing;

-- Sample source (the only source in this seed)
insert into public.information_sources (id, source_name, source_type, publisher, accessed_at, notes)
values (
  '00000000-0000-4000-8000-000000000001',
  'SAMPLE DATA — NOT VERIFIED', 'secondary', 'Trip Roulette development seed', now(),
  'Placeholder for development only. Never show to users as a real source.'
)
on conflict (id) do nothing;

-- Starting towns (curated list)
insert into public.locations (name, aliases, district_id, latitude, longitude)
select v.name, v.aliases, d.id, v.lat, v.lng
from (values
  ('Thiruvananthapuram', array['Trivandrum'], 'thiruvananthapuram', 8.524100, 76.936600),
  ('Kochi', array['Cochin', 'Ernakulam'], 'ernakulam', 9.931200, 76.267300),
  ('Kozhikode', array['Calicut'], 'kozhikode', 11.258800, 75.780400),
  ('Thrissur', array['Trichur'], 'thrissur', 10.527600, 76.214400),
  ('Kottayam', array[]::text[], 'kottayam', 9.591600, 76.522200),
  ('Kannur', array['Cannanore'], 'kannur', 11.874500, 75.370400)
) as v(name, aliases, district_slug, lat, lng)
join public.districts d on d.slug = v.district_slug
where not exists (select 1 from public.locations l where l.name = v.name);

-- Destinations (inserted as draft; published at the end once complete)
insert into public.destinations (
  name, slug, district_id, destination_type, short_description, description,
  latitude, longitude, suitable_durations, suggested_duration_label, best_season_months,
  group_suitability, requires_permit, publication_status, content_verified_at, review_due_at
)
select v.name, v.slug, d.id, v.dtype, v.short_desc, v.short_desc || ' (Sample description — replace with verified editorial copy.)',
  v.lat, v.lng, v.durations::public.duration_code[], v.duration_label, v.season::smallint[],
  v.groups::jsonb, v.permit, 'draft', now() - interval '7 days', now() + interval '60 days'
from (values
  ('Munnar', 'munnar', 'idukki', 'Hill station', 'Tea estates, cool air and long viewpoints in the Western Ghats.',
    10.088900, 77.059500, '{one_day,two_days,three_to_five_days}', '1–2 days', '{9,10,11,12,1,2,3}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', false),
  ('Varkala', 'varkala', 'thiruvananthapuram', 'Cliff beach', 'A red-laterite cliff above a long beach, with cafés along the edge.',
    8.737900, 76.716300, '{few_hours,one_day,two_days}', '1 long day', '{10,11,12,1,2,3}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', false),
  ('Athirappilly', 'athirappilly', 'thrissur', 'Waterfall', 'A broad waterfall on the Chalakudy river, edged by forest.',
    10.285100, 76.569800, '{few_hours,one_day}', 'Half to one day', '{6,7,8,9,10,11,12}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"unknown"}', false),
  ('Alappuzha', 'alappuzha', 'alappuzha', 'Backwaters', 'Canals, paddy fields and houseboats on the backwaters.',
    9.498100, 76.338800, '{few_hours,one_day,two_days}', '1 day', '{9,10,11,12,1,2,3}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', false),
  ('Fort Kochi', 'fort-kochi', 'ernakulam', 'Heritage town', 'Colonial-era streets, fishing nets and cafés by the harbour.',
    9.965800, 76.242100, '{few_hours,one_day}', 'Half to one day', null,
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', false),
  ('Thekkady', 'thekkady', 'idukki', 'Wildlife reserve', 'Forest, spice gardens and a lake inside a tiger reserve.',
    9.603100, 77.161500, '{one_day,two_days,three_to_five_days}', '1–2 days', '{10,11,12,1,2,3,4}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', false),
  ('Wayanad', 'wayanad', 'wayanad', 'Hill district', 'Misty hills, caves, dams and forest roads in the north.',
    11.608500, 76.083000, '{two_days,three_to_five_days}', '2–3 days', '{10,11,12,1,2,3,4,5}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', false),
  ('Kovalam', 'kovalam', 'thiruvananthapuram', 'Beach town', 'Crescent beaches and a lighthouse close to the capital.',
    8.400400, 76.978700, '{few_hours,one_day,two_days}', 'Half to one day', '{10,11,12,1,2,3}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', false),
  ('Kumarakom', 'kumarakom', 'kottayam', 'Backwater village', 'Quiet lakeside village on Vembanad, known for birdlife.',
    9.617500, 76.430100, '{few_hours,one_day,two_days}', '1 day', '{11,12,1,2,3}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', false),
  ('Vagamon', 'vagamon', 'idukki', 'Hill meadows', 'Rolling meadows, pine woods and cool weather.',
    9.686200, 76.905200, '{one_day,two_days}', '1 long day', '{9,10,11,12,1,2,3,4}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', false),
  ('Bekal', 'bekal', 'kasaragod', 'Seaside fort', 'A large laterite fort on a headland above the sea.',
    12.392600, 75.033100, '{few_hours,one_day}', 'Half day', '{10,11,12,1,2,3}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', false),
  ('Ponmudi', 'ponmudi', 'thiruvananthapuram', 'Hill station', 'A winding hill road to cool, grassy summits.',
    8.759400, 77.116700, '{few_hours,one_day}', '1 day', '{9,10,11,12,1,2,3}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', false),
  ('Marari Beach', 'marari-beach', 'alappuzha', 'Village beach', 'A quiet beach beside a fishing village.',
    9.600000, 76.298000, '{few_hours,one_day,two_days}', '1 day', '{10,11,12,1,2,3}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', false),
  ('Silent Valley', 'silent-valley', 'palakkad', 'National park', 'Evergreen rainforest, visited on guided forest-department trips.',
    11.083300, 76.450000, '{one_day}', '1 day (guided)', '{12,1,2,3,4}',
    '{"family":"suitable","friends":"suitable","couple":"suitable","solo":"suitable"}', true)
) as v(name, slug, district_slug, dtype, short_desc, lat, lng, durations, duration_label, season, groups, permit)
join public.districts d on d.slug = v.district_slug
on conflict (slug) do nothing;

-- Categories (first listed = primary)
insert into public.destination_categories (destination_id, category_id, is_primary)
select de.id, c.id, v.ord = 1
from (values
  ('munnar', array['nature', 'relaxation']),
  ('varkala', array['beach', 'relaxation', 'food']),
  ('athirappilly', array['nature', 'adventure']),
  ('alappuzha', array['relaxation', 'food', 'culture']),
  ('fort-kochi', array['culture', 'food']),
  ('thekkady', array['wildlife', 'nature']),
  ('wayanad', array['nature', 'adventure', 'wildlife']),
  ('kovalam', array['beach', 'relaxation']),
  ('kumarakom', array['relaxation', 'wildlife']),
  ('vagamon', array['nature', 'adventure']),
  ('bekal', array['culture', 'beach']),
  ('ponmudi', array['nature', 'relaxation']),
  ('marari-beach', array['beach', 'relaxation']),
  ('silent-valley', array['nature', 'wildlife'])
) as m(slug, cats)
cross join lateral unnest(m.cats) with ordinality as v(cat, ord)
join public.destinations de on de.slug = m.slug
join public.categories c on c.slug = v.cat
on conflict do nothing;

-- Attractions (names only; fees and opening hours left unknown)
insert into public.attractions (destination_id, name, activity_duration_minutes, priority, source_id)
select de.id, v.name, v.minutes, v.priority, '00000000-0000-4000-8000-000000000001'
from (values
  ('munnar', 'Eravikulam National Park', 150, 1), ('munnar', 'Mattupetty Dam', 60, 2), ('munnar', 'Tea Museum', 60, 2),
  ('varkala', 'Varkala Cliff walk', 90, 1), ('varkala', 'Papanasam Beach', 90, 2),
  ('athirappilly', 'Athirappilly Falls viewpoint', 90, 1), ('athirappilly', 'Vazhachal Falls', 45, 2),
  ('alappuzha', 'Backwater canal cruise', 180, 1), ('alappuzha', 'Alappuzha Beach', 60, 2),
  ('fort-kochi', 'Chinese fishing nets', 45, 1), ('fort-kochi', 'Mattancherry Palace', 60, 2), ('fort-kochi', 'St. Francis Church', 30, 2),
  ('thekkady', 'Periyar lake boating', 120, 1), ('thekkady', 'Spice plantation walk', 90, 2),
  ('wayanad', 'Edakkal Caves', 120, 1), ('wayanad', 'Banasura Sagar Dam', 90, 2),
  ('kovalam', 'Lighthouse Beach', 120, 1),
  ('kumarakom', 'Kumarakom Bird Sanctuary', 120, 1),
  ('vagamon', 'Vagamon Meadows', 90, 1), ('vagamon', 'Pine forest', 60, 2),
  ('bekal', 'Bekal Fort', 120, 1),
  ('ponmudi', 'Ponmudi summit viewpoint', 90, 1),
  ('marari-beach', 'Marari Beach', 120, 1),
  ('silent-valley', 'Guided forest trip', 240, 1)
) as v(slug, name, minutes, priority)
join public.destinations de on de.slug = v.slug
where not exists (select 1 from public.attractions a where a.destination_id = de.id and a.name = v.name);

-- Placeholder images (the UI renders a striped placeholder until licensed photos are uploaded)
insert into public.destination_images (destination_id, storage_path, alt_text, credit, licence, is_primary)
select de.id, 'placeholders/' || de.slug || '.jpg', 'Placeholder image for ' || de.name,
  'Placeholder — replace with a licensed photo', 'Placeholder (not licensed)', true
from public.destinations de
where not exists (select 1 from public.destination_images i where i.destination_id = de.id);

-- Costs: food (essential, all destinations), parking (car), stay (multi-day destinations)
insert into public.destination_costs (destination_id, cost_type, label, unit, transport_mode,
  minimum_amount_minor, maximum_amount_minor, assumptions, is_essential, source_id, verified_at, review_due_at)
select de.id, 'food', 'Food', 'per_person', null, 40000, 70000,
  'Sample: two meals and snacks for one day.', true,
  '00000000-0000-4000-8000-000000000001', now() - interval '7 days', now() + interval '90 days'
from public.destinations de
where not exists (select 1 from public.destination_costs c where c.destination_id = de.id and c.cost_type = 'food');

insert into public.destination_costs (destination_id, cost_type, label, unit, transport_mode,
  amount_minor, assumptions, is_essential, source_id, verified_at, review_due_at)
select de.id, 'parking', 'Parking', 'per_vehicle', 'car', 10000,
  'Sample: one day of paid parking.', false,
  '00000000-0000-4000-8000-000000000001', now() - interval '7 days', now() + interval '90 days'
from public.destinations de
where not exists (select 1 from public.destination_costs c where c.destination_id = de.id and c.cost_type = 'parking');

insert into public.destination_costs (destination_id, cost_type, label, unit, transport_mode,
  minimum_amount_minor, maximum_amount_minor, assumptions, is_essential, source_id, verified_at, review_due_at)
select de.id, 'accommodation', 'Stay', 'per_room_night', null, 150000, 350000,
  'Sample: mid-range double room per night.', true,
  '00000000-0000-4000-8000-000000000001', now() - interval '7 days', now() + interval '90 days'
from public.destinations de
where de.suitable_durations && array['two_days', 'three_to_five_days']::public.duration_code[]
  and not exists (select 1 from public.destination_costs c where c.destination_id = de.id and c.cost_type = 'accommodation');

-- Essential access: current and open for most destinations.
-- Athirappilly is deliberately STALE (review overdue) so the engine must exclude it.
-- Silent Valley is RESTRICTED (permit) so the engine shows a warning.
insert into public.access_information (destination_id, restriction_type, is_essential, status, details,
  source_id, verified_at, review_due_at)
select de.id,
  case when de.slug = 'silent-valley' then 'permit' else 'general' end::public.restriction_type,
  true,
  case when de.slug = 'silent-valley' then 'restricted' else 'open' end::public.access_status,
  case when de.slug = 'silent-valley'
    then 'Sample: entry only on guided trips booked with the forest department.'
    else 'Sample: open to visitors.' end,
  '00000000-0000-4000-8000-000000000001',
  case when de.slug = 'athirappilly' then timestamptz '2026-09-02 10:00+05:30' else now() - interval '7 days' end,
  case when de.slug = 'athirappilly' then timestamptz '2026-10-02 10:00+05:30' else now() + interval '60 days' end
from public.destinations de
where not exists (select 1 from public.access_information a where a.destination_id = de.id and a.is_essential);

-- Routes: straight-line distance × 1.35 road factor at sample average speeds (car 40 km/h, bike 38 km/h).
-- Real routes come from refresh-routes.
insert into public.location_destination_routes (location_id, destination_id, transport_mode, distance_km, duration_minutes, provider, computed_at)
select l.id, de.id, m.mode,
  round((dist.km * 1.35)::numeric, 1),
  greatest(10, round(dist.km * 1.35 / m.kmh * 60))::integer,
  'sample-haversine', now()
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
on conflict (location_id, destination_id, transport_mode) do nothing;

-- Configuration (product assumptions to validate in beta)
insert into public.algorithm_configs (version, weights, curves, diversity, flexible_date_window_days, is_active, notes)
values (
  '1.0.0',
  '{"mood": 0.30, "budget": 0.25, "travelTime": 0.20, "group": 0.15, "season": 0.10}',
  '{"budget": {"fullScoreAtShare": 0.7, "scoreAtLimit": 0.5},
    "travelTime": {"fullScoreAtShare": 0.5, "scoreAtLimit": 0.3},
    "season": {"inSeason": 1.0, "unknown": 0.5, "offSeason": 0.2},
    "group": {"suitable": 1.0, "unknown": 0.5, "notSuitable": 0.0}}',
  '{"minDistanceKm": 15, "preferDistinctPrimaryCategory": true}',
  14, true, 'Initial weights from the spec. Validate in beta.'
)
on conflict (version) do nothing;

insert into public.duration_rules (duration_code, label, max_one_way_minutes, nights) values
  ('few_hours', 'A few hours', 90, 0),
  ('one_day', 'One day', 240, 0),
  ('two_days', 'Two days', 360, 1),
  ('three_to_five_days', '3–5 days', 540, 2)
on conflict (duration_code) do nothing;

insert into public.cost_assumptions (key, value, unit, source_id, verified_at, review_due_at) values
  ('fuel_price_petrol_minor_per_litre', 10700, 'paise/litre', '00000000-0000-4000-8000-000000000001', now(), now() + interval '30 days'),
  ('car_km_per_litre', 14, 'km/litre', '00000000-0000-4000-8000-000000000001', now(), now() + interval '180 days'),
  ('bike_km_per_litre', 40, 'km/litre', '00000000-0000-4000-8000-000000000001', now(), now() + interval '180 days'),
  ('car_seats', 4, 'people', '00000000-0000-4000-8000-000000000001', now(), now() + interval '365 days'),
  ('bike_seats', 2, 'people', '00000000-0000-4000-8000-000000000001', now(), now() + interval '365 days'),
  ('food_per_person_one_day_minor', 50000, 'paise', '00000000-0000-4000-8000-000000000001', now(), now() + interval '90 days')
on conflict (key) do nothing;

-- Publish every seeded destination (the seed runs as a privileged role, so the publish guard does not apply).
update public.destinations set publication_status = 'published' where publication_status = 'draft';
