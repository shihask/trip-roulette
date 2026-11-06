-- Trip Roulette Kerala — audit triggers and publish_destination() (DATABASE_API_SPEC v1.2 §6, §8.10, §11)

-- ---------------------------------------------------------------------------
-- Audit: every catalogue/configuration change made by an admin user is logged.
-- Trigger arguments name the key column(s) used for entity_id.
-- Changes by migrations or the service role (no admin actor) are not logged here.
-- ---------------------------------------------------------------------------
create function private.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  old_j jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_j jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  row_j jsonb := coalesce(new_j, old_j);
  entity text;
  act text := lower(tg_op);
begin
  if actor is null or not exists (select 1 from public.admin_users a where a.user_id = actor) then
    return null;
  end if;

  select string_agg(row_j ->> k, ':') into entity from unnest(tg_argv) as k;

  if tg_table_name = 'destinations' and tg_op = 'UPDATE'
     and (old_j ->> 'publication_status') is distinct from (new_j ->> 'publication_status') then
    act := case new_j ->> 'publication_status'
      when 'published' then 'publish'
      when 'archived' then 'archive'
      else 'status:' || (new_j ->> 'publication_status')
    end;
  end if;

  insert into public.admin_audit_log (admin_user_id, entity_type, entity_id, action, before_snapshot, after_snapshot)
  values (actor, tg_table_name, coalesce(entity, ''), act, old_j, new_j);

  return null;
end;
$$;

do $$
declare
  spec text[];
begin
  foreach spec slice 1 in array array[
    array['districts', 'id'],
    array['locations', 'id'],
    array['categories', 'id'],
    array['information_sources', 'id'],
    array['destinations', 'id'],
    array['destination_categories', 'destination_id'', ''category_id'],
    array['attractions', 'id'],
    array['destination_costs', 'id'],
    array['destination_images', 'id'],
    array['access_information', 'id'],
    array['location_destination_routes', 'location_id'', ''destination_id'', ''transport_mode'],
    array['algorithm_configs', 'version'],
    array['duration_rules', 'duration_code'],
    array['cost_assumptions', 'key'],
    array['admin_users', 'user_id']
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_change(''%s'')',
      spec[1] || '_audit', spec[1], spec[2]
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- publish_destination(destination_id): admin only. Validates §11 requirements;
-- returns { published: bool, failures: [{ code, message }] }.
-- ---------------------------------------------------------------------------
create function public.publish_destination(destination_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.destinations;
  failures jsonb := '[]'::jsonb;
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not private.is_admin() then
    raise exception 'Only admins can publish destinations' using errcode = '42501';
  end if;

  select * into d from public.destinations where id = publish_destination.destination_id for update;
  if not found then
    raise exception 'Destination not found' using errcode = 'P0002';
  end if;

  if coalesce(trim(d.description), '') = '' then
    failures := failures || jsonb_build_object('code', 'missing_description', 'message', 'Add a description.');
  end if;

  if not exists (
    select 1 from public.destination_images i
    where i.destination_id = d.id and trim(i.credit) <> '' and trim(i.licence) <> ''
  ) then
    failures := failures || jsonb_build_object('code', 'missing_image', 'message', 'Add at least one licensed image with a credit.');
  end if;

  if not exists (select 1 from public.destination_categories c where c.destination_id = d.id and c.is_primary) then
    failures := failures || jsonb_build_object('code', 'missing_primary_category', 'message', 'Choose a primary category.');
  end if;

  if cardinality(d.suitable_durations) = 0 then
    failures := failures || jsonb_build_object('code', 'missing_durations', 'message', 'Set the suitable trip durations.');
  end if;

  if not exists (select 1 from public.destination_costs c where c.destination_id = d.id and c.is_essential) then
    failures := failures || jsonb_build_object('code', 'missing_essential_costs', 'message', 'Add the essential cost estimates.');
  end if;

  if not exists (
    select 1 from public.access_information a
    where a.destination_id = d.id
      and a.attraction_id is null
      and a.is_essential
      and a.status <> 'unknown'
      and a.review_due_at > now()
      and (a.valid_until is null or a.valid_until >= today)
  ) then
    failures := failures || jsonb_build_object('code', 'missing_current_essential_access', 'message', 'Add a current, verified essential access record for the destination.');
  end if;

  if exists (
    select 1 from public.locations l
    where l.is_active
      and not exists (
        select 1 from public.location_destination_routes r
        where r.location_id = l.id and r.destination_id = d.id
      )
  ) then
    failures := failures || jsonb_build_object('code', 'missing_routes', 'message', 'Routes are missing from one or more starting towns.');
  end if;

  if jsonb_array_length(failures) > 0 then
    return jsonb_build_object('published', false, 'failures', failures);
  end if;

  update public.destinations set publication_status = 'published' where id = d.id;
  return jsonb_build_object('published', true, 'failures', '[]'::jsonb);
end;
$$;

revoke all on function public.publish_destination(uuid) from public, anon;
grant execute on function public.publish_destination(uuid) to authenticated;
