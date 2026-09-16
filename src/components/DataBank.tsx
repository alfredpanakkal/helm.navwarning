import React, { useState } from 'react';
import { NavWarning } from '../types';
import { Database, AlertTriangle, Layers, MapPin, Filter, Download, Search, ChevronDown, ChevronUp, Locate, Calendar } from 'lucide-react';
import { formatSpatialCoordinates } from '../utils/coordinateParser';

interface DataBankProps {
  warnings: NavWarning[];
  onLocate: (warning: NavWarning) => void;
  onVerifyWarning?: (warningId: string) => void;
  initialStatusFilter?: string;
}

export const DataBank: React.FC<DataBankProps> = ({ warnings, onLocate, onVerifyWarning, initialStatusFilter = 'ALL' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNavArea, setSelectedNavArea] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState(initialStatusFilter);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredWarnings = warnings.filter(w => {
    if (selectedNavArea !== 'ALL' && w.navarea !== selectedNavArea) return false;
    if (selectedStatus !== 'ALL' && w.status !== selectedStatus.toLowerCase()) return false;
    if (selectedSeverity === 'critical' && w.extraction_confidence < 1) return false;
    if (selectedSeverity === 'high' && (w.extraction_confidence >= 1 || w.extraction_confidence < 0.8)) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchId = w.source_warning_id.toLowerCase().includes(q);
      const matchText = w.issued_text.toLowerCase().includes(q);
      const matchArea = `navarea ${w.navarea}`.toLowerCase().includes(q);
      const matchStatus = w.status.toLowerCase().includes(q);
      return matchId || matchText || matchArea || matchStatus;
    }

    return true;
  });

  const activeCount = warnings.filter(w => w.status === 'active').length;

  return (
    <div className="flex flex-col gap-6 sm:gap-8 font-mono">
      {/* Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
        <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all shadow-hard shadow-hard-hover">
          <div className="text-xs font-bold uppercase tracking-wider text-gw-accent mb-2 sm:mb-4 flex items-center gap-2">
            <div className="w-6 h-6 border border-gw-primary rounded flex items-center justify-center shrink-0">
              <Database className="w-3.5 h-3.5 text-gw-primary" />
            </div>
            Total Published
          </div>
          <div className="text-2xl sm:text-3xl md:text-[2.5rem] font-bold leading-none mb-2 sm:mb-3">3,847</div>
          <div className="text-[11px] sm:text-xs text-gw-accent flex gap-1">
            <span className="text-green-600 font-bold">↑ 24</span> vs. last 24h
          </div>
        </div>
        
        <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all shadow-hard shadow-hard-hover">
          <div className="text-xs font-bold uppercase tracking-wider text-gw-accent mb-2 sm:mb-4 flex items-center gap-2">
            <div className="w-6 h-6 border border-gw-primary rounded flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-gw-primary" />
            </div>
            Active Warnings
          </div>
          <div className="text-2xl sm:text-3xl md:text-[2.5rem] font-bold leading-none mb-2 sm:mb-3">{activeCount}</div>
          <div className="text-[11px] sm:text-xs text-gw-accent flex gap-1">
            <span className="text-green-600 font-bold">↑ 8</span> new this cycle
          </div>
        </div>
        
        <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all shadow-hard shadow-hard-hover">
          <div className="text-xs font-bold uppercase tracking-wider text-gw-accent mb-2 sm:mb-4 flex items-center gap-2">
            <div className="w-6 h-6 border border-gw-primary rounded flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5 text-gw-primary" />
            </div>
            Critical / High
          </div>
          <div className="text-2xl sm:text-3xl md:text-[2.5rem] font-bold leading-none mb-2 sm:mb-3">31</div>
          <div className="text-[11px] sm:text-xs text-gw-accent flex gap-1">
            <span className="text-red-600 font-bold">↓ 2</span> resolved
          </div>
        </div>
        
        <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all shadow-hard shadow-hard-hover">
          <div className="text-xs font-bold uppercase tracking-wider text-gw-accent mb-2 sm:mb-4 flex items-center gap-2">
            <div className="w-6 h-6 border border-gw-primary rounded flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5 text-gw-primary" />
            </div>
            NAVAREAs
          </div>
          <div className="text-2xl sm:text-3xl md:text-[2.5rem] font-bold leading-none mb-2 sm:mb-3">16/21</div>
          <div className="text-[11px] sm:text-xs text-gw-accent">76% global coverage</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white border-2 border-gw-primary rounded-xl">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-gw-bg border border-gw-secondary rounded px-3 py-2 focus-within:border-gw-primary">
          <Search className="w-4 h-4 text-gw-accent shrink-0" />
          <input 
            type="text" 
            placeholder="Search records by ID, text, area..." 
            className="bg-transparent border-none outline-none text-xs sm:text-sm w-full text-gw-primary placeholder:text-gw-accent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-xs text-gw-accent hover:text-gw-primary font-bold">
              ✕
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <div className="relative flex items-center">
            <select 
              value={selectedNavArea}
              onChange={(e) => setSelectedNavArea(e.target.value)}
              className="w-full appearance-none bg-gw-bg border border-gw-secondary rounded pl-2.5 pr-7 py-2 text-xs font-bold cursor-pointer outline-none focus:border-gw-primary min-h-[38px]"
            >
              <option value="ALL">All NAVAREAs</option>
              <option value="I">NAVAREA I</option>
              <option value="II">NAVAREA II</option>
              <option value="XI">NAVAREA XI</option>
            </select>
            <div className="absolute right-2.5 w-1.5 h-1.5 border-r-2 border-b-2 border-gw-primary rotate-45 pointer-events-none"></div>
          </div>
          
          <div className="relative flex items-center">
            <select 
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full appearance-none bg-gw-bg border border-gw-secondary rounded pl-2.5 pr-7 py-2 text-xs font-bold cursor-pointer outline-none focus:border-gw-primary min-h-[38px]"
            >
              <option value="ALL">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
            </select>
            <div className="absolute right-2.5 w-1.5 h-1.5 border-r-2 border-b-2 border-gw-primary rotate-45 pointer-events-none"></div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none items-center">
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full appearance-none bg-gw-bg border border-gw-secondary rounded pl-2.5 pr-7 py-2 text-xs font-bold cursor-pointer outline-none focus:border-gw-primary min-h-[38px]"
            >
              <option value="ALL">All Status</option>
              <option value="active">Active</option>
              <option value="expiring">Expiring</option>
            </select>
            <div className="absolute right-2.5 w-1.5 h-1.5 border-r-2 border-b-2 border-gw-primary rotate-45 pointer-events-none"></div>
          </div>
          
          <button 
            onClick={() => {
              setSearchTerm('');
              setSelectedNavArea('ALL');
              setSelectedSeverity('ALL');
              setSelectedStatus('ALL');
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gw-bg border border-gw-secondary rounded text-xs font-bold uppercase hover:bg-gw-primary hover:border-gw-primary hover:text-gw-bg transition-colors min-h-[38px]"
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Empty State Banner */}
      {filteredWarnings.length === 0 && (
        <div className="p-8 text-center bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-gw-bg border border-gw-primary text-gw-primary flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div className="text-xs font-bold text-gw-primary uppercase tracking-wider">No Navigational Warnings Found</div>
          <p className="text-xs text-gw-accent max-w-sm mx-auto">
            No active warnings match your search or filter criteria. Try clearing search filters, selecting a different NAVAREA, or running an ingestion cycle.
          </p>
        </div>
      )}

      {/* Mobile Card List (visible on mobile < md) */}
      <div className="block md:hidden space-y-3">
        {filteredWarnings.map((w, idx) => {
          const cardId = w.warning_id || w.source_warning_id || `card-${idx}`;
          const isExpanded = !!expandedCards[cardId];
          const isCritical = w.extraction_confidence === 1;

          return (
            <div 
              key={cardId}
              className="bg-white border-2 border-gw-primary rounded-xl overflow-hidden shadow-hard transition-all"
            >
              {/* Primary Visible Header */}
              <div className="p-3.5 flex items-center justify-between gap-2 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-xs text-gw-primary truncate">
                    {w.source_warning_id}
                  </span>

                  {/* Severity Badge */}
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white shrink-0 ${isCritical ? 'bg-gw-primary' : 'bg-gw-tertiary'}`}>
                    {isCritical ? 'CRITICAL' : 'HIGH'}
                  </span>
                </div>

                {/* Always Visible Actions: Verify, Locate & Expand */}
                <div className="flex items-center gap-1 shrink-0">
                  {onVerifyWarning && (w.status === 'unverified' || w.extraction_confidence < 1) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onVerifyWarning(w.warning_id);
                      }}
                      className="flex items-center gap-1 px-2 py-1.5 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase transition-colors hover:bg-emerald-700"
                      title="Quick Verify"
                    >
                      ✓ Verify
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLocate(w);
                    }}
                    className="flex items-center gap-1 px-2 py-1.5 bg-gw-primary text-gw-bg rounded text-[10px] font-bold uppercase transition-colors hover:bg-gw-accent"
                    title="Locate on Map"
                  >
                    <Locate className="w-3 h-3" />
                    <span>Locate</span>
                  </button>

                  <button
                    onClick={(e) => toggleExpand(cardId, e)}
                    className="p-1.5 bg-gw-bg border border-gw-secondary rounded text-gw-primary hover:bg-gw-primary hover:text-gw-bg transition-colors"
                    aria-label={isExpanded ? 'Collapse warning details' : 'Expand warning details'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Primary Short Text Preview */}
              <div className="px-3.5 pb-3 text-xs font-bold text-gw-primary line-clamp-2 leading-snug border-b border-gw-secondary/40">
                {w.issued_text}
              </div>

              {/* Expandable Secondary Metadata Panel */}
              {isExpanded && (
                <div className="p-3.5 bg-gw-bg/60 border-t border-gw-secondary space-y-3 text-xs animate-in fade-in duration-150">
                  {/* NAVAREA & Status Row */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-gw-accent block mb-0.5">NAVAREA Region</span>
                      <span className="font-bold text-gw-primary inline-block px-2 py-0.5 bg-white border border-gw-secondary rounded">
                        NAVAREA {w.navarea}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-gw-accent block mb-0.5">Status</span>
                      <span className="flex items-center gap-1.5 font-bold uppercase text-gw-primary mt-1">
                        <span className={`w-2 h-2 rounded-full ${w.status === 'active' ? 'bg-green-600' : 'bg-amber-600'}`}></span>
                        <span className={w.status === 'active' ? 'text-green-600' : 'text-amber-600'}>{w.status}</span>
                      </span>
                    </div>
                  </div>

                  {/* Coordinates & Issued Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[10px] font-bold uppercase text-gw-accent">Parsed Coordinates</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(formatSpatialCoordinates(w.spatial));
                          }}
                          className="text-[10px] text-gw-primary hover:text-gw-accent font-bold uppercase underline"
                        >
                          Copy Coords
                        </button>
                      </div>
                      <div className="font-bold text-gw-primary bg-white px-2 py-1 border border-gw-secondary rounded flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gw-accent shrink-0" />
                        <span className="truncate">{formatSpatialCoordinates(w.spatial)}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-gw-accent block mb-0.5">Issued Date</span>
                      <div className="font-bold text-gw-primary bg-white px-2 py-1 border border-gw-secondary rounded flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gw-accent shrink-0" />
                        <span>{w.issued_date}</span>
                      </div>
                    </div>
                  </div>

                  {/* Full Text Snippet */}
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] font-bold uppercase text-gw-accent">Full Raw Telemetry</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(w.raw_text || w.issued_text);
                        }}
                        className="text-[10px] text-gw-primary hover:text-gw-accent font-bold uppercase underline"
                      >
                        Copy Raw Telemetry
                      </button>
                    </div>
                    <div className="p-2.5 bg-white border border-gw-secondary rounded text-[11px] text-gw-primary font-mono leading-relaxed max-h-36 overflow-y-auto no-scrollbar">
                      {w.raw_text || w.issued_text}
                    </div>
                  </div>

                  {/* Confidence Score & Audit Info */}
                  <div className="flex justify-between items-center text-[10px] pt-1">
                    <span className="text-gw-accent font-bold">Extraction Confidence:</span>
                    <span className="font-bold text-gw-primary bg-white px-2 py-0.5 rounded border border-gw-secondary">
                      {(w.extraction_confidence * 100).toFixed(0)}% Match
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop / Tablet Grid Table (hidden on mobile < md) */}
      <div className="hidden md:block bg-white border-2 border-gw-primary rounded-2xl overflow-hidden overflow-x-auto">
        <div className="min-w-[900px] grid grid-cols-[140px_80px_1fr_90px_130px_110px_90px_60px] p-3.5 bg-gw-primary text-gw-bg text-[10px] font-bold tracking-widest uppercase gap-3">
          <div>ID</div><div>AREA</div><div>TITLE</div><div>SEVERITY</div><div>COORDS</div><div>ISSUED</div><div>STATUS</div><div className="sticky right-0 bg-gw-primary text-right pr-2">ACTION</div>
        </div>
        <div className="min-w-[900px] max-h-[520px] overflow-y-auto no-scrollbar">
          {filteredWarnings.map((w, idx) => (
            <div 
              key={idx} 
              className="grid grid-cols-[140px_80px_1fr_90px_130px_110px_90px_60px] p-3.5 border-b border-gw-secondary text-xs items-center gap-3 hover:bg-gw-bg transition-colors cursor-pointer group"
              onClick={() => onLocate(w)}
            >
              <div className="font-bold">{w.source_warning_id}</div>
              <div><span className="inline-flex items-center justify-center px-2 py-0.5 bg-gw-bg border border-gw-secondary rounded text-[10px] font-bold">NA {w.navarea}</span></div>
              <div className="truncate">{w.issued_text.substring(0, 60)}...</div>
              <div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${
                  w.extraction_confidence === 1 ? 'bg-gw-primary' : 'bg-gw-tertiary'
                }`}>
                  {w.extraction_confidence === 1 ? 'HIGH' : 'MOD'}
                </span>
              </div>
              <div className="text-[11px] text-gw-accent">
                {formatSpatialCoordinates(w.spatial)}
              </div>
              <div className="text-[11px] text-gw-accent">{w.issued_date}</div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase">
                <span className={`w-1.5 h-1.5 rounded-full ${w.status === 'active' ? 'bg-green-600' : 'bg-amber-600'}`}></span>
                <span className={w.status === 'active' ? 'text-green-600' : 'text-amber-600'}>{w.status}</span>
              </div>
              <div className="sticky right-0 bg-white group-hover:bg-gw-bg flex justify-end gap-1 pr-1 transition-colors">
                {onVerifyWarning && (w.status === 'unverified' || w.extraction_confidence < 1) && (
                  <button
                    aria-label={`Quick verify warning ${w.source_warning_id}`}
                    title="Quick Verify candidate (no edits needed)"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVerifyWarning(w.warning_id);
                    }}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    ✓ Verify
                  </button>
                )}
                <button 
                  aria-label={`Locate warning ${w.source_warning_id} on map`}
                  title={`Locate warning ${w.source_warning_id} on map`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onLocate(w);
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded border border-gw-secondary hover:bg-gw-primary hover:text-gw-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

