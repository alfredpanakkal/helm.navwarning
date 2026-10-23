/**
 * helm.navwarning — legacy admin console bundle
 *
 * RETIRED (E5). This file intentionally contains no executable code.
 *
 * The single-file admin console that previously lived here has been
 * superseded by the unified React admin console in this repository.
 * All admin functionality now lives behind admin-guarded API endpoints
 * (api/admin/warning-edit.ts, api/admin/warning-audit.ts) and the React UI:
 *
 *   /#/databank  — Data Bank: filters, saved views, bulk edit, exports,
 *                  per-warning audit history, stale-warning banner
 *   /#/manual    — Manual parser / editor entry points
 *   /#/imports   — Paste queue / CSV ingestion
 *   /#/workspace — Pipeline overview
 *
 * Entry point for admins: /admin.html (thin auth gateway that validates
 * the Supabase session and redirects to /#/databank).
 *
 * This stub remains only so any stale references to /assets/js/admin.js
 * resolve harmlessly. It is safe to delete once no page references it.
 */
