-- ====================================================================
-- Phase 2 — applied 2026-10-26 (part A NEW; parts B/C/D already live).
-- DEPLOYMENT ORDER: apply SECTION A to live Supabase BEFORE merging the
-- code PR that calls admin_save_nav_warning — otherwise admin edits 500.
-- Sections B, C and D were applied directly via the Supabase SQL editor
-- on 2026-10-26 and are recorded here for reproducibility (idempotent).
-- ====================================================================

-- ── SECTION A (NEW): atomic admin save RPC ─────────────────────────
-- Row update + geometry replace + audit insert in ONE transaction:
-- the PARTIAL states the two-statement endpoint could hit are
-- structurally impossible, and the audit row can no longer be lost
-- after the edit applied. Re-checks expected_updated_at under FOR UPDATE
-- (closes the read/write race between lock check and write). Readback
-- returns geometries from the BASE table so Tier B saves repaint too.

create or replace function public.admin_save_nav_warning(
  p_warning_id uuid,
  p_update jsonb,
  p_geometries jsonb default null,
  p_expected_updated_at timestamptz default null,
  p_operator text default 'unknown-admin',
  p_action text default 'EDIT',
  p_reason text default null,
  p_previous_tier text default 'B',
  p_new_tier text default 'B',
  p_diff_patch jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actual_updated_at timestamptz;
  v_geom_status text := 'unchanged';
  g jsonb;
  v_saved jsonb;
begin
  -- Optimistic lock re-check, atomically with the write (row locked).
  select updated_at into v_actual_updated_at
    from public.nav_warnings where id = p_warning_id for update;
  if not found then
    raise exception 'WARNING_NOT_FOUND' using errcode = 'P0404';
  end if;
  if p_expected_updated_at is not null and v_actual_updated_at <> p_expected_updated_at then
    raise exception 'STALE_UPDATED_AT' using errcode = 'P0409';
  end if;

  -- Field-level update: a key present in p_update sets the column
  -- (JSON null -> NULL); a missing key keeps the current value.
  update public.nav_warnings set
    title = case when p_update ? 'title' then p_update->>'title' else title end,
    area_text = case when p_update ? 'area_text' then p_update->>'area_text' else area_text end,
    categories = case when p_update ? 'categories'
      then (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(p_update->'categories') x)
      else categories end,
    status = case when p_update ? 'status' then p_update->>'status' else status end,
    triage_tier = case when p_update ? 'triage_tier' then p_update->>'triage_tier' else triage_tier end,
    data_quality = case when p_update ? 'data_quality' then p_update->>'data_quality' else data_quality end,
    unplotted_reason = case when p_update ? 'unplotted_reason' then p_update->>'unplotted_reason' else unplotted_reason end,
    qa_flags = case when p_update ? 'qa_flags' then p_update->'qa_flags' else qa_flags end,
    superseded_by = case when p_update ? 'superseded_by' then (p_update->>'superseded_by')::uuid else superseded_by end,
    issued_at = case when p_update ? 'issued_at' then (p_update->>'issued_at')::timestamptz else issued_at end,
    valid_from = case when p_update ? 'valid_from' then (p_update->>'valid_from')::timestamptz else valid_from end,
    valid_to = case when p_update ? 'valid_to' then (p_update->>'valid_to')::timestamptz else valid_to end,
    updated_at = now()
  where id = p_warning_id;

  -- Geometry replace: null = unchanged, [] = remove, [...] = replace.
  if p_geometries is not null then
    delete from public.nav_warning_geometries where warning_id = p_warning_id;
    for g in select * from jsonb_array_elements(p_geometries)
    loop
      insert into public.nav_warning_geometries (
        warning_id, zone_label, feature_type, buffer_nm, geom_postgis
      ) values (
        p_warning_id,
        g->>'zone_label',
        g->>'feature_type',
        coalesce((g->>'buffer_nm')::numeric, 0),
        st_geogfromewkt(g->>'ewkt')
      );
    end loop;
    v_geom_status := case when jsonb_array_length(p_geometries) > 0 then 'replaced' else 'removed' end;
  end if;

  -- Audit row in the SAME transaction: an unreachable/invalid audit rolls
  -- the whole edit back (no silently-unaudited success, no PARTIAL).
  insert into public.nav_warning_audits (
    warning_id, operator_id, action, reason, previous_tier, new_tier, signature_hash, diff_patch
  ) values (
    p_warning_id, p_operator, p_action, p_reason, p_previous_tier, p_new_tier,
    encode(convert_to(p_warning_id::text || ':' || clock_timestamp()::text, 'UTF8'), 'base64'),
    p_diff_patch
  );

  -- Server-truth readback: full saved row + geometries from the BASE
  -- table (st_asgeojson), not the Tier A view — Tier B saves repaint too.
  select jsonb_build_object(
    'warning', to_jsonb(w),
    'saved_geometries',
      case when p_geometries is null then null::jsonb
           else coalesce((
             select jsonb_agg(jsonb_build_object(
               'zone_label', gz.zone_label,
               'feature_type', gz.feature_type,
               'buffer_nm', gz.buffer_nm,
               'geojson_blob', st_asgeojson(gz.geom_postgis)::jsonb
             ) order by gz.geom_id)
             from public.nav_warning_geometries gz
             where gz.warning_id = p_warning_id
           ), '[]'::jsonb)
      end,
    'geometry', v_geom_status
  ) into v_saved
  from public.nav_warnings w
  where w.id = p_warning_id;

  return v_saved;
end;
$function$;

-- Never callable by anon/authenticated; the serverless endpoint uses
-- the service role. Same hardening pattern as upsert_nav_warning/is_admin.
revoke execute on function public.admin_save_nav_warning(uuid, jsonb, jsonb, timestamptz, text, text, text, text, text, jsonb) from public;
revoke execute on function public.admin_save_nav_warning(uuid, jsonb, jsonb, timestamptz, text, text, text, text, text, jsonb) from anon, authenticated;
grant execute on function public.admin_save_nav_warning(uuid, jsonb, jsonb, timestamptz, text, text, text, text, text, jsonb) to service_role;

-- ── SECTION B (already applied 2026-10-26): cron/sync protection ──
-- upsert_nav_warning with the admin-authoritative pre-check guard:
-- rows with qa_flags edited_by_admin / verified_by_admin, or status
-- superseded, are frozen against scraper overwrites (only raw_text,
-- parsing_method, source_id refresh; updated_at untouched).
create or replace function public.upsert_nav_warning(p_payload jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
    v_master      jsonb := p_payload->'master';
    v_geoms       jsonb := p_payload->'geometries';
    v_id          uuid;
    v_admin       boolean := false;
    v_status      text;
    v_valid_from  timestamptz;
    v_valid_to    timestamptz;
    g             jsonb;
    v_ftype       text;
    v_gid         uuid;
    v_kept        int := 0;
    v_existing    int := 0;
    v_new_ids     uuid[] := '{}';
begin
    -- Tolerant date parsing: guard against unparseable free text
    begin
        v_valid_from := nullif(v_master->>'valid_from', '')::timestamptz;
    exception when others then
        v_valid_from := null;
    end;

    begin
        v_valid_to := nullif(v_master->>'valid_to', '')::timestamptz;
    exception when others then
        v_valid_to := null;
    end;

    -- Admin-authoritative guard (2026-10-26): rows an admin has edited
    -- or verified, and rows superseded by an admin move, are authoritative.
    -- The scraper refreshes only source-evidence fields and never touches
    -- admin fields, qa_flags, tier, status, validity, updated_at or geometry.
    select id, status,
           (qa_flags @> '["edited_by_admin"]' or qa_flags @> '["verified_by_admin"]')
      into v_id, v_status, v_admin
      from public.nav_warnings
     where canonical_id = v_master->>'canonical_id';

    if v_id is not null and (v_admin or v_status = 'superseded') then
        update public.nav_warnings
           set raw_text = v_master->>'raw_text',
               parsing_method = coalesce(v_master->>'parsing_method', 'RULE'),
               source_id = v_master->>'source_id'
         where id = v_id;
        -- updated_at intentionally untouched: no admin-visible field changed,
        -- and no false 409s for an admin mid-edit.
        return v_id;
    end if;

    -- Original ingestion path below (unchanged)

    insert into public.nav_warnings (
        canonical_id, navarea, title, area_text, categories, status,
        triage_tier, data_quality, parsing_method, qa_flags,
        unplotted_reason, valid_from, valid_to, raw_text, source_id
    ) values (
        v_master->>'canonical_id',
        v_master->>'navarea',
        v_master->>'title',
        v_master->>'area_text',
        coalesce(array(select jsonb_array_elements_text(v_master->'categories')), '{}'),
        coalesce(v_master->>'status', 'active'),
        coalesce(v_master->>'triage_tier', 'C'),
        coalesce(v_master->>'data_quality', 'EXPLICIT'),
        coalesce(v_master->>'parsing_method', 'RULE'),
        coalesce(v_master->'qa_flags', '[]'::jsonb),
        v_master->>'unplotted_reason',
        v_valid_from,
        v_valid_to,
        v_master->>'raw_text',
        v_master->>'source_id'
    )
    on conflict (canonical_id) do update set
        title = excluded.title,
        area_text = excluded.area_text,
        categories = excluded.categories,
        status = excluded.status,
        triage_tier = excluded.triage_tier,
        data_quality = excluded.data_quality,
        parsing_method = excluded.parsing_method,
        qa_flags = excluded.qa_flags,
        unplotted_reason = excluded.unplotted_reason,
        valid_from = excluded.valid_from,
        valid_to = excluded.valid_to,
        raw_text = excluded.raw_text,
        source_id = excluded.source_id,
        updated_at = now()
    returning id into v_id;

    v_existing := (
        select count(*) from public.nav_warning_geometries where warning_id = v_id
    );

    if v_geoms is not null and jsonb_array_length(v_geoms) > 0 then
        for g in select * from jsonb_array_elements(v_geoms)
        loop
            v_ftype := coalesce(
                case upper(g->>'feature_type')
                    when 'LINESTRING'      then 'LINE'
                    when 'MULTILINESTRING' then 'LINE'
                    when 'MULTIPOINT'      then 'POINT'
                    when 'MULTIPOLYGON'    then 'POLYGON'
                    when 'POINT'           then 'POINT'
                    when 'POLYGON'         then 'POLYGON'
                    when 'CORRIDOR'        then 'CORRIDOR'
                    when 'SWEEP_ARC'       then 'SWEEP_ARC'
                    when 'BOUNDING_BOX'    then 'BOUNDING_BOX'
                    else null
                end,
                'POINT'
            );

            begin
                insert into public.nav_warning_geometries (
                    warning_id, zone_label, feature_type, buffer_nm, geom_postgis
                ) values (
                    v_id,
                    g->>'zone_label',
                    v_ftype,
                    coalesce((g->>'buffer_nm')::numeric, 0),
                    st_setsrid(st_geomfromgeojson(g->'geojson'), 4326)::geography
                )
                returning geom_id into v_gid;
                v_kept := v_kept + 1;
                v_new_ids := array_append(v_new_ids, v_gid);
            exception when others then
                raise warning 'upsert_nav_warning: skipped invalid geometry for warning %: %',
                    v_master->>'canonical_id', sqlerrm;
            end;
        end loop;

        if v_kept > 0 then
            delete from public.nav_warning_geometries
             where warning_id = v_id
               and not (geom_id = any (v_new_ids));
        end if;
    end if;

    if v_kept > 0 then
        update public.nav_warnings
           set qa_flags = qa_flags - 'geometry_preserved_previous_run'
         where id = v_id
           and qa_flags @> '["geometry_preserved_previous_run"]';
    elsif v_existing > 0 then
        update public.nav_warnings
           set triage_tier = 'A',
               unplotted_reason = null,
               qa_flags = coalesce(qa_flags, '[]'::jsonb)
                          || '["geometry_preserved_previous_run"]'::jsonb
         where id = v_id;
    elsif (v_master->>'triage_tier') = 'A' then
        update public.nav_warnings
           set triage_tier = 'C',
               unplotted_reason = 'no_valid_geometry'
         where id = v_id;
    end if;

    return v_id;
end;
$function$;

grant execute on function public.upsert_nav_warning(jsonb) to service_role;
revoke execute on function public.upsert_nav_warning(jsonb) from public;

-- ── SECTION C (already applied 2026-10-26): Tier B map view ────────
-- Same shape as nav_warnings_active_spatial, active + Tier B only.
-- anon/authenticated SELECT grants come from the default-privilege
-- pattern (verified 2026-10-26 via information_schema.role_table_grants).
create or replace view nav_warnings_unverified_spatial as
select w.id as warning_id, w.canonical_id, w.navarea, w.title, w.area_text, w.categories,
       w.status, w.triage_tier, w.data_quality, w.valid_from, w.valid_to,
       w.radio_frequencies, w.space_launch_mission,
       g.geom_id, g.zone_label, g.feature_type, g.buffer_nm, g.corridor_half_width_nm,
       g.altitude_floor_m, g.altitude_ceiling_fl, g.geom_postgis,
       st_asgeojson(g.geom_postgis)::jsonb as geojson_blob
from nav_warnings w
join nav_warning_geometries g on w.id = g.warning_id
where w.status = 'active' and w.triage_tier = 'B';

-- ── SECTION D (already applied 2026-10-26): EXECUTE hardening ──────
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.is_admin() from public;
