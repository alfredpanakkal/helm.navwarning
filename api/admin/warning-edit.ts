/**
 * Vercel Serverless Function: Admin Warning Editor
 *
 * Fully-editable admin (Phase E1): field-level PATCH for a nav_warning,
 * including classification, temporal, lifecycle and geometry changes plus
 * the NAVAREA "supersede + recreate" move operation (decided 2026-10-23).
 *
 * Security:
 * 1. verifyAdminRequest: live Supabase JWT + admin role (server/auth.ts).
 * 2. Optimistic locking via expected_updated_at (409 on conflict).
 * 3. Column whitelists mirror the 20261019/20 backend contract
 *    (docs/supabase-backend-contract.md) — dropped columns can never be
 *    written, CHECK-constrained enums are validated server-side.
 * 4. raw_text is NEVER editable (evidence integrity).
 * 5. Audit is mandatory: edits are refused when nav_warning_audits is
 *    unreachable, and a failed audit insert fails the request (500
 *    AUDIT_FAILED) instead of returning a silently-unaudited success.
 * 6. NAVAREA moves record DB-enforced lineage via nav_warnings.superseded_by.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../../src/lib/supabaseServer.js';
import { verifyAdminRequest } from '../../server/auth.js';
import { ALLOWED_STATUS, ALLOWED_QUALITY, ALLOWED_TIERS, ALLOWED_CATEGORIES } from '../../src/lib/adminContract.js';
import { geojsonToEwkt } from '../../src/lib/geojsonToEwkt.js';



interface GeometryPatch {
  feature_type?: string;
  zone_label?: string;
  buffer_nm?: number;
  geojson?: { type: string; coordinates: unknown };
}

interface WarningEditPatch {
  title?: string;
  area_text?: string;
  categories?: string[];
  status?: string;
  triage_tier?: string;
  data_quality?: string;
  issued_at?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  move_to_navarea?: string;
  /** Optional lineage link (uuid or canonical_id) when an operator supersedes manually. */
  superseded_by?: string;
  /** Triaged-out reason (Tier C annotation); null or "" clears it. */
  unplotted_reason?: string | null;
  /** Record an audited VERIFY action (no field changes required). */
  verify?: boolean;
  geometry?: GeometryPatch[];
  note?: string;
}

function safeTimestamp(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function toFullNavarea(nav: unknown): string | null {
  const s = String(nav || '').trim().toUpperCase();
  if (!s) return null;
  if (s === 'BALTIC' || s === 'NAVAREA BALTIC') return 'NAVAREA BALTIC';
  return s.startsWith('NAVAREA') ? s : 'NAVAREA ' + s;
}

async function writeAuditRow(
  client: any,
  warningUuid: string,
  operator: string,
  action: string,
  reason: string,
  previousTier: string,
  newTier: string,
  diffPatch: unknown
): Promise<'written' | 'failed' | 'skipped'> {
  try {
    const { error } = await client.from('nav_warning_audits').insert([{
      warning_id: warningUuid,
      operator_id: operator,
      action,
      reason,
      previous_tier: previousTier,
      new_tier: newTier,
      signature_hash: Buffer.from(warningUuid + ':' + Date.now()).toString('base64'),
      diff_patch: diffPatch,
    }]);
    if (error) { console.warn('nav_warning_audits insert failed:', error.message); return 'failed'; }
    return 'written';
  } catch (e: any) {
    console.warn('nav_warning_audits insert exception:', e?.message || e);
    return 'failed';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PATCH');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return res.status(auth.status).json({
      error: auth.error,
      code: auth.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
    });
  }

  const operatorEmail = (auth.user && auth.user.email) || 'unknown-admin';
  const client = getSupabaseClient();
  if (!client) {
    return res.status(503).json({ error: 'Supabase is not configured on the server.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const warningId: string | undefined = typeof body.warning_id === 'string' && body.warning_id.trim() ? body.warning_id.trim() : undefined;
    const canonicalId: string | undefined = typeof body.canonical_id === 'string' && body.canonical_id.trim() ? body.canonical_id.trim() : undefined;
    const expectedUpdatedAt: string | undefined =
      typeof body.expected_updated_at === 'string' && body.expected_updated_at ? body.expected_updated_at : undefined;
    const patch: WarningEditPatch = body.patch && typeof body.patch === 'object' ? body.patch : {};

    if (!warningId && !canonicalId) {
      return res.status(400).json({ error: 'warning_id (uuid) or canonical_id is required.' });
    }

    // ── 1. Load the current row (identity + optimistic-lock token) ──
    const isUuid = warningId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(warningId);
    let rowQuery = client
      .from('nav_warnings')
      .select('id, canonical_id, navarea, title, area_text, raw_text, categories, status, triage_tier,'
        + ' data_quality, qa_flags, unplotted_reason, parsing_method, valid_from, valid_to, issued_at, updated_at');
    rowQuery = isUuid ? rowQuery.eq('id', warningId) : rowQuery.eq('canonical_id', canonicalId);
    const { data: current, error: fetchErr }: any = await rowQuery.maybeSingle();

    if (fetchErr) {
      console.error('[warning-edit] warning read failed:', fetchErr.message);
      return res.status(502).json({ error: 'Could not read the warning.', code: 'WARNING_READ_FAILED' });
    }
    if (!current) {
      return res.status(404).json({ error: 'Warning not found. It may have been deleted or the id is wrong.' });
    }

    // ── 2. Optimistic locking ──
    if (expectedUpdatedAt && current.updated_at && expectedUpdatedAt !== current.updated_at) {
      return res.status(409).json({
        error: 'Conflict: this warning was changed by someone else while you were editing.',
        code: 'CONFLICT',
        current: { updated_at: current.updated_at, canonical_id: current.canonical_id },
      });
    }

    // ── 3. Validate + build the field-level update ──
    const update: Record<string, unknown> = {};
    const errors: string[] = [];

    if (patch.title !== undefined) {
      const t = String(patch.title).trim();
      if (!t) errors.push('title cannot be empty');
      else update.title = t.slice(0, 255);
    }
    if (patch.area_text !== undefined) {
      update.area_text = patch.area_text === null ? null : String(patch.area_text).slice(0, 2000);
    }
    if (patch.categories !== undefined) {
      if (!Array.isArray(patch.categories) || patch.categories.length === 0) {
        errors.push('categories must be a non-empty array');
      } else {
        const cats = patch.categories.map((c) => String(c).trim().toLowerCase()).filter((c) => ALLOWED_CATEGORIES.includes(c));
        if (cats.length === 0) errors.push('no valid categories (allowed: ' + ALLOWED_CATEGORIES.join(', ') + ')');
        else update.categories = cats;
      }
    }
    if (patch.status !== undefined) {
      const s = String(patch.status).toLowerCase();
      if (!ALLOWED_STATUS.includes(s)) errors.push('status must be one of ' + ALLOWED_STATUS.join('|'));
      else update.status = s;
    }
    if (patch.triage_tier !== undefined) {
      const t = String(patch.triage_tier).toUpperCase();
      if (!ALLOWED_TIERS.includes(t)) errors.push('triage_tier must be A, B or C');
      else update.triage_tier = t;
    }
    if (patch.data_quality !== undefined) {
      const q = String(patch.data_quality).toUpperCase();
      if (!ALLOWED_QUALITY.includes(q)) errors.push('data_quality must be one of ' + ALLOWED_QUALITY.join('|'));
      else update.data_quality = q;
    }
    if (patch.unplotted_reason !== undefined) {
      update.unplotted_reason =
        patch.unplotted_reason === null || String(patch.unplotted_reason).trim() === ''
          ? null
          : String(patch.unplotted_reason).trim().slice(0, 500);
    }
    if (patch.superseded_by !== undefined) {
      const resultingStatus = String(update.status !== undefined ? update.status : current.status || '').toLowerCase();
      if (resultingStatus !== 'superseded') {
        errors.push('superseded_by can only be set together with status = superseded');
      } else {
        const targetId = String(patch.superseded_by).trim();
        const isTargetUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
        const { data: target }: any = await client
          .from('nav_warnings')
          .select('id')
          .eq(isTargetUuid ? 'id' : 'canonical_id', targetId)
          .maybeSingle();
        if (!target) errors.push('superseded_by does not match any warning (uuid or canonical_id).');
        else if (target.id === current.id) errors.push('superseded_by cannot point at the warning itself.');
        else update.superseded_by = target.id;
      }
    }
    for (const field of ['issued_at', 'valid_from', 'valid_to'] as const) {
      const v = (patch as any)[field];
      if (v !== undefined) {
        const ts = safeTimestamp(v);
        if (ts === undefined) errors.push(field + ' is not a valid ISO 8601 timestamp');
        else update[field] = ts;
      }
    }

    // Temporal sanity: valid_to must be after valid_from when both are set
    const resultingFrom = (update.valid_from !== undefined ? update.valid_from : current.valid_from) || null;
    const resultingTo = (update.valid_to !== undefined ? update.valid_to : current.valid_to) || null;
    if (resultingFrom && resultingTo && new Date(resultingTo).getTime() <= new Date(resultingFrom).getTime()) {
      errors.push('valid_to must be later than valid_from');
    }

    // ── 4. Geometry patch (replace-all semantics, like the ingestion RPC) ──
    let geometryRows: any[] | null = null;
    if (patch.geometry !== undefined) {
      if (patch.geometry === null || patch.geometry.length === 0) {
        geometryRows = []; // explicit geometry removal
      } else {
        // The spatial view omits snapping_rule and some advanced fields. Read the base table
        // before replacement so hidden metadata cannot be deleted by an otherwise valid edit.
        const { data: existingGeometryMetadata, error: existingGeometryMetadataError } = await client
          .from('nav_warning_geometries')
          .select('corridor_half_width_nm, corridor_clearance_nm, sweep_radius_nm, sweep_start_azimuth, sweep_end_azimuth, altitude_floor_m, altitude_ceiling_fl, snapping_rule')
          .eq('warning_id', current.id);
        if (existingGeometryMetadataError) {
          errors.push('Unable to verify existing geometry metadata; geometry save was blocked');
        } else {
          const hasUnsupportedExistingMetadata = (existingGeometryMetadata || []).some((g: Record<string, unknown>) =>
            [
              'corridor_half_width_nm',
              'corridor_clearance_nm',
              'sweep_radius_nm',
              'sweep_start_azimuth',
              'sweep_end_azimuth',
              'altitude_ceiling_fl',
            ].some((field) => g[field] != null) ||
            (g.altitude_floor_m != null && Number(g.altitude_floor_m) !== 0) ||
            (g.snapping_rule != null && String(g.snapping_rule).toUpperCase() !== 'NONE')
          );
          if (hasUnsupportedExistingMetadata) {
            errors.push('Existing geometry has metadata this atomic save path cannot preserve; geometry replacement was blocked');
          }
        }

        const rows: any[] = [];
        for (const g of patch.geometry) {
          const geometryRecord = (g || {}) as Record<string, unknown>;
          const unsupportedMetadata = [
            'corridor_half_width_nm',
            'corridor_clearance_nm',
            'sweep_radius_nm',
            'sweep_start_azimuth',
            'sweep_end_azimuth',
            'altitude_ceiling_fl',
          ].some((field) => geometryRecord[field] != null) ||
            (geometryRecord.altitude_floor_m != null && Number(geometryRecord.altitude_floor_m) !== 0) ||
            (geometryRecord.snapping_rule != null && String(geometryRecord.snapping_rule).toUpperCase() !== 'NONE');
          if (unsupportedMetadata) {
            errors.push('geometry contains corridor, sweep, altitude or snapping metadata that this save path cannot preserve');
            break;
          }
          const conv = geojsonToEwkt(g && g.geojson);
          if (!conv) { errors.push('geometry contains an invalid GeoJSON shape or out-of-range coordinates'); break; }
          rows.push({
            warning_id: current.id,
            zone_label: (g.zone_label || 'PRIMARY_HAZARD').slice(0, 100),
            feature_type:
              (String(g.feature_type || '').toUpperCase() === 'CORRIDOR' && conv.featureType === 'LINE') ||
              (['SWEEP_ARC', 'BOUNDING_BOX'].includes(String(g.feature_type || '').toUpperCase()) && conv.featureType === 'POLYGON')
                ? String(g.feature_type).toUpperCase()
                : conv.featureType,
            geom_postgis: conv.ewkt,
            buffer_nm: Number.isFinite(Number(g.buffer_nm)) ? Number(g.buffer_nm) : 0,
          });
        }
        if (!errors.length) geometryRows = rows;
      }
    }

    // ── 4b. Audited verify: promote Tier B -> Tier A only when every Tier A
    // invariant already holds (EXPLICIT quality, no unplotted reason, at
    // least one geometry, not superseded). Otherwise the verify stays
    // flag-only and the row remains a review candidate - an operator's
    // VERIFY must never produce a Tier A row that violates
    // chk_tier_a_invariants. An explicit patch.triage_tier always wins.
    // Decided 2026-10-26 (console-ux-68 follow-up). ──
    if (patch.verify && patch.triage_tier === undefined && String(current.triage_tier || 'B').toUpperCase() === 'B') {
      const promote =
        String(current.data_quality || '').toUpperCase() === 'EXPLICIT' &&
        !current.unplotted_reason &&
        String(current.status || '').toLowerCase() !== 'superseded';
      if (promote) {
        const { count: geomCount } = await client
          .from('nav_warning_geometries')
          .select('geom_id', { count: 'exact', head: true })
          .eq('warning_id', current.id);
        if (geomCount) update.triage_tier = 'A';
      }
    }

    // ── 5. Tier A invariant (chk_tier_a_invariants) ──
    const resultingTier = String(update.triage_tier !== undefined ? update.triage_tier : current.triage_tier || 'B').toUpperCase();
    if (resultingTier === 'A' && !errors.length) {
      const resultingQuality = String(update.data_quality !== undefined ? update.data_quality : current.data_quality || '').toUpperCase();
      const resultingStatus = String(update.status !== undefined ? update.status : current.status || '').toLowerCase();
      const resultingUnplotted = update.unplotted_reason !== undefined ? update.unplotted_reason : current.unplotted_reason;
      if (resultingQuality !== 'EXPLICIT') {
        errors.push('Tier A requires data_quality = EXPLICIT — set it in the same edit.');
      }
      if (resultingStatus === 'superseded') {
        errors.push('Tier A cannot be superseded — choose another status or a lower tier.');
      }
      if (resultingUnplotted) {
        errors.push('Tier A requires unplotted_reason to be cleared (this edit clears it automatically only when geometry is supplied).');
      }
      if (geometryRows === null) {
        const { count } = await client
          .from('nav_warning_geometries')
          .select('geom_id', { count: 'exact', head: true })
          .eq('warning_id', current.id);
        if (!count) {
          errors.push('Tier A requires at least one geometry — add or edit the geometry in the same edit.');
        }
      } else if (geometryRows.length === 0) {
        errors.push('Tier A requires at least one geometry — removing all geometry requires a lower tier.');
      }
    }

    if (errors.length) {
      return res.status(400).json({ error: errors.join(' | '), code: 'VALIDATION' });
    }

    // ── 5b. Audit preflight: refuse edits when the audit log is unreachable ──
    const { error: auditProbe } = await client
      .from('nav_warning_audits')
      .select('*', { head: true, count: 'exact' });
    if (auditProbe) {
      console.error('[warning-edit] audit preflight failed:', auditProbe.message);
      return res.status(503).json({
        error: 'Audit log unavailable — edit refused.',
        code: 'AUDIT_UNAVAILABLE',
      });
    }

    // ── 6. NAVAREA move: supersede + recreate (decided 2026-10-23) ──
    if (patch.move_to_navarea) {
      const targetFull = toFullNavarea(patch.move_to_navarea);
      if (!targetFull) {
        return res.status(400).json({ error: 'move_to_navarea must be a valid NAVAREA region.' });
      }
      if (targetFull === String(current.navarea || '').toUpperCase()) {
        return res.status(400).json({ error: 'The warning is already in ' + targetFull + ' — nothing to move.' });
      }
      const m = String(current.canonical_id || '').match(/^(NAVAREA\s+\S+)\s+(\d{1,4})\/(\d{2})$/i);
      if (!m) {
        return res.status(400).json({ error: 'canonical_id ' + current.canonical_id + ' does not match the NAVAREA NNNN/YY pattern — move aborted.' });
      }
      const newCanonicalId = targetFull + ' ' + m[2] + '/' + m[3];

      // 6a. Create the copy in the target region first (geometries copied as a starting point)
      const { data: created, error: createErr }: any = await client
        .from('nav_warnings')
        .insert({
          canonical_id: newCanonicalId,
          navarea: targetFull,
          title: current.title,
          area_text: current.area_text,
          categories: current.categories || ['general'],
          status: 'active',
          // A new identity is machine-unproven: it starts at Tier B for review.
          triage_tier: 'B',
          data_quality: 'EXPLICIT',
          parsing_method: current.parsing_method || 'RULE',
          qa_flags: Array.from(new Set([...(current.qa_flags || []), 'moved_from:' + current.canonical_id])),
          valid_from: current.valid_from,
          valid_to: current.valid_to,
          issued_at: current.issued_at,
          raw_text: current.raw_text,
          source_id: (current as any).source_id || 'manual-import',
        })
        .select('id, canonical_id')
        .single();
      if (createErr || !created) {
        console.error('[warning-edit] move create failed:', createErr?.message);
        return res.status(502).json({ error: 'Move failed while creating the target copy.', code: 'PARTIAL' });
      }

      // 6b. Supersede the original and record the superseded_by lineage
      const { error: supErr } = await client
        .from('nav_warnings')
        .update({ status: 'superseded', superseded_by: created.id })
        .eq('id', current.id);
      if (supErr) {
        // Roll back: remove the copy so no duplicate survives a failed move
        await client.from('nav_warnings').delete().eq('id', created.id);
        console.error('[warning-edit] move supersede failed:', supErr.message);
        return res.status(502).json({ error: 'Move failed while superseding the original. The created copy was rolled back.', code: 'PARTIAL' });
      }

      // 6c. Copy geometries
      const { data: oldGeoms } = await client
        .from('nav_warning_geometries')
        .select('zone_label, feature_type, geom_postgis, buffer_nm, corridor_half_width_nm, corridor_clearance_nm, sweep_radius_nm, sweep_start_azimuth, sweep_end_azimuth, altitude_floor_m, altitude_ceiling_fl, snapping_rule')
        .eq('warning_id', current.id);
      if (Array.isArray(oldGeoms) && oldGeoms.length > 0) {
        await client.from('nav_warning_geometries').insert(
          oldGeoms.map((g: any) => ({
            warning_id: created.id,
            zone_label: g.zone_label,
            feature_type: g.feature_type,
            geom_postgis: g.geom_postgis,
            buffer_nm: g.buffer_nm,
            corridor_half_width_nm: g.corridor_half_width_nm,
            corridor_clearance_nm: g.corridor_clearance_nm,
            sweep_radius_nm: g.sweep_radius_nm,
            sweep_start_azimuth: g.sweep_start_azimuth,
            sweep_end_azimuth: g.sweep_end_azimuth,
            altitude_floor_m: g.altitude_floor_m,
            altitude_ceiling_fl: g.altitude_ceiling_fl,
            snapping_rule: g.snapping_rule,
          }))
        );
      }

      // 6d. Audit both sides of the move (mandatory — a failed audit row fails the request)
      const outAudit = await writeAuditRow(client, current.id, operatorEmail, 'MOVE_OUT',
        'Superseded by move to ' + targetFull + ' → ' + newCanonicalId, String(current.triage_tier || 'B'), 'B',
        { moved_to: newCanonicalId, superseded_by: created.id });
      const inAudit = await writeAuditRow(client, created.id, operatorEmail, 'MOVE_IN',
        'Created by move from ' + current.canonical_id + ' (' + (patch.note || 'admin move') + ')', String(current.triage_tier || 'B'), 'B',
        { moved_from: current.canonical_id });
      if (outAudit !== 'written' || inAudit !== 'written') {
        return res.status(500).json({
          error: 'Move applied but the audit row could not be written — check the audit log.',
          code: 'AUDIT_FAILED',
          moved: true,
          superseded: { id: current.id, canonical_id: current.canonical_id, status: 'superseded' },
          warning: created,
        });
      }

      return res.status(200).json({
        success: true,
        moved: true,
        superseded: { id: current.id, canonical_id: current.canonical_id, status: 'superseded' },
        warning: created,
      });
    }

    // ── 7. Atomic save RPC: row update + geometry replace + audit insert in one transaction ──
    update.qa_flags = Array.from(new Set([
      ...(current.qa_flags || []),
      patch.verify ? 'verified_by_admin' : 'edited_by_admin',
    ]));
    if (geometryRows !== null && geometryRows.length > 0 && resultingTier === 'A') {
      update.unplotted_reason = null;
    }
    if (Object.keys(update).length === 0 && geometryRows === null) {
      return res.status(400).json({ error: 'Empty patch — nothing to update.' });
    }

    // One transaction: the master-row update, the geometry replace and the
    // audit insert all commit or roll back together — the PARTIAL error
    // paths are structurally impossible. The RPC re-checks the optimistic
    // lock under FOR UPDATE, closing the read/write race the old two-
    // statement path had (lock checked at step 2, write at step 7).
    // saved_geometries is read back from the BASE geometry table (via
    // st_asgeojson), not the Tier A view — a Tier B geometry edit now
    // repaints its real shape instead of an empty readback.
    const geometryStatus = geometryRows === null ? 'unchanged' : geometryRows.length > 0 ? 'replaced' : 'removed';
    const { data: rpcResult, error: rpcErr }: any = await client.rpc('admin_save_nav_warning', {
      p_warning_id: current.id,
      p_update: update,
      p_geometries: geometryRows === null ? null : geometryRows.map((r: any) => ({
        zone_label: r.zone_label,
        feature_type: r.feature_type,
        buffer_nm: r.buffer_nm,
        ewkt: r.geom_postgis,
      })),
      p_expected_updated_at: expectedUpdatedAt ?? null,
      p_operator: operatorEmail,
      p_action: patch.verify ? 'VERIFY' : 'EDIT',
      p_reason: patch.note || (patch.verify ? 'Admin verification (audited Verify action)' : 'Admin edit (geometry ' + geometryStatus + ')'),
      p_previous_tier: String(current.triage_tier || 'B'),
      p_new_tier: resultingTier,
      p_diff_patch: { ...update, geometry: geometryStatus },
    });
    if (rpcErr || !rpcResult) {
      const msg = String(rpcErr?.message || '');
      if (msg.includes('STALE_UPDATED_AT')) {
        const { data: fresh }: any = await client
          .from('nav_warnings')
          .select('updated_at')
          .eq('id', current.id)
          .maybeSingle();
        return res.status(409).json({
          error: 'Conflict: this warning was changed by someone else while you were editing.',
          code: 'CONFLICT',
          current: { updated_at: fresh?.updated_at ?? null, canonical_id: current.canonical_id },
        });
      }
      if (msg.includes('WARNING_NOT_FOUND')) {
        return res.status(404).json({ error: 'Warning not found. It may have been deleted or the id is wrong.' });
      }
      console.error('[warning-edit] admin_save_nav_warning failed:', msg);
      return res.status(502).json({ error: 'Update failed.', code: 'UPDATE_FAILED' });
    }

    return res.status(200).json({
      success: true,
      warning: rpcResult.warning,
      saved_geometries: rpcResult.saved_geometries,
      geometry: rpcResult.geometry,
      audit: 'written',
    });
  } catch (err: any) {
    console.error('[warning-edit] exception:', err?.message || err);
    return res.status(500).json({ error: 'Edit failed with an unexpected server error.' });
  }
}
