import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Copy, Trash2, ArrowDown, Play, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, CornerDownLeft } from 'lucide-react';

export interface ConsoleLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'fetch' | 'parser' | 'supabase' | 'success' | 'warn' | 'error' | 'cmd';
  message: string;
  details?: string | object;
}

interface PipelineConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ConsoleLogEntry[];
  onTriggerRefresh: (sourceId?: string) => Promise<void>;
  isRefreshing: boolean;
  onClearLogs: () => void;
}

export const PipelineConsoleModal: React.FC<PipelineConsoleModalProps> = ({
  isOpen,
  onClose,
  logs,
  onTriggerRefresh,
  isRefreshing,
  onClearLogs,
}) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new log items arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  if (!isOpen) return null;

  const handleCopyLogs = () => {
    const logText = logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(logText);
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    setCommandHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setCommandInput('');

    const lower = cmd.toLowerCase();
    if (lower === 'clear') {
      onClearLogs();
      return;
    }
    if (lower === 'refresh' || lower === 'run' || lower === 'start') {
      onTriggerRefresh();
      return;
    }
    if (lower === 'help') {
      return;
    }
  };

  const renderLevelBadge = (level: ConsoleLogEntry['level']) => {
    switch (level) {
      case 'info':
        return <span className="bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-cyan-800/60">SYS</span>;
      case 'fetch':
        return <span className="bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-800/60">FETCH</span>;
      case 'parser':
        return <span className="bg-purple-950 text-purple-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-purple-800/60">PARSE</span>;
      case 'supabase':
        return <span className="bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-emerald-800/60">SUPABASE</span>;
      case 'success':
        return <span className="bg-green-950 text-green-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-green-800/60">SUCCESS</span>;
      case 'warn':
        return <span className="bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-800/60">WARN</span>;
      case 'error':
        return <span className="bg-red-950 text-red-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-800/60">ERROR</span>;
      case 'cmd':
        return <span className="bg-zinc-800 text-yellow-300 px-1.5 py-0.5 rounded text-[10px] font-bold border border-zinc-700">USER</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-[#0b0d10] text-emerald-400 border border-emerald-500/40 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden font-mono text-xs sm:text-sm">
        
        {/* Terminal Header Bar */}
        <div className="bg-[#12161f] border-b border-emerald-500/30 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block"></span>
            </div>
            <div className="h-4 w-[1px] bg-emerald-500/20"></div>
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="tracking-wide">NAVWARN-CLI v2.4.0</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-mono">
                {isRefreshing ? 'PIPELINE_RUNNING' : 'IDLE'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onTriggerRefresh()}
              disabled={isRefreshing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all border ${
                isRefreshing
                  ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900 hover:text-emerald-200'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Running...' : 'Run Pipeline'}</span>
            </button>

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              title="Toggle Auto Scroll"
              className={`p-1.5 rounded border transition-colors ${
                autoScroll ? 'bg-emerald-950 border-emerald-700 text-emerald-300' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-slate-200'
              }`}
            >
              <ArrowDown className="w-4 h-4" />
            </button>

            <button
              onClick={handleCopyLogs}
              title="Copy All Logs"
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>

            <button
              onClick={onClearLogs}
              title="Clear Console"
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 bg-red-950/60 hover:bg-red-900 border border-red-800/60 text-red-300 rounded transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Console Log Scrollable Body */}
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#08090c] font-mono text-[11px] sm:text-xs leading-relaxed selection:bg-emerald-900 selection:text-emerald-100"
        >
          {logs.length === 0 ? (
            <div className="text-zinc-600 italic p-4 text-center">
              Terminal session started. Click <span className="text-emerald-400 font-bold">"Run Pipeline"</span> or type <span className="text-yellow-300 font-bold">refresh</span> below to trigger the ingestion pipeline.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 hover:bg-zinc-900/40 p-1 rounded transition-colors">
                <span className="text-zinc-500 text-[10px] shrink-0 font-mono select-none">
                  [{log.timestamp}]
                </span>
                <span className="shrink-0">{renderLevelBadge(log.level)}</span>
                <div className="flex-1 break-all">
                  <span
                    className={
                      log.level === 'error'
                        ? 'text-red-400 font-bold'
                        : log.level === 'warn'
                        ? 'text-amber-300'
                        : log.level === 'success'
                        ? 'text-emerald-300 font-bold'
                        : log.level === 'cmd'
                        ? 'text-yellow-300 font-bold'
                        : 'text-zinc-300'
                    }
                  >
                    {log.message}
                  </span>
                  {log.details && (
                    <pre className="mt-1 p-2 bg-zinc-950 border border-zinc-800 rounded text-[10px] text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))
          )}

          {isRefreshing && (
            <div className="flex items-center gap-2 text-emerald-400 animate-pulse pt-2 font-mono">
              <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
              <span>Pipeline scraper active... fetching endpoints and parsing spatial geometries...</span>
            </div>
          )}
        </div>

        {/* Interactive CLI Input Footer */}
        <form onSubmit={handleCommandSubmit} className="bg-[#12161f] border-t border-emerald-500/30 px-4 py-2.5 flex items-center gap-2">
          <span className="text-emerald-400 font-bold select-none">$</span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Type 'refresh', 'clear', or 'help'..."
            className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder:text-zinc-600 font-mono text-xs sm:text-sm"
          />
          <button type="submit" className="text-zinc-400 hover:text-emerald-400 p-1">
            <CornerDownLeft className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
