import React, { useState } from 'react';
import { RawArtifact } from '../types';
import { Archive, ShieldCheck, FileText, Hash, Clock, HardDrive, Eye } from 'lucide-react';

interface EvidenceLockerViewProps {
  artifacts: RawArtifact[];
}

export const EvidenceLockerView: React.FC<EvidenceLockerViewProps> = ({ artifacts }) => {
  const [selectedArtifact, setSelectedArtifact] = useState<RawArtifact | null>(
    artifacts.length > 0 ? artifacts[0] : null
  );

  return (
    <div className="w-full space-y-6">
      {/* Title & Info */}
      <div className="bg-gw-panel border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-gw-primary flex items-center gap-2 uppercase tracking-wider">
            <Archive className="w-5 h-5 text-gw-primary" />
            <span>Private Object Storage Evidence Locker</span>
          </h2>
          <p className="text-xs text-gw-accent mt-1 leading-relaxed">
            Preserves raw unparsed source publications (<code className="bg-gw-bg px-1 py-0.5 rounded border border-gw-secondary font-mono">gs://navwarn-evidence/archive/...</code>) for 90 days for auditability and parser debugging.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-gw-primary bg-gw-bg px-4 py-2 rounded-xl border border-gw-primary">
          <HardDrive className="w-4 h-4 text-gw-primary" />
          <span>Artifact Count: <strong className="text-gw-primary font-mono text-sm">{artifacts.length}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Artifact List */}
        <div className="bg-gw-panel border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="text-xs font-bold text-gw-primary uppercase tracking-wider border-b-2 border-gw-primary pb-2">
            Stored Raw Artifacts
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {artifacts.length === 0 ? (
              <div className="py-8 text-center text-xs text-gw-accent space-y-1">
                <p className="font-medium text-gw-primary">No stored raw artifacts</p>
                <p>Ingestion pipeline captures will populate this evidence locker.</p>
              </div>
            ) : (
              artifacts.map((art) => {
                const isSelected = selectedArtifact?.artifact_id === art.artifact_id;
                return (
                  <div
                    key={art.artifact_id}
                    onClick={() => setSelectedArtifact(art)}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer text-xs space-y-1.5 ${
                      isSelected
                        ? 'bg-gw-bg border-gw-primary text-gw-primary shadow-sm'
                        : 'bg-gw-panel border-gw-secondary hover:border-gw-primary text-gw-primary'
                    }`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedArtifact(art);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-gw-primary">{art.source_id}</span>
                      <span className="text-[10px] bg-gw-primary text-gw-secondary px-2 py-0.5 rounded font-mono uppercase font-bold">{art.content_type.split('/')[1]}</span>
                    </div>

                    <div className="font-mono text-[11px] text-gw-accent truncate">{art.path}</div>

                    <div className="flex items-center justify-between text-[10px] text-gw-accent pt-1 border-t border-gw-secondary">
                      <span>{art.timestamp.replace('T', ' ').slice(0, 19)}</span>
                      <span className="font-bold">{art.size_bytes} bytes</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Artifact Inspector */}
        <div className="lg:col-span-2 bg-gw-panel border-2 border-gw-primary rounded-xl sm:rounded-2xl p-5 space-y-4 shadow-sm">
          {selectedArtifact ? (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-gw-primary pb-3">
                <div>
                  <div className="text-xs text-gw-accent font-bold uppercase tracking-wider">Object Storage Reference</div>
                  <h3 className="text-sm font-bold text-gw-primary font-mono mt-1 break-all">
                    {selectedArtifact.path}
                  </h3>
                </div>

                <div className="flex items-center gap-2 bg-green-100 text-green-800 border border-green-400 px-3 py-1 rounded text-xs font-mono font-bold shrink-0 uppercase">
                  <ShieldCheck className="w-4 h-4 text-green-700" />
                  <span>SHA-256 Verified</span>
                </div>
              </div>

              {/* Provenance Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-gw-bg p-3 rounded-lg border border-gw-primary font-mono">
                <div>
                  <div className="text-gw-accent text-[10px] uppercase font-bold">Source ID</div>
                  <div className="text-gw-primary font-bold">{selectedArtifact.source_id}</div>
                </div>
                <div>
                  <div className="text-gw-accent text-[10px] uppercase font-bold">Timestamp</div>
                  <div className="text-gw-primary">{selectedArtifact.timestamp}</div>
                </div>
                <div>
                  <div className="text-gw-accent text-[10px] uppercase font-bold">Content Hash (SHA-256)</div>
                  <div className="text-gw-primary font-bold truncate" title={selectedArtifact.content_hash}>
                    {selectedArtifact.content_hash.slice(0, 16)}...
                  </div>
                </div>
              </div>

              {/* Artifact Raw Content Viewer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-gw-primary uppercase tracking-wider">
                  <span>Captured Source Payload Preview</span>
                  <span className="font-mono text-[10px] text-gw-accent">{selectedArtifact.content_type}</span>
                </div>

                <pre className="bg-gw-primary text-gw-secondary p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed">
                  {selectedArtifact.full_content || selectedArtifact.preview_text}
                </pre>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gw-accent text-xs font-bold uppercase tracking-wider">
              Select an artifact from the list to inspect raw source evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
