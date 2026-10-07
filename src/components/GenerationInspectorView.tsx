import React from 'react';
import { IngestionGeneration, SourceRegistryItem } from '../types';
import { Activity, ShieldCheck, CheckCircle2, GitCommit, FileText, Layers, RefreshCw } from 'lucide-react';

interface GenerationInspectorViewProps {
  generations: IngestionGeneration[];
  sources: SourceRegistryItem[];
}

export const GenerationInspectorView: React.FC<GenerationInspectorViewProps> = ({ generations, sources }) => {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Title */}
      <div className="bg-white border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-gw-primary flex items-center gap-2 uppercase tracking-wider">
            <Activity className="w-5 h-5 text-gw-primary" />
            <span>Atomic Generation Pointer Inspector</span>
          </h2>
          <p className="text-xs text-gw-accent mt-1 leading-relaxed">
            Guarantees frontend never reads partially updated datasets during ingestion runs. Published pointer updates atomically on run verification.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold text-gw-primary bg-gw-bg px-4 py-2 rounded-xl border border-gw-primary uppercase">
          <GitCommit className="w-4 h-4 text-gw-primary shrink-0" />
          <span>Atomic Pointer Active</span>
        </div>
      </div>

      {/* Active Pointers Table */}
      <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b-2 border-gw-primary bg-gw-bg">
          <h3 className="text-sm font-bold text-gw-primary flex items-center gap-2 uppercase tracking-wider">
            <Layers className="w-4 h-4 text-gw-primary" />
            <span>Current Published Source Pointers</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gw-primary">
            <thead className="bg-gw-bg text-gw-accent font-mono uppercase text-[10px] border-b border-gw-secondary">
              <tr>
                <th className="py-3 px-4">Source ID</th>
                <th className="py-3 px-4">Publisher</th>
                <th className="py-3 px-4">Published Pointer (<code className="font-mono text-gw-primary">published_generation_id</code>)</th>
                <th className="py-3 px-4">Active Count</th>
                <th className="py-3 px-4">Last Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gw-secondary font-mono text-[11px]">
              {sources
                .filter((s) => s.published_generation_id)
                .map((src) => (
                  <tr key={src.source_id} className="hover:bg-gw-bg transition-colors">
                    <td className="py-3 px-4 font-bold text-gw-primary">{src.source_id}</td>
                    <td className="py-3 px-4 text-gw-primary">{src.publisher_name}</td>
                    <td className="py-3 px-4 text-green-700 font-bold">{src.published_generation_id}</td>
                    <td className="py-3 px-4 font-bold text-gw-primary">{src.health.active_warnings_count}</td>
                    <td className="py-3 px-4 text-gw-accent">{src.health.last_success_at?.replace('T', ' ').slice(0, 19)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ingestion Generation Log */}
      <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b-2 border-gw-primary bg-gw-bg">
          <h3 className="text-sm font-bold text-gw-primary flex items-center gap-2 uppercase tracking-wider">
            <Activity className="w-4 h-4 text-gw-primary" />
            <span>Immutable Ingestion Generation Log</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          {generations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-gw-bg border border-gw-primary text-gw-accent flex items-center justify-center mx-auto">
                <Activity className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-gw-primary uppercase tracking-wider">No Audit Generation Logs Found</div>
              <p className="text-xs text-gw-accent max-w-sm mx-auto">
                Run a source refresh from the Pipeline or Sources view to generate immutable audit pointer records.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-gw-primary">
              <thead className="bg-gw-bg text-gw-accent font-mono uppercase text-[10px] border-b border-gw-secondary">
                <tr>
                  <th className="py-3 px-4">Generation ID</th>
                  <th className="py-3 px-4">Source ID</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4">Parsed / Active</th>
                  <th className="py-3 px-4">Evidence Hash</th>
                  <th className="py-3 px-4">Completeness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gw-secondary font-mono text-[11px]">
                {generations.map((gen) => (
                  <tr key={gen.generation_id} className="hover:bg-gw-bg transition-colors">
                    <td className="py-3 px-4 font-bold text-gw-primary">{gen.generation_id}</td>
                    <td className="py-3 px-4 text-gw-primary font-bold">{gen.source_id}</td>
                    <td className="py-3 px-4 text-gw-accent">{gen.created_at.replace('T', ' ').slice(0, 19)}</td>
                    <td className="py-3 px-4 text-gw-primary font-bold">
                      {gen.parsed_count} / {gen.active_count}
                    </td>
                    <td className="py-3 px-4 text-gw-accent truncate max-w-[120px]" title={gen.evidence_hash}>
                      {gen.evidence_hash.slice(0, 16)}...
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase">
                        {gen.completeness_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
