import React from 'react';
import { IngestionGeneration } from '../types';
import { Activity, ShieldCheck, CheckCircle2, Clock, Hash, Link as LinkIcon, FileCheck } from 'lucide-react';

interface GenerationsViewProps {
  generations: IngestionGeneration[];
}

export const GenerationsView: React.FC<GenerationsViewProps> = ({ generations }) => {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Overview Info */}
      <div className="bg-white border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-gw-primary flex items-center gap-2 uppercase tracking-wider">
            <Activity className="w-5 h-5 text-gw-primary" />
            <span>Ingestion Generation Audit Logs & Pointer History</span>
          </h2>
          <p className="text-xs text-gw-accent mt-1 leading-relaxed">
            Atomic pointer state updates preventing partial reads during scraper execution. Each generation refers to an immutable evidence payload hash.
          </p>
        </div>

        <div className="text-xs font-mono font-bold bg-gw-bg px-4 py-2 rounded-xl border border-gw-primary text-gw-primary">
          Total Generations: <strong className="text-gw-primary text-sm">{generations.length}</strong>
        </div>
      </div>

      {/* Generations Audit Table */}
      <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gw-primary">
            <thead className="bg-gw-bg text-gw-accent font-mono uppercase text-[10px] border-b-2 border-gw-primary">
              <tr>
                <th className="py-3 px-4">Generation ID</th>
                <th className="py-3 px-4">Source ID</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4">Semantics</th>
                <th className="py-3 px-4">Parsed / Active</th>
                <th className="py-3 px-4">Completeness</th>
                <th className="py-3 px-4">Evidence Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gw-secondary font-mono">
              {generations.map((gen) => (
                <tr key={gen.generation_id} className="hover:bg-gw-bg transition-colors">
                  <td className="py-3 px-4 font-bold text-gw-primary">{gen.generation_id}</td>

                  <td className="py-3 px-4 text-gw-primary font-bold">{gen.source_id}</td>

                  <td className="py-3 px-4 text-gw-accent">
                    {gen.created_at.replace('T', ' ').slice(0, 19)}
                  </td>

                  <td className="py-3 px-4 text-[11px]">
                    <span className="bg-gw-primary text-gw-secondary px-2 py-0.5 rounded font-bold uppercase">
                      {gen.publication_kind}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="text-gw-primary font-bold">{gen.parsed_count} parsed</span> /{' '}
                    <span className="text-green-700 font-bold">{gen.active_count} active</span>
                  </td>

                  <td className="py-3 px-4">
                    <div
                      className={`flex items-center gap-1 font-bold text-[11px] uppercase ${
                        gen.completeness_status === 'sync_failed' || gen.completeness_status === 'failed'
                          ? 'text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-300'
                          : 'text-green-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{gen.completeness_status}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-[11px] text-gw-accent">
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-gw-primary" />
                      <span className="truncate max-w-[120px] font-bold text-gw-primary" title={gen.evidence_hash}>
                        {gen.evidence_hash.slice(0, 14)}...
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
