import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Download, History, Save, Trash2, X } from 'lucide-react';
import { NavWarning } from '../types';
import { saveWarningEdit } from '../services/warningEditApi';
import { fetchWarningAudit, WarningAuditRow } from '../services/warningAuditApi';
import { exportWarningAsGeoJSON, exportWarningAsKML, downloadFile } from '../utils/nauticalExport';

/**
 * Phase E4 — Admin Data Bank Power Tools.
 *
 * Self-contained admin panel rendered above the Data Bank warning list:
 *  - Stale-warning banner (active warnings past their valid_to)
 *  - Filter row + saved views (localStorage)
 *  - Bulk edit (status/tier) through the E1 admin-guarded endpoint
 *  - Bulk export CSV / GeoJSON / KML via utils/nauticalExport.ts
 *  - Per-warning audit history (nav_warning_audits via /api/admin/warning-audit)
 *
 * Every write goes through saveWarningEdit → /api/admin/warning-edit.
 */

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
  const [bulkResult, setBulkResult] = useState<string | null>(null);

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
      setBulkResult('Choose a status or a tier to apply.');
      return;
    }
    const targets = selectedWarnings;
    if (targets.length === 0) {
      setBulkResult('No warnings selected.');
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
    setBulkResult(
      `${okCount}/${targets.length} updated.` + (failures.length ? ' Failed: ' + failures.join(' | ') : '')
    );
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
    <div className="border-2 border-gw-primary rounded-xl bg-white shadow-hard overflow-hidden text-xs">
      {/* Header */}
      <div className="bg-gw-primary text-gw-bg px-3 py-2 flex items-center justify-between">
        <div className="font-bold uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4" />
          <span>Admin Data Bank Tools</span>
        </div>
        <span className="text-[10px] font-mono opacity-80">{filtered.length} filtered · {checked.size} selected</span>
      </div>

      {/* Stale-warning banner */}
      {staleWarnings.length > 0 && (
        <div className="bg-amber-100 border-b-2 border-amber-500 px-3 py-2 flex items-start gap-2 text-amber-900">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
          <div>
            <span className="font-bold uppercase">{staleWarnings.length} stale warning{staleWarnings.length > 1 ? 's' : ''}:</span>{' '}
            <span className="font-mono">
              {staleWarnings.slice(0, 5).map((w: any) => w.source_warning_id || w.warning_id).join(', ')}
              {staleWarnings.length > 5 ? ` +${staleWarnings.length - 5} more` : ''}
            </span>
            <span className="block text-[10px] text-amber-800 mt-0.5">
              Active but past valid_to — review and cancel/expire them via bulk edit below.
            </span>
          </div>
        </div>
      )}

      {/* Filter row + saved views */}
      <div className="p-3 border-b border-gw-secondary bg-gw-bg/40 flex flex-wrap items-center gap-2">
        <select value={navareaFilter} onChange={(e) => setNavareaFilter(e.target.value)} className="px-2 py-1 border border-gw-primary rounded text-[11px] font-mono font-bold bg-white">
          <option value="ALL">All NAVAREAs</option>
          {navareas.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2 py-1 border border-gw-primary rounded text-[11px] font-mono font-bold bg-white">
          <option value="ALL">All statuses</option>
          {['active', 'cancelled', 'expired', 'superseded', 'unverified'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="px-2 py-1 border border-gw-primary rounded text-[11px] font-mono font-bold bg-white">
          <option value="ALL">All tiers</option>
          {['A', 'B', 'C'].map((t) => (
            <option key={t} value={t}>Tier {t}</option>
          ))}
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search id / text..."
          className="px-2 py-1 border border-gw-primary rounded text-[11px] font-mono flex-1 min-w-[140px] bg-white"
        />

        {/* Saved views */}
        <div className="flex items-center gap-1 flex-wrap">
          {savedViews.map((v) => (
            <span key={v.name} className="inline-flex items-center gap-1 bg-white border border-gw-secondary rounded-full pl-2 pr-1 py-0.5">
              <button type="button" onClick={() => applyView(v)} className="text-[10px] font-bold uppercase hover:text-gw-primary" title={`Apply view: NAVAREA=${v.navarea} status=${v.status} tier=${v.tier}`}>
                {v.name}
              </button>
              <button type="button" onClick={() => deleteView(v.name)} aria-label={`Delete saved view ${v.name}`} className="text-gw-accent hover:text-red-600 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary" title="Delete saved view">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="view name"
            className="px-2 py-0.5 border border-gw-secondary rounded text-[10px] font-mono w-20 bg-white"
          />
          <button type="button" onClick={saveCurrentView} className="flex items-center gap-1 px-2 py-0.5 bg-gw-bg border border-gw-primary rounded text-[10px] font-bold uppercase hover:bg-gw-primary hover:text-gw-bg">
            <Save className="w-3 h-3" />
            <span>Save view</span>
          </button>
        </div>
      </div>

      {/* Bulk edit bar */}
      <div className="p-3 border-b border-gw-secondary bg-white flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase text-gw-accent">Bulk edit {checked.size > 0 ? `(${checked.size})` : ''}:</span>
        <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="px-2 py-1 border border-gw-secondary rounded text-[11px] font-mono bg-white">
          <option value="">status…</option>
          {['active', 'cancelled', 'expired', 'unverified'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={bulkTier} onChange={(e) => setBulkTier(e.target.value)} className="px-2 py-1 border border-gw-secondary rounded text-[11px] font-mono bg-white">
          <option value="">tier…</option>
          {['B', 'C'].map((t) => (
            <option key={t} value={t}>Tier {t}</option>
          ))}
        </select>
        <input
          type="text"
          value={bulkNote}
          onChange={(e) => setBulkNote(e.target.value)}
          placeholder="audit note (reason for bulk edit)"
          className="px-2 py-1 border border-gw-secondary rounded text-[11px] font-mono flex-1 min-w-[160px] bg-white"
        />
        <button
          type="button"
          onClick={runBulkEdit}
          disabled={bulkRunning}
          className="px-3 py-1 bg-gw-primary text-gw-bg rounded text-[10px] font-bold uppercase hover:bg-gw-tertiary disabled:opacity-50"
        >
          {bulkRunning ? 'Applying…' : 'Apply to selected'}
        </button>
        {bulkResult && <span className="text-[10px] font-mono text-gw-primary max-w-full truncate" title={bulkResult}>{bulkResult}</span>}
      </div>

      {/* Export bar */}
      <div className="p-3 border-b border-gw-secondary bg-gw-bg/40 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase text-gw-accent">
          Export {selectedWarnings.length > 0 ? `${selectedWarnings.length} selected` : `${filtered.length} filtered`}:
        </span>
        <button type="button" onClick={exportAsCsv} className="flex items-center gap-1 px-2 py-1 bg-white border border-gw-primary rounded text-[10px] font-bold uppercase hover:bg-gw-primary hover:text-gw-bg">
          <Download className="w-3 h-3" /> CSV
        </button>
        <button type="button" onClick={exportAsGeoJson} className="flex items-center gap-1 px-2 py-1 bg-white border border-gw-primary rounded text-[10px] font-bold uppercase hover:bg-gw-primary hover:text-gw-bg">
          <Download className="w-3 h-3" /> GeoJSON
        </button>
        <button type="button" onClick={exportAsKml} className="flex items-center gap-1 px-2 py-1 bg-white border border-gw-primary rounded text-[10px] font-bold uppercase hover:bg-gw-primary hover:text-gw-bg">
          <Download className="w-3 h-3" /> KML
        </button>
      </div>

      {/* Selection table */}
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-[11px] font-mono">
          <thead className="bg-gw-bg border-b border-gw-secondary sticky top-0">
            <tr className="text-left text-[10px] uppercase text-gw-accent">
              <th className="px-2 py-1.5 w-8">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} title="Select all filtered" />
              </th>
              <th className="px-2 py-1.5">Warning</th>
              <th className="px-2 py-1.5">NAVAREA</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Tier</th>
              <th className="px-2 py-1.5">Valid to</th>
              <th className="px-2 py-1.5">Audit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-gw-accent">No warnings match the current filters.</td>
              </tr>
            )}
            {filtered.map((w: any) => (
              <tr key={w.warning_id} className="border-b border-gw-secondary/50 hover:bg-gw-bg/60">
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={checked.has(String(w.warning_id))}
                    onChange={() => toggleChecked(String(w.warning_id))}
                  />
                </td>
                <td className="px-2 py-1.5 font-bold text-gw-primary truncate max-w-[220px]" title={w.warning_id}>
                  {w.source_warning_id || w.warning_id}
                </td>
                <td className="px-2 py-1.5">{w.navarea}</td>
                <td className="px-2 py-1.5">
                  <span className={
                    w.status === 'active' ? 'text-emerald-700 font-bold' :
                    w.status === 'superseded' ? 'text-slate-500' : 'text-amber-700'
                  }>{w.status}</span>
                </td>
                <td className="px-2 py-1.5">{w.triage_tier ? 'Tier ' + String(w.triage_tier).toUpperCase() : '—'}</td>
                <td className="px-2 py-1.5">{w.valid_to ? String(w.valid_to).slice(0, 10) : '—'}</td>
                <td className="px-2 py-1.5">
                  <button type="button" onClick={() => openAudit(w)} className="flex items-center gap-1 text-[10px] font-bold uppercase text-gw-accent hover:text-gw-primary">
                    <History className="w-3 h-3" />
                    <span>History</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit drawer */}
      {auditWarning && (
        <div className="border-t-2 border-gw-primary bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold uppercase text-gw-primary flex items-center gap-2">
              <History className="w-4 h-4" />
              Audit history: {String((auditWarning as any).source_warning_id || auditWarning.warning_id)}
            </div>
            <button type="button" onClick={() => setAuditWarning(null)} aria-label="Close audit history" className="text-gw-accent hover:text-gw-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
          {auditLoading && <div className="text-[11px] text-gw-accent font-mono">Loading audit rows…</div>}
          {auditError && <div className="text-[11px] text-red-700 font-mono">{auditError}</div>}
          {auditRows && auditRows.length === 0 && (
            <div className="text-[11px] text-gw-accent font-mono">No audit rows recorded for this warning.</div>
          )}
          {auditRows && auditRows.length > 0 && (
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {auditRows.map((row: any, i) => (
                <li key={row.audit_id || i} className="border border-gw-secondary rounded px-2 py-1 bg-gw-bg/40 font-mono text-[10px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gw-primary">{row.action}</span>
                    {row.previous_tier && row.new_tier && (
                      <span className="text-gw-accent">tier {String(row.previous_tier).toUpperCase()} → {String(row.new_tier).toUpperCase()}</span>
                    )}
                    <span className="text-gw-accent ml-auto">{row.created_at ? String(row.created_at).replace('T', ' ').slice(0, 19) + 'Z' : ''}</span>
                  </div>
                  <div className="text-gw-accent">by {row.operator_id}{row.reason ? ' — ' + row.reason : ''}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
