-- Trip Roulette Kerala — spin support (ARCHITECTURE §6, §8; DATABASE_API_SPEC §8.5, §8.7)
--
-- record_spin(): stores the winner chosen by the spin Edge Function. One result per trip is
--   guaranteed by the unique constraint on roulette_results.trip_id: concurrent calls insert at most
--   one row and every caller reads back the same stored result. Also marks the trip as spun.
-- replace_trip_itinerary(): replaces all itinerary items for a trip in one transaction.
-- Both are service role only; clients still cannot write trip tables.

create extension if not exists pgcrypto with schema extensions;

create function public.record_spin(
  p_trip_id uuid,
  p_recommendation_id uuid,
  p_selection_index smallint,
  p_idempotency_key uuid,
  p_rng text
)
returns table (
  result_id uuid,
  recommendation_id uuid,
  selection_index smallint,
  public_code text,
  idempotency_key uuid,
  created_at timestamptz,
  inserted boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- No 0/O or 1/I, to keep codes easy to read aloud.
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code text;
  v_bytes bytea;
  v_new_id uuid;
  v_attempt integer := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    v_bytes := extensions.gen_random_bytes(6);
    v_code := 'TR-';
    for i in 0..5 loop
      -- 32 symbols: the low 5 bits of a byte are uniform.
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) & 31) + 1, 1);
    end loop;

    begin
      insert into public.roulette_results (trip_id, recommendation_id, selection_index, idempotency_key, public_code, rng)
      values (p_trip_id, p_recommendation_id, p_selection_index, p_idempotency_key, v_code, p_rng)
      on conflict (trip_id) do nothing
      returning id into v_new_id;
      exit;
    exception when unique_violation then
      -- public_code collision (retry) or an idempotency key already used for another trip (give up).
      if v_attempt >= 5 or exists (select 1 from public.roulette_results r where r.idempotency_key = p_idempotency_key) then
        raise;
      end if;
    end;
  end loop;

  if v_new_id is not null then
    update public.trips set status = 'spun' where id = p_trip_id;
  end if;

  return query
    select r.id, r.recommendation_id, r.selection_index, r.public_code, r.idempotency_key, r.created_at, v_new_id is not null
    from public.roulette_results r
    where r.trip_id = p_trip_id;
end;
$$;

create function public.replace_trip_itinerary(p_trip_id uuid, p_items jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be an array' using errcode = '22023';
  end if;

  delete from public.trip_itinerary_items where trip_id = p_trip_id;

  insert into public.trip_itinerary_items (trip_id, day, sequence, kind, attraction_id, title, start_local, end_local, notes)
  select
    p_trip_id,
    (i ->> 'day')::smallint,
    (i ->> 'sequence')::smallint,
    (i ->> 'kind')::public.itinerary_kind,
    (i ->> 'attractionId')::uuid,
    i ->> 'title',
    (i ->> 'startLocal')::time,
    (i ->> 'endLocal')::time,
    i ->> 'notes'
  from jsonb_array_elements(p_items) as i;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.record_spin(uuid, uuid, smallint, uuid, text) from public, anon, authenticated;
revoke all on function public.replace_trip_itinerary(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_spin(uuid, uuid, smallint, uuid, text) to service_role;
grant execute on function public.replace_trip_itinerary(uuid, jsonb) to service_role;
