/**
 * @deprecated Legacy Supabase client kept only for backwards compatibility.
 *
 * The old comment below described the pre-20261019 flat-table schema
 * (warning_id / issued_date / latitude / longitude), which no longer exists.
 * The current schema contract is documented in
 * docs/supabase-backend-contract.md and src/services/navWarningQueries.ts:
 *   - master table nav_warnings keyed by uuid id + canonical_id, with
 *     categories TEXT[], triage_tier, data_quality, status, valid_from/to
 *   - geometry in nav_warning_geometries / nav_warnings_active_spatial view
 *
 * New code should import from './supabaseServer' (server) or
 * './supabaseClient' (browser) instead. This module will be removed once
 * all remaining consumers are migrated.
 */
import { getSupabaseClient } from './supabaseServer';

export const supabase = getSupabaseClient();
