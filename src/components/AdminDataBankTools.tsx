import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Download,
  History,
  Save,
  Trash2,
  X,
  Shield,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  SlidersHorizontal,
  FileSpreadsheet,
  MapPin,
  Globe,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { NavWarning } from '../types';
import { saveWarningEdit } from '../services/warningEditApi';
import { fetchWarningAudit, WarningAuditRow } from '../services/warningAuditApi';
import { exportWarningAsGeoJSON, exportWarningAsKML, downloadFile } from '../utils/nauticalExport';

interface SavedView {
  name: string;
  navarea: string;
  status: string;
  tier: string;
  query: string;
}

const SAVED_VIEWS_KEY = 'helm_admin_saved_views';

function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface AdminDataBankToolsProps {
  warnings: NavWarning[];
  onRefresh: () => void;
}

export const AdminDataBankTools: React.FC<AdminDataBankToolsProps> = ({ warnings, onRefresh }) => {
  // Panel collapse/expand state (default: compact view to keep Data Bank visible)
  const [isExpanded, setIsExpanded] = useState(true);
  const [showInspector, setShowInspector] = useState(false);

  // Filters
  const [navareaFilter, setNavareaFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [query, setQuery] = useState('');

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [newViewName, setNewViewName] = useState('');
  useEffect(() => {
    setSavedViews(loadSavedViews());
  }, []);

  // Selection
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Bulk edit
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkTier, setBulkTier] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ message: string; ok: boolean } | null>(null);

  // Audit drawer
  const [auditWarning, setAuditWarning] = useState<NavWarning | null>(null);
  const [auditRows, setAuditRows] = useState<WarningAuditRow[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const navareas = useMemo(() => {
    const s = new Set<string>();
    warnings.forEach((w) => s.add(String(w.navarea || '')));
    return Array.from(s).filter(Boolean).sort();
  }, [warnings]);

  const nowMs = Date.now();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return warnings.filter((w: any) => {
      if (navareaFilter !== 'ALL' && String(w.navarea || '') !== navareaFilter) return false;
      if (statusFilter !== 'ALL' && String(w.status || '') !== statusFilter) return false;
      if (tierFilter !== 'ALL' && String(w.triage_tier || '').toUpperCase() !== tierFilter) return false;
      if (q) {
        const hay = `${w.warning_id || ''} ${w.source_warning_id || ''} ${w.area_text || ''} ${w.title || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [warnings, navareaFilter, statusFilter, tierFilter, query]);

  const staleWarnings = useMemo(
    () =>
      warnings.filter(
        (w: any) =>
          String(w.status || '').toLowerCase() === 'active' &&
          w.valid_to &&
          !isNaN(new Date(w.valid_to).getTime()) &&
          new Date(w.valid_to).getTime() < nowMs
      ),
    [warnings, nowMs]
  );

  const selectedWarnings = useMemo(
    () => filtered.filter((w: any) => checked.has(String(w.warning_id))),
    [filtered, checked]
  );

  const toggleChecked = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allChecked = filtered.length > 0 && filtered.every((w: any) => checked.has(String(w.warning_id)));
  const toggleAll = () => {
    setChecked((prev) => {
      if (allChecked) return new Set();
      const next = new Set(prev);
      filtered.forEach((w: any) => next.add(String(w.warning_id)));
      return next;
    });
  };

  const selectAllStale = () => {
    setChecked(new Set(staleWarnings.map((w: any) => String(w.warning_id))));
  };

  const clearSelection = () => {
    setChecked(new Set());
  };

  // ── Saved views ──
  const persistViews = (views: SavedView[]) => {
    setSavedViews(views);
    try {
      localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  };

  const saveCurrentView = () => {
    const name = newViewName.trim();
    if (!name) return;
    const views = loadSavedViews().filter((v) => v.name !== name);
    views.push({ name, navarea: navareaFilter, status: statusFilter, tier: tierFilter, query });
    persistViews(views);
    setNewViewName('');
  };

  const applyView = (v: SavedView) => {
    setNavareaFilter(v.navarea);
    setStatusFilter(v.status);
    setTierFilter(v.tier);
    setQuery(v.query);
  };

  const deleteView = (name: string) => {
    persistViews(loadSavedViews().filter((v) => v.name !== name));
  };

  // ── Bulk edit ──
  const runBulkEdit = async () => {
    if (!bulkStatus && !bulkTier) {
      setBulkResult({ message: 'Select a target status or tier to apply.', ok: false });
      return;
    }
    const targets = selectedWarnings;
    if (targets.length === 0) {
      setBulkResult({ message: 'No warnings selected. Check boxes below or click "Select Stale".', ok: false });
      return;
    }
    setBulkRunning(true);
    setBulkResult(null);
    let okCount = 0;
    const failures: string[] = [];
    for (const w of targets as any[]) {
      const patch: Record<string, unknown> = { note: bulkNote || 'Bulk admin edit (Data Bank tools)' };
      if (bulkStatus) patch.status = bulkStatus;
      if (bulkTier) patch.triage_tier = bulkTier;
      const res = await saveWarningEdit({
        warningId: w.db_uuid || undefined,
        canonicalId: w.warning_id,
        expectedUpdatedAt: w.updated_at ?? undefined,
        patch: patch as any,
      });
      if (res.ok) okCount++;
      else failures.push(`${w.warning_id}: ${res.error || 'failed'}`);
    }
    setBulkRunning(false);
    setChecked(new Set());
    const isSuccess = failures.length === 0;
    setBulkResult({
      message: `${okCount} of ${targets.length} warnings updated.` + (failures.length ? ' Failed: ' + failures.join(' | ') : ''),
      ok: isSuccess,
    });
    if (okCount > 0) onRefresh();
  };

  // ── Bulk export ──
  const exportTargets = selectedWarnings.length > 0 ? selectedWarnings : filtered;

  const exportAsCsv = () => {
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = ['warning_id', 'source_warning_id', 'navarea', 'status', 'triage_tier', 'categories', 'valid_from', 'valid_to', 'area_text'];
    const lines = [header.join(',')];
    exportTargets.forEach((w: any) => {
      lines.push([
        esc(w.warning_id),
        esc(w.source_warning_id),
        esc(w.navarea),
        esc(w.status),
        esc(w.triage_tier || ''),
        esc(Array.isArray(w.categories) ? w.categories.join(' ') : w.categories || ''),
        esc(w.valid_from || ''),
        esc(w.valid_to || ''),
        esc(w.area_text || ''),
      ].join(','));
    });
    downloadFile(lines.join('\n'), `helm-databank-${Date.now()}.csv`, 'text/csv;charset=utf-8');
  };

  const exportAsGeoJson = () => {
    const features: any[] = [];
    exportTargets.forEach((w) => {
      try {
        const fc = JSON.parse(exportWarningAsGeoJSON(w));
        if (Array.isArray(fc.features)) features.push(...fc.features);
      } catch {
        /* skip malformed warning */
      }
    });
    const collection = {
      type: 'FeatureCollection',
      metadata: { generated_by: 'Helm.Warning Admin Data Bank', exported_at: new Date().toISOString(), count: features.length },
      features,
    };
    downloadFile(JSON.stringify(collection, null, 2), `helm-databank-${Date.now()}.geojson`, 'application/geo+json');
  };

  const exportAsKml = () => {
    const placemarks: string[] = [];
    exportTargets.forEach((w) => {
      try {
        const kml = exportWarningAsKML(w);
        const matches = kml.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];
        placemarks.push(...matches);
      } catch {
        /* skip malformed warning */
      }
    });
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Helm.Warning Admin Data Bank Export (${exportTargets.length} warnings)</name>
    ${placemarks.join('\n')}
  </Document>
</kml>`;
    downloadFile(kml, `helm-databank-${Date.now()}.kml`, 'application/vnd.google-earth.kml+xml');
  };

  // ── Audit history ──
  const openAudit = useCallback(async (w: NavWarning) => {
    setAuditWarning(w);
    setAuditRows(null);
    setAuditError(null);
    setAuditLoading(true);
    const res = await fetchWarningAudit({
      warningId: (w as any).db_uuid || undefined,
      canonicalId: w.warning_id,
      limit: 100,
    });
    setAuditLoading(false);
    if (res.ok) setAuditRows(res.audits);
    else setAuditError(res.error || 'Audit lookup failed.');
  }, []);

  return (
    <div className="bg-canvas border border-hairline rounded-xl shadow-xs overflow-hidden transition-all text-xs">
      {/* Executive Header Bar */}
      <div className="bg-surface-subtle border-b border-hairline px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-surface border border-hairline flex items-center justify-center text-accent shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink-primary text-sm">Admin Operations &amp; Bulk Tools</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface border border-hairline text-ink-secondary font-medium">
                {warnings.length} in-force
              </span>
            </div>
            <p className="text-[11px] text-ink-tertiary">
              Audited batch modifications, compliance exports, and lifecycle state management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {checked.size > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent font-medium text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{checked.size} selected</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-input hover:border-hairline hover:bg-surface text-ink-secondary hover:text-ink-primary font-medium text-xs transition-colors cursor-pointer"
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Hide Tools' : 'Open Tools'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Stale Warning Action Banner */}
      {staleWarnings.length > 0 && (
        <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-amber-900">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold text-xs">{staleWarnings.length} Stale Warnings Active:</span>{' '}
              <span className="text-xs text-amber-800">
                Warnings past their <code className="font-mono text-[11px] bg-amber-100/80 px-1 py-0.5 rounded">valid_to</code> date requiring cancellation or expiration.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={selectAllStale}
              className="px-3 py-1.5 rounded-md border border-[var(--accent)] text-[var(--accent)] bg-transparent hover:bg-[var(--accent)]/10 font-medium text-xs transition-colors cursor-pointer"
            >
              Select All {staleWarnings.length} Stale
            </button>
          </div>
        </div>
      )}

      {/* Expanded Tools Workspace */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Row 1: Bulk Modification Controls */}
          <div className="bg-surface border border-hairline rounded-lg p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-accent" />
                <span className="font-medium text-xs text-ink-primary">
                  Bulk Actions {checked.size > 0 ? `(${checked.size} selected)` : '(0 selected)'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="px-3 py-1.5 rounded border border-border-input hover:bg-surface-subtle text-ink-secondary hover:text-ink-primary font-medium transition-colors cursor-pointer"
                >
                  {allChecked ? 'Deselect All' : `Select All Filtered (${filtered.length})`}
                </button>
                {checked.size > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="px-3 py-1.5 rounded border border-border-input hover:bg-surface-subtle text-ink-secondary hover:text-ink-primary font-medium transition-colors cursor-pointer"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="px-3 py-1.5 border border-border-input rounded-lg text-xs font-medium bg-canvas text-ink-primary focus:border-accent focus:outline-none min-h-[36px]"
              >
                <option value="">Set new status…</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
                <option value="unverified">Unverified</option>
              </select>

              <select
                value={bulkTier}
                onChange={(e) => setBulkTier(e.target.value)}
                className="px-3 py-1.5 border border-border-input rounded-lg text-xs font-medium bg-canvas text-ink-primary focus:border-accent focus:outline-none min-h-[36px]"
              >
                <option value="">Set triage tier…</option>
                <option value="B">Tier B (Rule-Parsed)</option>
                <option value="C">Tier C (Unstructured / General)</option>
              </select>

              <input
                type="text"
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                placeholder="Reason for bulk edit (required for audit log)..."
                className="px-3 py-1.5 border border-border-input rounded-lg text-xs bg-canvas text-ink-primary placeholder:text-ink-tertiary flex-1 min-w-[220px] focus:border-accent focus:outline-none min-h-[36px]"
              />

              <button
                type="button"
                onClick={runBulkEdit}
                disabled={bulkRunning || checked.size === 0}
                className="px-4 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1.5 min-h-[36px] cursor-pointer shrink-0"
              >
                {bulkRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{bulkRunning ? 'Applying Changes…' : `Apply to ${checked.size} Selected`}</span>
              </button>
            </div>

            {bulkResult && (
              <div
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
                  bulkResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <span>{bulkResult.message}</span>
              </div>
            )}
          </div>

          {/* Row 2: Export Suite & Saved Views */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Export Suite */}
            <div className="bg-surface border border-hairline rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs text-ink-primary">
                  Bulk Export ({exportTargets.length} warnings)
                </span>
                <span className="text-[11px] text-ink-tertiary">
                  {selectedWarnings.length > 0 ? 'Selected warnings' : 'Matching active filters'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportAsCsv}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-canvas border border-border-input hover:border-hairline hover:bg-surface-subtle rounded-lg text-xs font-medium text-ink-primary transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-accent" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={exportAsGeoJson}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-canvas border border-border-input hover:border-hairline hover:bg-surface-subtle rounded-lg text-xs font-medium text-ink-primary transition-colors cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-accent" />
                  <span>GeoJSON</span>
                </button>
                <button
                  type="button"
                  onClick={exportAsKml}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-canvas border border-border-input hover:border-hairline hover:bg-surface-subtle rounded-lg text-xs font-medium text-ink-primary transition-colors cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-accent" />
                  <span>KML</span>
                </button>
              </div>
            </div>

            {/* Saved Views */}
            <div className="bg-surface border border-hairline rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs text-ink-primary">Saved Filter Presets</span>
                <span className="text-[11px] text-ink-tertiary">{savedViews.length} views</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {savedViews.map((v) => (
                  <span
                    key={v.name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-subtle border border-hairline rounded-md text-[11px] text-ink-primary"
                  >
                    <button
                      type="button"
                      onClick={() => applyView(v)}
                      className="hover:text-accent font-medium cursor-pointer"
                      title={`NAVAREA: ${v.navarea}, Status: ${v.status}`}
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteView(v.name)}
                      aria-label={`Delete view ${v.name}`}
                      className="text-ink-tertiary hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1 ml-auto">
                  <input
                    type="text"
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    placeholder="New preset name..."
                    className="px-2 py-1 border border-border-input rounded-md text-[11px] bg-canvas text-ink-primary w-28 focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={saveCurrentView}
                    className="px-2 py-1 bg-canvas border border-border-input hover:bg-surface-subtle rounded-md text-[11px] font-medium text-ink-primary cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Toggleable Warning Selection Inspector */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowInspector(!showInspector)}
              className="flex items-center gap-2 text-xs font-medium text-accent hover:underline cursor-pointer"
            >
              <span>{showInspector ? '▼ Hide Selection Table & History Inspector' : '▶ Select Warnings from Table / Inspect Audit History'}</span>
              <span className="text-ink-tertiary">({filtered.length} matching criteria)</span>
            </button>

            {showInspector && (
              <div className="mt-3 border border-hairline rounded-lg overflow-hidden bg-surface">
                {/* Secondary Filters */}
                <div className="p-2.5 bg-surface-subtle border-b border-hairline flex flex-wrap items-center gap-2">
                  <select
                    value={navareaFilter}
                    onChange={(e) => setNavareaFilter(e.target.value)}
                    className="px-2 py-1 border border-border-input rounded text-xs bg-canvas text-ink-primary"
                  >
                    <option value="ALL">All NAVAREAs</option>
                    {navareas.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2 py-1 border border-border-input rounded text-xs bg-canvas text-ink-primary"
                  >
                    <option value="ALL">All statuses</option>
                    {['active', 'cancelled', 'expired', 'superseded', 'unverified'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="px-2 py-1 border border-border-input rounded text-xs bg-canvas text-ink-primary"
                  >
                    <option value="ALL">All tiers</option>
                    {['A', 'B', 'C'].map((t) => (
                      <option key={t} value={t}>Tier {t}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search in inspector..."
                    className="px-2 py-1 border border-border-input rounded text-xs bg-canvas text-ink-primary flex-1 min-w-[140px]"
                  />
                </div>

                <div className="max-h-60 overflow-x-auto overflow-y-auto">
                  <table className="w-full text-xs min-w-[620px]">
                    <thead className="bg-surface-subtle border-b border-hairline sticky top-0">
                      <tr className="text-left text-[11px] font-medium text-ink-secondary">
                        <th className="px-3 py-2 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={toggleAll}
                            title="Select all"
                            className="rounded cursor-pointer"
                          />
                        </th>
                        <th className="px-3 py-2">Warning</th>
                        <th className="px-3 py-2">NAVAREA</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Tier</th>
                        <th className="px-3 py-2">Valid To</th>
                        <th className="px-3 py-2 text-right">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-ink-secondary">
                            No warnings match inspector criteria.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((w: any) => {
                          const wid = String(w.canonical_id || w.warning_id || w.id);
                          const isChecked = checked.has(String(w.warning_id));
                          return (
                            <tr key={wid} className={`hover:bg-surface-subtle transition-colors ${isChecked ? 'bg-accent/5' : ''}`}>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleChecked(String(w.warning_id))}
                                  className="rounded cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-2 font-medium text-ink-primary truncate max-w-[200px]" title={wid}>
                                {w.source_warning_id || wid}
                              </td>
                              <td className="px-3 py-2 text-ink-secondary">{w.navarea}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                                    w.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : w.status === 'superseded'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {w.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-ink-secondary">
                                {w.triage_tier ? `Tier ${String(w.triage_tier).toUpperCase()}` : '—'}
                              </td>
                              <td className="px-3 py-2 text-ink-secondary">
                                {w.valid_to ? String(w.valid_to).slice(0, 10) : '—'}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => openAudit(w)}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline cursor-pointer"
                                >
                                  <History className="w-3 h-3" />
                                  <span>History</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Drawer / Modal */}
      {auditWarning && (
        <div className="border-t border-hairline bg-surface-subtle p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-ink-primary flex items-center gap-2">
              <History className="w-4 h-4 text-accent" />
              <span>Audit Trail: {String((auditWarning as any).source_warning_id || auditWarning.warning_id)}</span>
            </div>
            <button
              type="button"
              onClick={() => setAuditWarning(null)}
              aria-label="Close audit history"
              className="p-1 rounded-md text-ink-tertiary hover:text-ink-primary hover:bg-surface cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {auditLoading && (
            <div className="flex items-center gap-2 text-xs text-ink-secondary py-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Fetching cryptographic audit rows from Supabase...</span>
            </div>
          )}
          {auditError && <div className="text-xs text-rose-700 py-2">{auditError}</div>}
          {auditRows && auditRows.length === 0 && (
            <div className="text-xs text-ink-tertiary py-3">No audit rows recorded for this warning record.</div>
          )}
          {auditRows && auditRows.length > 0 && (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {auditRows.map((row: any, i) => (
                <li
                  key={row.audit_id || i}
                  className="border border-hairline rounded-lg p-2.5 bg-surface text-xs space-y-1"
                >
                  <div className="flex items-center gap-2 flex-wrap justify-between">
                    <span className="font-semibold text-ink-primary uppercase tracking-wide text-[11px]">
                      {row.action}
                    </span>
                    {row.previous_tier && row.new_tier && (
                      <span className="text-[11px] text-ink-secondary">
                        Tier {String(row.previous_tier).toUpperCase()} → {String(row.new_tier).toUpperCase()}
                      </span>
                    )}
                    <span className="text-[10px] text-ink-tertiary">
                      {row.created_at ? String(row.created_at).replace('T', ' ').slice(0, 19) + ' UTC' : ''}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-secondary">
                    Operator: <span className="font-medium text-ink-primary">{row.operator_id}</span>
                    {row.reason ? ` — Note: ${row.reason}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
