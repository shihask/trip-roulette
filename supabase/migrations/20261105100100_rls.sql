-- Trip Roulette Kerala — privileges, helper functions and RLS (DATABASE_API_SPEC v1.2 §7)
--
-- Principles
--   * RLS on every table. Privileges are granted explicitly (defence in depth on top of RLS).
--   * No client insert/update/delete on trip tables: Edge Functions write them with the service role.
--   * Policy helpers live in the unexposed `private` schema (not callable through the Data API as RPC).
--   * Admin/editor rights also require a permanent (non-anonymous) user.

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.is_permanent_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_permanent_user()
     and exists (
       select 1 from public.admin_users a
       where a.user_id = auth.uid() and a.is_active and a.role = 'admin'
     );
$$;

create function private.is_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_permanent_user()
     and exists (
       select 1 from public.admin_users a
       where a.user_id = auth.uid() and a.is_active and a.role in ('editor', 'admin')
     );
$$;

create function private.owns_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.trips t where t.id = p_trip_id and t.owner_user_id = auth.uid());
$$;

create function private.is_published_destination(p_destination_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.destinations d
    where d.id = p_destination_id and d.publication_status = 'published'
  );
$$;

-- A source is public when a published destination's attraction, cost or access record cites it.
create function private.is_public_source(p_source_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.access_information ai
      join public.destinations d on d.id = ai.destination_id
      where ai.source_id = p_source_id and d.publication_status = 'published'
    )
    or exists (
      select 1 from public.destination_costs c
      join public.destinations d on d.id = c.destination_id
      where c.source_id = p_source_id and d.publication_status = 'published'
    )
    or exists (
      select 1 from public.attractions a
      join public.destinations d on d.id = a.destination_id
      where a.source_id = p_source_id and d.publication_status = 'published'
    );
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to anon, authenticated, service_role;

-- Publication status can only become `published` through publish_destination();
-- only admins may unpublish or archive. Applies to API roles; migrations/service role are unaffected.
create function private.guard_publication_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.publication_status in ('published', 'archived') then
      raise exception 'New destinations start as draft or review; publish with publish_destination()'
        using errcode = '42501';
    end if;
  elsif new.publication_status is distinct from old.publication_status then
    if new.publication_status = 'published' then
      raise exception 'Publish with publish_destination()' using errcode = '42501';
    elsif (old.publication_status = 'published' or new.publication_status = 'archived') and not private.is_admin() then
      raise exception 'Only admins can unpublish or archive destinations' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger destinations_guard_status before insert or update of publication_status on public.destinations
  for each row execute function private.guard_publication_status();

-- ---------------------------------------------------------------------------
-- Privileges (RLS still applies to everything granted here)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Public catalogue: readable by everyone (rows filtered by RLS), writable by editors/admins.
grant select on
  public.districts, public.categories, public.locations, public.destinations,
  public.destination_categories, public.attractions, public.destination_images,
  public.destination_costs, public.access_information, public.information_sources,
  public.location_destination_routes
to anon, authenticated;

grant insert, update, delete on
  public.districts, public.categories, public.locations, public.destinations,
  public.destination_categories, public.attractions, public.destination_images,
  public.destination_costs, public.access_information, public.information_sources,
  public.location_destination_routes
to authenticated;

-- Configuration: editors read, admins write.
grant select, insert, update, delete on public.algorithm_configs, public.duration_rules, public.cost_assumptions to authenticated;

-- Trip data: read only (owner or admin).
grant select on public.trips, public.trip_recommendations, public.roulette_results, public.trip_itinerary_items to authenticated;
-- token_hash is never readable by clients (column privilege).
grant select (id, trip_id, snapshot, expires_at, revoked_at, created_at, updated_at) on public.trip_share_links to authenticated;

-- Operations.
grant select, insert, update, delete on public.admin_users to authenticated;
grant select on public.admin_audit_log, public.analytics_events, public.rate_limit_counters to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'districts', 'locations', 'categories', 'information_sources', 'destinations', 'destination_categories',
    'attractions', 'destination_costs', 'destination_images', 'access_information', 'location_destination_routes',
    'algorithm_configs', 'duration_rules', 'cost_assumptions', 'trips', 'trip_recommendations', 'roulette_results',
    'trip_itinerary_items', 'trip_share_links', 'admin_users', 'admin_audit_log', 'analytics_events', 'rate_limit_counters'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Reference tables: active rows public; editors write; admins delete.
do $$
declare
  t text;
begin
  foreach t in array array['districts', 'categories', 'locations'] loop
    execute format($f$
      create policy "%1$s: read active" on public.%1$I for select to anon, authenticated
        using (is_active or (select private.is_editor()));
      create policy "%1$s: editors insert" on public.%1$I for insert to authenticated
        with check ((select private.is_editor()));
      create policy "%1$s: editors update" on public.%1$I for update to authenticated
        using ((select private.is_editor())) with check ((select private.is_editor()));
      create policy "%1$s: admins delete" on public.%1$I for delete to authenticated
        using ((select private.is_admin()));
    $f$, t);
  end loop;
end;
$$;

-- Destinations: published rows public; editors see and edit all (status transitions guarded by trigger).
create policy "destinations: read published" on public.destinations for select to anon, authenticated
  using (publication_status = 'published' or (select private.is_editor()));
create policy "destinations: editors insert" on public.destinations for insert to authenticated
  with check ((select private.is_editor()));
create policy "destinations: editors update" on public.destinations for update to authenticated
  using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "destinations: admins delete" on public.destinations for delete to authenticated
  using ((select private.is_admin()));

-- Destination children: visible when the parent destination is published.
do $$
declare
  t text;
begin
  foreach t in array array['destination_categories', 'attractions', 'destination_images', 'destination_costs', 'access_information'] loop
    execute format($f$
      create policy "%1$s: read when destination published" on public.%1$I for select to anon, authenticated
        using (private.is_published_destination(destination_id) or (select private.is_editor()));
      create policy "%1$s: editors insert" on public.%1$I for insert to authenticated
        with check ((select private.is_editor()));
      create policy "%1$s: editors update" on public.%1$I for update to authenticated
        using ((select private.is_editor())) with check ((select private.is_editor()));
      create policy "%1$s: admins delete" on public.%1$I for delete to authenticated
        using ((select private.is_admin()));
    $f$, t);
  end loop;
end;
$$;

-- Information sources: visible when cited by a published record.
create policy "information_sources: read when cited publicly" on public.information_sources for select to anon, authenticated
  using (private.is_public_source(id) or (select private.is_editor()));
create policy "information_sources: editors insert" on public.information_sources for insert to authenticated
  with check ((select private.is_editor()));
create policy "information_sources: editors update" on public.information_sources for update to authenticated
  using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "information_sources: admins delete" on public.information_sources for delete to authenticated
  using ((select private.is_admin()));

-- Routes: public for published destinations; editors read; admins write (normally refresh-routes, service role).
create policy "routes: read when destination published" on public.location_destination_routes for select to anon, authenticated
  using (private.is_published_destination(destination_id) or (select private.is_editor()));
create policy "routes: admins insert" on public.location_destination_routes for insert to authenticated
  with check ((select private.is_admin()));
create policy "routes: admins update" on public.location_destination_routes for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "routes: admins delete" on public.location_destination_routes for delete to authenticated
  using ((select private.is_admin()));

-- Configuration: editors read; admins write.
do $$
declare
  t text;
begin
  foreach t in array array['algorithm_configs', 'duration_rules', 'cost_assumptions'] loop
    execute format($f$
      create policy "%1$s: editors read" on public.%1$I for select to authenticated
        using ((select private.is_editor()));
      create policy "%1$s: admins insert" on public.%1$I for insert to authenticated
        with check ((select private.is_admin()));
      create policy "%1$s: admins update" on public.%1$I for update to authenticated
        using ((select private.is_admin())) with check ((select private.is_admin()));
      create policy "%1$s: admins delete" on public.%1$I for delete to authenticated
        using ((select private.is_admin()));
    $f$, t);
  end loop;
end;
$$;

-- Trips: owner or admin may read. No write policies.
create policy "trips: owner or admin reads" on public.trips for select to authenticated
  using (owner_user_id = (select auth.uid()) or (select private.is_admin()));

do $$
declare
  t text;
begin
  foreach t in array array['trip_recommendations', 'roulette_results', 'trip_itinerary_items', 'trip_share_links'] loop
    execute format($f$
      create policy "%1$s: owner or admin reads" on public.%1$I for select to authenticated
        using (private.owns_trip(trip_id) or (select private.is_admin()));
    $f$, t);
  end loop;
end;
$$;

-- Admin users: own row or admin; admins manage.
create policy "admin_users: own row or admin reads" on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "admin_users: admins insert" on public.admin_users for insert to authenticated
  with check ((select private.is_admin()));
create policy "admin_users: admins update" on public.admin_users for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin_users: admins delete" on public.admin_users for delete to authenticated
  using ((select private.is_admin()));

-- Audit log: editors read. Analytics and rate limits: admins read. Writes come from triggers / Edge Functions.
create policy "admin_audit_log: editors read" on public.admin_audit_log for select to authenticated
  using ((select private.is_editor()));
create policy "analytics_events: admins read" on public.analytics_events for select to authenticated
  using ((select private.is_admin()));
create policy "rate_limit_counters: admins read" on public.rate_limit_counters for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Storage: destination images (public read; editors upload JPEG/PNG/WebP up to 5 MB)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('destination-images', 'destination-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "destination-images: editors upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'destination-images' and (select private.is_editor()));
create policy "destination-images: editors update" on storage.objects for update to authenticated
  using (bucket_id = 'destination-images' and (select private.is_editor()))
  with check (bucket_id = 'destination-images' and (select private.is_editor()));
create policy "destination-images: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'destination-images' and (select private.is_admin()));
