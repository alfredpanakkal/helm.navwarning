import React, { useState } from 'react';
import { NavWarning } from '../types';
import { EcdisFeatureEditor } from './EcdisFeatureEditor';
import { FileText, Sparkles, CheckCircle2, AlertTriangle, Copy, ArrowRight, Edit3, Database, RefreshCw } from 'lucide-react';
import { saveImportedWarningsToSupabase } from '../services/api';

interface ManualParserViewProps {
  onParseManual: (rawText: string, navarea: string, mode?: 'hybrid' | 'llm' | 'regex', aiModel?: string) => Promise<{ warning: NavWarning; ai_parsing_failed?: boolean; ai_error?: string | null }>;
  onSelectWarning: (warning: NavWarning) => void;
}

export const ManualParserView: React.FC<ManualParserViewProps> = ({
  onParseManual,
  onSelectWarning,
}) => {
  const [rawText, setRawText] = useState(
    `NAVAREA I 0145/26 NORTH SEA, FORTIES. DRILLING RIG 'VALARIS 122' ESTABLISHED IN POSITION 57-45.8N 001-12.4E. SAFETY ZONE 500 METRES RADIUS ESTABLISHED. ALL SHIPS KEEP CLEAR.`
  );
  const [navarea, setNavarea] = useState('I');
  const [parseMode, setParseMode] = useState<'hybrid' | 'llm' | 'regex'>('hybrid');
  const [aiModel, setAiModel] = useState<string>('gemini-3.1-flash-lite');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResults, setParsedResults] = useState<NavWarning[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavingToSupabase, setIsSavingToSupabase] = useState(false);
  const [supabaseSaveMsg, setSupabaseSaveMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [aiFallbackModal, setAiFallbackModal] = useState<{ active: boolean; error?: string | null } | null>(null);

  const handleSaveToSupabase = async (warnings: NavWarning[]) => {
    if (!warnings.length) return;
    setIsSavingToSupabase(true);
    setSupabaseSaveMsg(null);
    try {
      const res = await saveImportedWarningsToSupabase(warnings);
      if (res.success) {
        setSupabaseSaveMsg({
          success: true,
          text: `Saved ${res.insertedCount} warning(s) directly to Supabase nav_warnings table!`,
        });
      } else {
        setSupabaseSaveMsg({
          success: false,
          text: `Supabase save failed: ${res.error}`,
        });
      }
    } catch (err: any) {
      setSupabaseSaveMsg({
        success: false,
        text: `Error saving to Supabase: ${err.message}`,
      });
    } finally {
      setIsSavingToSupabase(false);
    }
  };

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setIsParsing(true);
    setErrorMsg(null);
    setSupabaseSaveMsg(null);
    setAiFallbackModal(null);
    try {
      const texts = rawText.split('---').map(t => t.trim()).filter(Boolean);
      const results: NavWarning[] = [];
      let anyAiFailed = false;
      let lastAiError: string | null = null;
      for (const t of texts) {
        const parsed = await onParseManual(t, navarea, parseMode, aiModel);
        results.push(parsed.warning);
        if (parsed.ai_parsing_failed) {
          anyAiFailed = true;
          lastAiError = parsed.ai_error || null;
        }
      }
      setParsedResults(results);

      if (anyAiFailed) {
        setAiFallbackModal({ active: true, error: lastAiError });
      }

      // Automatically save parsed warnings to Supabase
      setIsSavingToSupabase(true);
      const res = await saveImportedWarningsToSupabase(results);
      if (res.success) {
        setSupabaseSaveMsg({
          success: true,
          text: `Successfully parsed & automatically saved ${res.insertedCount} warning(s) to Supabase nav_warnings table!`,
        });
      } else {
        setSupabaseSaveMsg({
          success: false,
          text: `Parsed successfully, but Supabase auto-save failed: ${res.error}`,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse warning text');
    } finally {
      setIsParsing(false);
      setIsSavingToSupabase(false);
    }
  };


  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* AI Parsing Failed Pop-up Modal */}
      {aiFallbackModal?.active && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-amber-600 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gw-primary uppercase tracking-wider">
                  AI Parsing Failed — Switched to Hybrid
                </h3>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Primary AI extraction was unsuccessful. Automatically switched to hybrid parsing (deterministic regex + heuristic fallback) as second priority.
                </p>
              </div>
            </div>

            {aiFallbackModal.error && (
              <div className="bg-gw-bg p-3 rounded-xl border border-gw-secondary text-xs font-mono text-red-700 overflow-x-auto">
                Error details: {aiFallbackModal.error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setAiFallbackModal(null)}
                className="px-4 py-2 bg-gw-primary text-gw-bg text-xs font-bold rounded-xl hover:bg-gw-accent transition-colors"
              >
                Acknowledge & View Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="bg-white border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-gw-primary flex items-center gap-2 uppercase tracking-wider">
            <FileText className="w-5 h-5 text-gw-primary" />
            <span>Manual Warning Parser & Override Workflow</span>
          </h2>
          <p className="text-xs text-gw-accent mt-1 leading-relaxed">
            For unsupported sources, manual paste corrections, or personal route voyage updates. Enforces deterministic regex extraction with optional server-side LLM assistance.
          </p>
        </div>

        <div className="text-xs font-mono font-bold bg-gw-bg text-gw-primary px-4 py-2 rounded-xl border border-gw-primary uppercase">
          Fallback mode: <span className="font-bold text-green-700">Enabled</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <form onSubmit={handleParse} className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gw-primary uppercase tracking-wider">Target NAVAREA</label>
              <select
                value={navarea}
                onChange={(e) => setNavarea(e.target.value)}
                className="bg-gw-bg border-2 border-gw-primary text-gw-primary text-xs px-3 py-1.5 rounded font-mono font-bold focus:outline-none focus:border-gw-accent transition-colors"
              >
                {['I', 'Baltic', 'II', 'III', 'IV', 'XII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'].map((a) => (
                  <option key={a} value={a}>
                    NAVAREA {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gw-primary uppercase tracking-wider">Engine</label>
              <select
                value={parseMode}
                onChange={(e) => setParseMode(e.target.value as any)}
                className="bg-gw-bg border-2 border-gw-primary text-gw-primary text-xs px-3 py-1.5 rounded font-mono font-bold focus:outline-none focus:border-gw-accent transition-colors"
              >
                <option value="hybrid">✨ Hybrid</option>
                <option value="llm">🤖 AI Direct</option>
                <option value="regex">⚡ Regex Only</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gw-primary uppercase tracking-wider">AI Model</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="bg-gw-bg border-2 border-gw-primary text-gw-primary text-xs px-3 py-1.5 rounded font-mono font-bold focus:outline-none focus:border-gw-accent transition-colors"
                disabled={parseMode === 'regex'}
              >
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Fast/Recommended)</option>
                <option value="gemini-flash-latest">Gemini Flash Latest</option>
                <option value="gemini-3.8-flash">Gemini 3.8 Flash (Stable)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gw-primary uppercase tracking-wider">Paste Unstructured Warning Text</label>
            <textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw navigational warning message(s). Separate multiple warnings with '---'..."
              className="w-full bg-gw-bg border-2 border-gw-primary text-gw-primary text-xs p-3 rounded font-mono font-medium focus:outline-none focus:border-gw-accent transition-colors leading-relaxed"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border-2 border-red-500 rounded text-xs font-bold font-mono text-red-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() =>
                setRawText(
                  `NAVAREA III 0102/26 WESTERN MEDITERRANEAN SEA. GUNNERY EXERCISES 150000 UTC TO 182359 UTC SEP IN AREA BOUNDED BY 37-12N 009-45E, 37-25N 010-10E, 37-05N 010-20E. SHIPS TO KEEP SAFE DISTANCE.\n---\nNAVAREA III 0103/26 EASTERN MEDITERRANEAN. CABLE LAYING OPERATIONS BY C/S DEPENDABLE FROM 20 SEP TO 30 SEP ALONG TRACK: 34-10N 032-15E TO 33-50N 033-05E. 1NM BERTH REQUESTED.`
                )
              }
              className="text-xs text-gw-accent hover:text-gw-primary transition-colors underline font-mono font-bold uppercase text-left"
            >
              Load Sample Bulk Text
            </button>

            <button
              type="submit"
              disabled={isParsing}
              className="flex items-center justify-center gap-2 bg-gw-primary hover:bg-gw-accent text-gw-secondary font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded transition-all disabled:opacity-50 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isParsing ? 'Parsing & Extracting...' : 'Parse & Extract Geometry'}</span>
            </button>
          </div>
        </form>

        {/* Extracted Output Result */}
        <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm">
          {supabaseSaveMsg && (
            <div
              className={`p-3 rounded-lg text-xs font-bold flex items-center justify-between ${
                supabaseSaveMsg.success
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-400'
                  : 'bg-red-50 text-red-900 border border-red-400'
              }`}
            >
              <span>{supabaseSaveMsg.text}</span>
              <button
                onClick={() => setSupabaseSaveMsg(null)}
                className="text-[11px] uppercase hover:underline ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {parsedResults.length > 0 ? (
            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {parsedResults.map((parsedResult, idx) => (
                <div key={parsedResult.source_warning_id || idx} className="space-y-4 bg-gw-bg p-4 rounded-xl border-2 border-gw-primary">
                  <div className="flex items-center justify-between border-b-2 border-gw-primary pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <div>
                        <h3 className="text-sm font-bold text-gw-primary font-mono">{parsedResult.source_warning_id}</h3>
                        <p className="text-[11px] text-gw-accent">Extracted Navigational Warning Record</p>
                      </div>
                    </div>

                    <span className="bg-gw-primary text-gw-secondary font-mono text-xs px-3 py-1 rounded font-bold uppercase">
                      {parsedResult.series}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-gw-accent uppercase font-bold text-[10px]">Affected Area:</span>
                      <div className="font-bold text-gw-primary mt-0.5">{parsedResult.area_text}</div>
                    </div>

                    <div>
                      <span className="text-gw-accent uppercase font-bold text-[10px]">Extraction Method:</span>
                      <div className="flex items-center gap-2 mt-0.5 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            parsedResult.extraction_method === 'llm_assisted'
                              ? 'bg-amber-100 text-amber-900 border border-amber-400'
                              : 'bg-green-100 text-green-900 border border-green-400'
                          }`}
                        >
                          {parsedResult.extraction_method === 'llm_assisted' ? 'LLM assisted' : 'Deterministic'}
                        </span>
                        {parsedResult.extraction_confidence && (
                          <span className="text-gw-accent font-bold">
                            Confidence: {(parsedResult.extraction_confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-gw-accent uppercase font-bold text-[10px]">IMO ECDIS Intermediate Layer (MSC.232 Manual Update):</span>
                      <div className="mt-2">
                        <EcdisFeatureEditor
                          warningId={parsedResult.source_warning_id || parsedResult.warning_id}
                          navarea={parsedResult.navarea}
                          rawText={parsedResult.raw_text}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <button
                      onClick={() => handleSaveToSupabase([parsedResult])}
                      disabled={isSavingToSupabase}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded transition-all flex items-center justify-center gap-2 shadow-sm"
                      title="Saves this warning directly to Supabase nav_warnings table"
                    >
                      {isSavingToSupabase ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4 text-emerald-200" />}
                      <span>Save to Supabase</span>
                    </button>

                    <button
                      onClick={() => onSelectWarning(parsedResult)}
                      className="flex-1 bg-gw-primary hover:bg-gw-accent text-gw-secondary font-bold text-xs uppercase tracking-wider py-2.5 rounded transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <span>Inspect in Bank & Map</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gw-accent text-xs font-bold uppercase tracking-wider space-y-2 my-auto">
              <FileText className="w-10 h-10 text-gw-primary opacity-30 mx-auto" />
              <div>Paste warning text on the left and click "Parse & Extract Geometry"</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
