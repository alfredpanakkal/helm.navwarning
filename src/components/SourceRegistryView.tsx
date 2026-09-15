import React, { useState } from 'react';
import { SourceRegistryItem, NavAreaId } from '../types';
import {
  Radio,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  FileCheck,
  ExternalLink,
  ShieldCheck,
  Info,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface SourceRegistryViewProps {
  sources: SourceRegistryItem[];
  onToggleSource: (sourceId: string, enabled: boolean) => void;
  onTriggerRefresh: (sourceId: string) => void;
  isRefreshing: boolean;
}

export const SourceRegistryView: React.FC<SourceRegistryViewProps> = ({
  sources,
  onToggleSource,
  onTriggerRefresh,
  isRefreshing,
}) => {
  const [selectedSourceForChecklist, setSelectedSourceForChecklist] = useState<SourceRegistryItem | null>(null);

  const verifiedCount = sources.filter((s) => s.verification.status === 'verified').length;
  const unverifiedCount = sources.filter((s) => s.verification.status === 'unverified').length;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-gw-primary p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs text-gw-accent font-bold uppercase tracking-wider">Total NAVAREAs In Registry</div>
            <div className="text-2xl font-mono font-bold text-gw-primary mt-1">21</div>
            <div className="text-[11px] text-gw-accent mt-1">18 Candidates + 3 Under Investigation</div>
          </div>
          <Radio className="w-8 h-8 text-gw-primary opacity-30" />
        </div>

        <div className="bg-white border-2 border-gw-primary p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs text-gw-accent font-bold uppercase tracking-wider">Verified Endpoints</div>
            <div className="text-2xl font-mono font-bold text-green-700 mt-1">{verifiedCount}</div>
            <div className="text-[11px] text-green-800 font-bold mt-1">Active Ingestion Feeds</div>
          </div>
          <CheckCircle2 className="w-8 h-8 text-green-600 opacity-40" />
        </div>

        <div className="bg-white border-2 border-gw-primary p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs text-gw-accent font-bold uppercase tracking-wider">Unverified Coverage</div>
            <div className="text-2xl font-mono font-bold text-amber-700 mt-1">{unverifiedCount}</div>
            <div className="text-[11px] text-amber-800 font-bold mt-1">NAVAREA XIII, XX, XXI</div>
          </div>
          <AlertTriangle className="w-8 h-8 text-amber-500 opacity-40" />
        </div>

        <div className="bg-white border-2 border-gw-primary p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs text-gw-accent font-bold uppercase tracking-wider">Poll Cadence</div>
            <div className="text-2xl font-mono font-bold text-gw-primary mt-1">360 min</div>
            <div className="text-[11px] text-gw-accent mt-1">6-hour Polling Defaults</div>
          </div>
          <Clock className="w-8 h-8 text-gw-primary opacity-30" />
        </div>
      </div>

      {/* Registry Table */}
      <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b-2 border-gw-primary bg-gw-bg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gw-primary flex items-center gap-2 uppercase tracking-wider">
              <Radio className="w-5 h-5 text-gw-primary" />
              <span>NAVWARN Candidate Discovery Registry</span>
            </h2>
            <p className="text-xs text-gw-accent mt-0.5">
              Official maritime publication coordinators, endpoint verification status, and publication semantics.
            </p>
          </div>

          <div className="text-xs text-gw-primary bg-white px-3 py-1.5 rounded border border-gw-primary font-mono font-bold uppercase shrink-0">
            Status: <span className="text-green-700">18 of 21 NAVAREAs Scaffolded</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gw-primary">
            <thead className="bg-gw-bg text-gw-accent font-mono uppercase text-[10px] border-b border-gw-secondary">
              <tr>
                <th className="py-3 px-4">NAVAREA</th>
                <th className="py-3 px-4">Coordinator / Publisher</th>
                <th className="py-3 px-4">Semantics</th>
                <th className="py-3 px-4">Format</th>
                <th className="py-3 px-4">Poll Interval</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gw-secondary font-mono">
              {sources.map((src) => {
                const isVerified = src.verification.status === 'verified';
                return (
                  <tr key={src.source_id} className="hover:bg-gw-bg transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-gw-primary">
                      <div className="flex items-center gap-2">
                        <span className="bg-gw-primary text-gw-secondary px-2 py-0.5 rounded font-bold uppercase text-[11px]">
                          {src.navareas.join(', ')}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-gw-primary">{src.publisher_name}</div>
                      <a
                        href={src.discovery_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-gw-accent hover:text-gw-primary hover:underline flex items-center gap-1 mt-0.5 font-mono font-bold uppercase"
                      >
                        <span>{src.source_id}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>

                    <td className="py-3 px-4 text-[11px]">
                      <span className="bg-gw-bg text-gw-primary px-2 py-0.5 rounded border border-gw-primary font-bold uppercase">
                        {src.publication_semantics}
                      </span>
                    </td>

                    <td className="py-3 px-4 uppercase text-[11px]">
                      <span className="bg-gw-bg text-gw-primary px-2 py-0.5 rounded border border-gw-secondary font-bold">{src.format}</span>
                    </td>

                    <td className="py-3 px-4 text-[11px] text-gw-accent">
                      {src.poll_interval_minutes}m (stale {src.stale_after_minutes}m)
                    </td>

                    <td className="py-3 px-4">
                      {isVerified ? (
                        <div className="flex items-center gap-1.5 text-green-700 font-bold uppercase text-[11px]">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-700 font-bold uppercase text-[11px]">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>Unverified</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedSourceForChecklist(src)}
                          className="text-gw-primary hover:bg-gw-bg p-1.5 rounded border border-gw-secondary transition-colors"
                          title="View Onboarding Checklist"
                        >
                          <FileCheck className="w-4 h-4" />
                        </button>

                        {isVerified ? (
                          <button
                            onClick={() => onTriggerRefresh(src.source_id)}
                            disabled={isRefreshing}
                            className="flex items-center gap-1 bg-gw-primary hover:bg-gw-accent text-gw-secondary px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 shadow-sm"
                          >
                            <Play className="w-3 h-3" />
                            <span>Run Worker</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-gw-accent font-mono italic">Pending Onboarding</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboarding Checklist Modal */}
      {selectedSourceForChecklist && (
        <div className="fixed inset-0 z-50 bg-gw-primary/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2 border-b-2 border-gw-primary pb-3">
              <div>
                <span className="bg-gw-primary text-gw-secondary font-mono text-xs font-bold px-2.5 py-0.5 rounded uppercase">
                  NAVAREA {selectedSourceForChecklist.navareas.join(', ')}
                </span>
                <h3 className="text-base font-bold text-gw-primary mt-2 uppercase tracking-wider">Source Onboarding Checklist</h3>
                <p className="text-xs text-gw-accent mt-0.5 font-bold">{selectedSourceForChecklist.publisher_name}</p>
              </div>
              <button
                onClick={() => setSelectedSourceForChecklist(null)}
                className="text-gw-accent hover:text-gw-primary font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-gw-primary max-h-80 overflow-y-auto">
              <div className="p-3 bg-gw-bg rounded-lg border border-gw-primary flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-gw-primary uppercase text-[11px]">1. Official Publisher Identity</div>
                  <div className="text-gw-accent leading-relaxed mt-0.5">Confirmed authority (e.g. Hydrographic Office or official Coast Guard).</div>
                </div>
              </div>

              <div className="p-3 bg-gw-bg rounded-lg border border-gw-primary flex items-start gap-2.5">
                <Radio className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-gw-primary uppercase text-[11px]">2. Exact Publication Scope & Endpoint</div>
                  <div className="text-gw-accent mt-0.5">Discovery URL: <span className="font-mono text-gw-primary font-bold break-all">{selectedSourceForChecklist.discovery_url}</span></div>
                </div>
              </div>

              <div className="p-3 bg-gw-bg rounded-lg border border-gw-primary flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-gw-primary uppercase text-[11px]">3. In-Force Publication Semantics</div>
                  <div className="text-gw-accent mt-0.5">Configured mode: <span className="font-mono text-gw-primary font-bold">{selectedSourceForChecklist.publication_semantics}</span></div>
                </div>
              </div>

              <div className="p-3 bg-gw-bg rounded-lg border border-gw-primary flex items-start gap-2.5">
                <FileCheck className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-gw-primary uppercase text-[11px]">4. Saved Evidence Fixture & Parser Test</div>
                  <div className="text-gw-accent mt-0.5">Parser ID: <span className="font-mono text-gw-primary font-bold">{selectedSourceForChecklist.parser_id}</span></div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t-2 border-gw-primary flex justify-end">
              <button
                onClick={() => setSelectedSourceForChecklist(null)}
                className="bg-gw-primary hover:bg-gw-accent text-gw-secondary font-bold text-xs uppercase tracking-wider px-5 py-2 rounded transition-all shadow-sm"
              >
                Close Checklist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
