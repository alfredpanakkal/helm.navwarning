import React, { useState } from 'react';
import { NavWarning } from '../types';
import { Database, AlertTriangle, Layers, MapPin, Filter, Download, Search } from 'lucide-react';
import { formatSpatialCoordinates } from '../utils/coordinateParser';

interface DataBankProps {
  warnings: NavWarning[];
  onLocate: (warning: NavWarning) => void;
}

export const DataBank: React.FC<DataBankProps> = ({ warnings, onLocate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const activeCount = warnings.filter(w => w.status === 'active').length;
  
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gw-accent shrink-0">
            <path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>
          </svg>
          <input 
            type="text" 
            placeholder="Search records..." 
            className="bg-transparent border-none outline-none text-xs sm:text-sm w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <div className="relative flex items-center">
            <select className="w-full appearance-none bg-gw-bg border border-gw-secondary rounded pl-2.5 pr-7 py-2 text-xs cursor-pointer outline-none focus:border-gw-primary min-h-[38px]">
              <option>All NAVAREAs</option>
              <option>NAVAREA I</option>
              <option>NAVAREA II</option>
              <option>NAVAREA XI</option>
            </select>
            <div className="absolute right-2.5 w-1.5 h-1.5 border-r-2 border-b-2 border-gw-primary rotate-45 pointer-events-none"></div>
          </div>
          
          <div className="relative flex items-center">
            <select className="w-full appearance-none bg-gw-bg border border-gw-secondary rounded pl-2.5 pr-7 py-2 text-xs cursor-pointer outline-none focus:border-gw-primary min-h-[38px]">
              <option>All Severities</option>
              <option>Critical</option>
              <option>High</option>
            </select>
            <div className="absolute right-2.5 w-1.5 h-1.5 border-r-2 border-b-2 border-gw-primary rotate-45 pointer-events-none"></div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none items-center">
            <select className="w-full appearance-none bg-gw-bg border border-gw-secondary rounded pl-2.5 pr-7 py-2 text-xs cursor-pointer outline-none focus:border-gw-primary min-h-[38px]">
              <option>All Status</option>
              <option>Active</option>
              <option>Expiring</option>
            </select>
            <div className="absolute right-2.5 w-1.5 h-1.5 border-r-2 border-b-2 border-gw-primary rotate-45 pointer-events-none"></div>
          </div>
          
          <button className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gw-bg border border-gw-secondary rounded text-xs font-bold uppercase hover:bg-gw-primary hover:border-gw-primary hover:text-gw-bg transition-colors min-h-[38px]">
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filters</span>
          </button>
          <button className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gw-bg border border-gw-secondary rounded text-xs font-bold uppercase hover:bg-gw-primary hover:border-gw-primary hover:text-gw-bg transition-colors min-h-[38px]">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Empty State Banner */}
      {warnings.length === 0 && (
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
        {warnings.map((w, idx) => (
          <div 
            key={idx}
            onClick={() => onLocate(w)}
            className="p-4 bg-white border-2 border-gw-primary rounded-xl shadow-hard transition-all active:scale-[0.99]"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-xs">{w.source_warning_id}</span>
              <span className="inline-flex items-center px-2 py-0.5 bg-gw-bg border border-gw-secondary rounded text-[10px] font-bold">
                NA {w.navarea}
              </span>
            </div>
            <div className="text-xs font-bold mb-2 line-clamp-2 leading-snug">{w.issued_text}</div>
            <div className="flex flex-wrap items-center justify-between text-[11px] text-gw-accent pt-2 border-t border-gw-secondary gap-2">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{w.issued_date}</span>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${w.extraction_confidence === 1 ? 'bg-gw-primary' : 'bg-gw-tertiary'}`}>
                  {w.extraction_confidence === 1 ? 'HIGH CONF' : 'MOD CONF'}
                </span>
                <span className="flex items-center gap-1 font-bold uppercase text-[10px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${w.status === 'active' ? 'bg-green-600' : 'bg-amber-600'}`}></span>
                  {w.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop / Tablet Grid Table (hidden on mobile < md) */}
      <div className="hidden md:block bg-white border-2 border-gw-primary rounded-2xl overflow-hidden overflow-x-auto">
        <div className="min-w-[900px] grid grid-cols-[140px_80px_1fr_90px_130px_110px_90px_60px] p-3.5 bg-gw-primary text-gw-bg text-[10px] font-bold tracking-widest uppercase gap-3">
          <div>ID</div><div>AREA</div><div>TITLE</div><div>SEVERITY</div><div>COORDS</div><div>ISSUED</div><div>STATUS</div><div className="sticky right-0 bg-gw-primary text-right pr-2">ACTION</div>
        </div>
        <div className="min-w-[900px] max-h-[520px] overflow-y-auto no-scrollbar">
          {warnings.map((w, idx) => (
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
