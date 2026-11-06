-- Trip Roulette Kerala — schema (DATABASE_API_SPEC v1.2 §3–§6, §10)
-- Money is bigint paise; timestamps UTC; travel dates and itinerary times Asia/Kolkata.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.duration_code as enum ('few_hours', 'one_day', 'two_days', 'three_to_five_days');
create type public.transport_mode as enum ('car', 'bike', 'public_transport');
create type public.publication_status as enum ('draft', 'review', 'published', 'archived');
create type public.source_type as enum ('official', 'operator', 'field_visit', 'secondary');
create type public.cost_type as enum ('food', 'parking', 'toll', 'accommodation', 'public_transport', 'guide', 'other');
create type public.cost_unit as enum ('per_person', 'per_vehicle', 'per_group', 'per_room_night');
create type public.restriction_type as enum ('general', 'seasonal', 'permit', 'entry', 'safety', 'road', 'transport', 'weather');
create type public.access_status as enum ('open', 'restricted', 'closed', 'advisory', 'unknown');
create type public.travel_group as enum ('solo', 'friends', 'couple', 'family');
create type public.trip_status as enum ('recommended', 'spun', 'expired');
create type public.itinerary_kind as enum ('travel', 'attraction', 'meal', 'rest', 'return');
create type public.admin_role as enum ('editor', 'admin');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.districts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  aliases text[] not null default '{}',
  district_id uuid not null references public.districts (id),
  latitude numeric(9, 6) not null check (latitude between 7.5 and 13.5),
  longitude numeric(9, 6) not null check (longitude between 74.0 and 78.0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- normalized_name and aliases are always derived: lower-case, no diacritics.
create function public.normalize_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.normalized_name := lower(extensions.unaccent(trim(new.name)));
  new.aliases := coalesce(
    (select array_agg(lower(extensions.unaccent(trim(a)))) from unnest(new.aliases) as a where trim(a) <> ''),
    '{}'
  );
  return new;
end;
$$;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.information_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_type public.source_type not null,
  source_url text check (source_url is null or source_url ~ '^https://'),
  publisher text,
  accessed_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  district_id uuid not null references public.districts (id),
  destination_type text not null,
  short_description text not null,
  description text,
  latitude numeric(9, 6) not null check (latitude between 7.5 and 13.5),
  longitude numeric(9, 6) not null check (longitude between 74.0 and 78.0),
  suitable_durations public.duration_code[] not null default '{}',
  suggested_duration_label text,
  best_season_months smallint[] check (best_season_months is null or best_season_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  group_suitability jsonb not null default '{}' check (jsonb_typeof(group_suitability) = 'object'),
  accessibility_notes text,
  requires_permit boolean not null default false,
  publication_status public.publication_status not null default 'draft',
  content_verified_at timestamptz,
  review_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.destination_categories (
  destination_id uuid not null references public.destinations (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (destination_id, category_id)
);

create table public.attractions (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  name text not null,
  description text,
  latitude numeric(9, 6) check (latitude is null or latitude between 7.5 and 13.5),
  longitude numeric(9, 6) check (longitude is null or longitude between 74.0 and 78.0),
  activity_duration_minutes integer check (activity_duration_minutes > 0),
  priority smallint not null default 2 check (priority between 1 and 3),
  entry_fee_minor bigint check (entry_fee_minor >= 0),
  entry_fee_currency char(3) not null default 'INR',
  opening_information jsonb,
  is_active boolean not null default true,
  source_id uuid references public.information_sources (id),
  verified_at timestamptz,
  review_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Opening hours are only stored with a source (spec: "only from a verified source").
  constraint attractions_opening_needs_source check (opening_information is null or (source_id is not null and verified_at is not null))
);

create table public.destination_costs (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  cost_type public.cost_type not null,
  label text not null,
  unit public.cost_unit not null,
  transport_mode public.transport_mode,
  amount_minor bigint check (amount_minor >= 0),
  minimum_amount_minor bigint check (minimum_amount_minor >= 0),
  maximum_amount_minor bigint check (maximum_amount_minor >= 0),
  currency char(3) not null default 'INR',
  valid_from date,
  valid_until date,
  assumptions text,
  is_essential boolean not null default false,
  source_id uuid references public.information_sources (id),
  verified_at timestamptz,
  review_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint destination_costs_amount_or_range check (
    amount_minor is not null
    or (minimum_amount_minor is not null and maximum_amount_minor is not null and minimum_amount_minor <= maximum_amount_minor)
  ),
  constraint destination_costs_valid_range check (valid_until is null or valid_from is null or valid_from <= valid_until)
);

create table public.destination_images (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  storage_path text,
  external_url text check (external_url is null or external_url ~ '^https://'),
  alt_text text not null,
  caption text,
  credit text not null,
  licence text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint destination_images_one_location check ((storage_path is null) <> (external_url is null))
);

create table public.access_information (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  attraction_id uuid references public.attractions (id) on delete cascade,
  restriction_type public.restriction_type not null,
  is_essential boolean not null,
  status public.access_status not null,
  excluded_transport_modes public.transport_mode[] not null default '{}',
  details text not null,
  valid_from date,
  valid_until date,
  source_id uuid not null references public.information_sources (id),
  verified_at timestamptz not null,
  review_due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_information_valid_range check (valid_until is null or valid_from is null or valid_from <= valid_until),
  constraint access_information_review_after_verify check (review_due_at > verified_at)
);

create table public.location_destination_routes (
  location_id uuid not null references public.locations (id) on delete cascade,
  destination_id uuid not null references public.destinations (id) on delete cascade,
  transport_mode public.transport_mode not null,
  distance_km numeric(6, 1) not null check (distance_km >= 0),
  duration_minutes integer not null check (duration_minutes >= 0),
  provider text not null,
  computed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (location_id, destination_id, transport_mode)
);

-- ---------------------------------------------------------------------------
-- Configuration (product assumptions; versioned / audited)
-- ---------------------------------------------------------------------------
create table public.algorithm_configs (
  version text primary key check (version ~ '^\d+\.\d+\.\d+$'),
  weights jsonb not null,
  curves jsonb not null,
  diversity jsonb not null,
  flexible_date_window_days smallint not null default 14 check (flexible_date_window_days between 1 and 60),
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint algorithm_configs_weights_sum check (
    abs(
      coalesce((weights ->> 'mood')::numeric, 0)
      + coalesce((weights ->> 'budget')::numeric, 0)
      + coalesce((weights ->> 'travelTime')::numeric, 0)
      + coalesce((weights ->> 'group')::numeric, 0)
      + coalesce((weights ->> 'season')::numeric, 0)
      - 1
    ) < 0.0001
  )
);

create table public.duration_rules (
  duration_code public.duration_code primary key,
  label text not null,
  max_one_way_minutes integer not null check (max_one_way_minutes > 0),
  nights smallint not null check (nights >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cost_assumptions (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value numeric not null,
  unit text not null,
  source_id uuid references public.information_sources (id),
  verified_at timestamptz not null,
  review_due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Trips (written only by Edge Functions with the service role)
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  start_location_id uuid not null references public.locations (id),
  travel_date date,
  date_flexible boolean not null default false,
  duration_code public.duration_code not null,
  budget_per_person_minor bigint not null check (budget_per_person_minor > 0),
  currency char(3) not null default 'INR',
  traveller_count smallint not null check (traveller_count between 1 and 20),
  travel_group public.travel_group not null,
  moods text[] not null check (cardinality(moods) >= 1),
  transport_mode public.transport_mode not null default 'car',
  overnight_stay boolean,
  accessibility_needs text[] not null default '{}',
  preference_snapshot jsonb not null,
  algorithm_version text not null references public.algorithm_configs (version),
  status public.trip_status not null default 'recommended',
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_date_required check (date_flexible or travel_date is not null)
);

create table public.trip_recommendations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  destination_id uuid not null references public.destinations (id),
  position smallint not null check (position between 1 and 3),
  match_score numeric(4, 3) not null check (match_score between 0 and 1),
  score_components jsonb not null,
  match_reason text not null,
  warnings jsonb not null default '[]' check (jsonb_typeof(warnings) = 'array'),
  route_snapshot jsonb not null,
  cost_snapshot jsonb not null,
  access_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (trip_id, position),
  unique (trip_id, destination_id),
  unique (id, trip_id)
);

create table public.roulette_results (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references public.trips (id) on delete cascade,
  recommendation_id uuid not null,
  selection_index smallint not null check (selection_index between 0 and 2),
  idempotency_key uuid not null unique,
  public_code text not null unique check (public_code ~ '^TR-[0-9A-Z]{4,8}$'),
  rng text not null,
  created_at timestamptz not null default now(),
  foreign key (recommendation_id, trip_id) references public.trip_recommendations (id, trip_id) on delete cascade
);

create table public.trip_itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day smallint not null default 1 check (day between 1 and 5),
  sequence smallint not null check (sequence >= 1),
  kind public.itinerary_kind not null,
  attraction_id uuid references public.attractions (id),
  title text not null,
  start_local time,
  end_local time,
  notes text,
  created_at timestamptz not null default now(),
  unique (trip_id, day, sequence)
);

create table public.trip_share_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.admin_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admins must be permanent (non-anonymous) users.
create function public.admin_users_require_permanent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users u where u.id = new.user_id and u.is_anonymous) then
    raise exception 'Anonymous users cannot be admins' using errcode = '23514';
  end if;
  return new;
end;
$$;

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users (user_id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  trip_id uuid references public.trips (id) on delete set null,
  anonymous_id_hash text,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.rate_limit_counters (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  primary key (bucket, window_start)
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger locations_normalize before insert or update of name, aliases on public.locations
  for each row execute function public.normalize_location();

create trigger admin_users_permanent before insert or update of user_id on public.admin_users
  for each row execute function public.admin_users_require_permanent();

do $$
declare
  t text;
begin
  foreach t in array array[
    'districts', 'locations', 'categories', 'information_sources', 'destinations', 'attractions',
    'destination_costs', 'destination_images', 'access_information', 'location_destination_routes',
    'algorithm_configs', 'duration_rules', 'cost_assumptions', 'trips', 'trip_share_links', 'admin_users'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Indexes (§10) and partial uniques
-- ---------------------------------------------------------------------------
create unique index destination_categories_one_primary on public.destination_categories (destination_id) where is_primary;
create unique index destination_images_one_primary on public.destination_images (destination_id) where is_primary;
create unique index algorithm_configs_one_active on public.algorithm_configs (is_active) where is_active;

create index destinations_published on public.destinations (publication_status) where publication_status = 'published';
create index destinations_review_due on public.destinations (review_due_at);
create index destinations_district on public.destinations (district_id);
create index destination_categories_category on public.destination_categories (category_id, destination_id);
create index routes_location_mode on public.location_destination_routes (location_id, transport_mode);
create index routes_destination on public.location_destination_routes (destination_id);
create index attractions_destination_active on public.attractions (destination_id) where is_active;
create index destination_costs_destination_mode on public.destination_costs (destination_id, transport_mode);
create index destination_images_destination on public.destination_images (destination_id, sort_order);
create index access_information_lookup on public.access_information (destination_id, is_essential, valid_from, valid_until);
create index access_information_review_due on public.access_information (review_due_at);
create index access_information_attraction on public.access_information (attraction_id) where attraction_id is not null;
create index locations_normalized_name_trgm on public.locations using gin (normalized_name extensions.gin_trgm_ops);
create index locations_district on public.locations (district_id);
create index trips_owner_created on public.trips (owner_user_id, created_at);
create index trips_expires on public.trips (expires_at);
create index trips_start_location on public.trips (start_location_id);
create index trip_recommendations_destination on public.trip_recommendations (destination_id);
create index trip_itinerary_items_attraction on public.trip_itinerary_items (attraction_id) where attraction_id is not null;
create index trip_share_links_trip on public.trip_share_links (trip_id);
create index trip_share_links_expires on public.trip_share_links (expires_at);
create index analytics_events_type_created on public.analytics_events (event_type, created_at);
create index analytics_events_trip on public.analytics_events (trip_id) where trip_id is not null;
create index admin_audit_log_admin on public.admin_audit_log (admin_user_id, created_at);
create index rate_limit_counters_window on public.rate_limit_counters (window_start);
create index attractions_source on public.attractions (source_id) where source_id is not null;
create index destination_costs_source on public.destination_costs (source_id) where source_id is not null;
create index access_information_source on public.access_information (source_id);
create index cost_assumptions_source on public.cost_assumptions (source_id) where source_id is not null;
