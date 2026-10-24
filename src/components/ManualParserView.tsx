import React, { useState } from 'react';
import { NavWarning } from '../types';
import { EcdisFeatureEditor } from './EcdisFeatureEditor';
import {
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ArrowRight,
  Edit3,
  Database,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Anchor,
  Compass,
  Table as TableIcon,
  LayoutGrid,
  Eye,
  X,
  MapPin,
  Calendar,
  Layers,
} from 'lucide-react';
import { saveImportedWarningsToSupabase, parseJhodBatch } from '../services/api';
import { splitJhodTelexStream } from '../schemas/jhodAiContract';

export const JHOD_19_NOTICES_CORPUS = `NAVAREA XI
NO.26-0455 Date:2026/10/10 12 UTC

NAVAREA XI WARNING MESSAGES IN FORCE
101200Z OCT. ONLY THOSE MESSAGES ISSUED
DURING LAST SIX WEEKS ARE LISTED HEREIN.
0398 0400 0401 0408 0428 0430 0433 0448
0451 0453 0454/26.
THE COMPLETE TEXT OF ALL IN FORCE
NAVAREA XI WARNINGS ARE AVAILABLE FROM
THE JHOD WEBSITE "HTTPS://WWW1.KAIHO.
MLIT.GO.JP/JHD-E.HTML" (ONLY "E" OF
ADDRESSING IS A CAPITAL LETTER).
CANCEL 0443/26.


NO.26-0454 Date:2026/10/09 18 UTC

TSUNAMI INFORMATION.
PACIFIC OCEAN.
EARTHQUAKE, MAGNITUDE 7.6, OCCURRED
AT ABOUT 091756Z OCT IN 07.5N
080.8W, PACIFIC OCEAN.
TSUNAMI THREATENED TO OCCUR.
VESSELS COAST AREA REQUESTED TO
BECAUTION ADVISED.
CANCEL THIS MSG 111400Z OCT.


NO.26-0453 Date:2026/10/09 13 UTC

NORTH PACIFIC, MARSHALLS.
DERELICT BARGE ADRIFT IN VICINITY OF
05-05.79N 167-14.00E AT 090330Z OCT.
CANCEL 0449/26.
CANCEL THIS MSG 120330Z OCT.


NO.26-0451 Date:2026/10/09 07 UTC

NORTH PACIFIC, OKINOTORI SHIMA.
HATCH COVER, ABOUT 20 METRE IN SQUARE,
ADRIFT IN
16-54.1N 134-39.5E AT 090625Z OCT.
CANCEL 0450/26.
CANCEL THIS MSG 120625Z OCT.


NO.26-0448 Date:2026/10/08 03 UTC

TAIWAN STRAIT.
SUBMARINE CABLE REPAIRING WORKS BY
C/S ILE DE RE UNTIL FURTHER NOTICE.
IN VICINITY OF LINE JOINING
24-04.12N 118-46.48E
24-03.82N 118-46.95E
23-51.56N 119-01.84E
23-51.18N 119-02.22E.


NO.26-0433 Date:2026/09/28 00 UTC

NORTH PACIFIC, MARIANAS.
SUBMARINE CABLE RECOVERY WORKS BY
M/V ANIEK, 1008 TONS, UNTIL FURTHER
NOTICE.
IN VICINITY OF LINE JOINING
11-52N 146-04E 11-13N 146-59E
11-18N 147-29E 11-10N 147-39E.
CANCEL 0432/26.


NO.26-0430 Date:2026/09/26 12 UTC

NORTH PACIFIC, NANPO SHOTO.
GUNNERY. 2300Z TO 0900Z COMMENCING DAILY
30 SEP TO 30 OCT. AREA BOUNDED BY
28-15-15N 146-29-47E
25-25-16N 147-37-47E
25-00-16N 145-35-48E
27-55-15N 144-57-48E.
CANCEL THIS MSG 311000Z OCT.


NO.26-0428 Date:2026/09/25 12 UTC

SINGAPORE STRAIT.
SUBMARINE CABLE REPAIRING WORKS BY
C/V PETER FABER, 23 SEP TO UNTIL
FURTHER NOTICE. IN VICINITY OF
01-16.75N 104-08.14E.
CANCEL 0412/26 AND 0423/26.


NO.26-0408 Date:2026/09/13 14 UTC

JAVA SEA.
SUNKEN WRECK, EXISTS IN 04-32-31.8S
114-01-36.0E.


NO.26-0401 Date:2026/09/08 02 UTC

080200UTC ISSUED AT 080200UTC SEP 2026
VOLCANIC WARNING
VOLCANO NAME:NISHINO SHIMA
LOCATION:27-14.6N 140-52.7E INFLUENCE OF
ERUPTION IS EXPECTED WARNING WITHIN A
RADIUS OF 0.6 MILES.
CANCEL 0488/20.


NO.26-0400 Date:2026/09/07 20 UTC

NORTH PACIFIC, MARIANAS.
GUAM HF NAVTEX STATION, V,
13-29.0N 144-50.0E, OFF AIR.


NO.26-0398 Date:2026/09/07 12 UTC

NORTH PACIFIC, NANPO SHOTO.
CHICHI SHIMA, FUTAMI KO NR.3 LIGHT BUOY,
27-04.9N 142-11.2E, L.L. VOL 1. 3225,
EXTINGUISHED AND TEMPORARY LIGHT SET,
FL G 4 SEC.
CANCEL 0355/26.


NO.26-0387 Date:2026/08/24 10 UTC

PHILIPPINES.
APO ISLAND LIGHT, 09-04.98N 123-16.22E,
F2344, EXTINGUSHED.


NO.26-0386 Date:2026/08/24 03 UTC

JAVA SEA.
SUNKEN WRECK, EXISTS IN 04-14-42S
113-44-18E.


NO.26-0356 Date:2026/08/06 00 UTC

GULF OF THAILAND AND SOUTH CHINA SEA,
SOUTHERN PART.
SEISMIC SURVEY WORKS BY M/V PXGEO 2
TOWING EIGHT CABLES, EACH 5 MILE LONG.
UNTIL 31 DEC 2026. AREA BOUNDED BY
06-33N 103-25E 06-50N 102-58E
06-55N 103-14E 07-02N 103-04E
06-50N 102-21E 06-28N 102-09E
05-54N 103-01E.
CANCEL THIS MSG 01 JAN 2027.


NO.26-0328 Date:2026/07/21 12 UTC

NORTH PACIFIC, WEST CAROLINES.
MALAKAL HARBOR NR.1 LIGHTED BOUY,
07-19.17N 134-27.17E, MISSING.


NO.26-0322 Date:2026/07/16 18 UTC

NORTH PACIFIC, MARIANAS.
DISCOLOURED WATER REPORTED IN VICINITY
OF 20-26.0N 145-01.0E AT 160013Z JUL.
CANCEL 0020/24.


NO.26-0273 Date:2026/06/21 04 UTC

SINGAPORE STRAIT.
BATU BERHANTI ISOLATED DANGER MARKS
LIGHT BUOY, 01-11.76N 103-52.51E,
TEMPORARILY REMOVED.


NO.26-0034 Date:2026/01/27 09 UTC

SELAT MAKASAR.
SEISMIC SURVEY WORKS BY S/V RAMFORM
SOVEREIGN TOWING TWELVE CABLES, EACH
10050 METRE LONG. UNTIL FURTHER NOTICE.
AREA BOUNDED BY 00-10.3S 117-49.0E
00-10.3S 117-50.2E 00-52.5S 117-50.2E
01-30.6S 117-26.9E 01-33.7S 117-31.8E
01-44.2S 117-25.4E 01-50.3S 117-36.3E
01-55.3S 117-45.7E 01-23.4S 118-03.7E
01-20.8S 117-59.4E 01-16.5S 118-00.7E
01-16.5S 118-08.6E 01-33.6S 118-08.6E
01-33.6S 118-33.5E 00-47.9S 118-33.7E
00-48.0S 118-27.7E 00-14.0N 118-28.0E
00-14.0N 118-10.1E 00-31.9N 118-10.1E
00-32.0N 117-47.8E.`;

interface ManualParserViewProps {
  onParseManual: (
    rawText: string,
    navarea: string,
    mode?: 'hybrid' | 'llm' | 'regex' | 'jhod_structured',
    aiModel?: string
  ) => Promise<{ warning: NavWarning; ai_parsing_failed?: boolean; ai_error?: string | null; jhodOutput?: any }>;
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
  const [parseMode, setParseMode] = useState<'hybrid' | 'llm' | 'regex' | 'jhod_structured'>('hybrid');
  const [aiModel, setAiModel] = useState<string>('gemini-3.1-flash-lite');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResults, setParsedResults] = useState<NavWarning[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavingToSupabase, setIsSavingToSupabase] = useState(false);
  const [supabaseSaveMsg, setSupabaseSaveMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [aiFallbackModal, setAiFallbackModal] = useState<{ active: boolean; error?: string | null } | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [manifestSummary, setManifestSummary] = useState<any | null>(null);
  const [inspectedWarning, setInspectedWarning] = useState<NavWarning | null>(null);

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
    setManifestSummary(null);

    try {
      let results: NavWarning[] = [];
      let anyAiFailed = false;
      let lastAiError: string | null = null;

      const isMultiBlock = /NO\.\d{2}-\d{4}/i.test(rawText);

      if (parseMode !== 'regex' && (isMultiBlock || parseMode === 'jhod_structured')) {
        try {
          const batchRes = await parseJhodBatch(rawText, navarea, aiModel, true);
          results = batchRes.warnings;
          if (batchRes.manifestSummary) {
            setManifestSummary(batchRes.manifestSummary);
          }
          if (batchRes.fallbackCount > 0) {
            anyAiFailed = true;
            lastAiError = `${batchRes.fallbackCount} bulletin(s) triggered coordinate hallucination guard; deterministic fallback applied.`;
          }
        } catch (batchErr: any) {
          console.warn('Batch endpoint failed, using sequential parser:', batchErr);
          const blocks = splitJhodTelexStream(rawText);
          for (const t of blocks) {
            const parsed = await onParseManual(t, navarea, parseMode, aiModel);
            results.push(parsed.warning);
            if (parsed.ai_parsing_failed) {
              anyAiFailed = true;
              lastAiError = parsed.ai_error || null;
            }
          }
        }
      } else {
        const blocks = isMultiBlock
          ? splitJhodTelexStream(rawText)
          : rawText.split('---').map((t) => t.trim()).filter(Boolean);
        for (const t of blocks) {
          const parsed = await onParseManual(t, navarea, parseMode, aiModel);
          results.push(parsed.warning);
          if (parsed.ai_parsing_failed) {
            anyAiFailed = true;
            lastAiError = parsed.ai_error || null;
          }
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
                <option value="hybrid">✨ Auto (Rules First → Gemini)</option>
                <option value="jhod_structured">🇯🇵 JHOD Gemini 3.1 Flash-Lite (Strict Schema)</option>
                <option value="regex">⚡ Deterministic Rules Only (No AI)</option>
                <option value="llm">🤖 Direct AI Test (Override Rules)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gw-primary uppercase tracking-wider">
                {parseMode === 'hybrid' ? 'AI Escalation' : parseMode === 'jhod_structured' ? 'Grounding Guard' : 'AI Model'}
              </label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="bg-gw-bg border-2 border-gw-primary text-gw-primary text-xs px-3 py-1.5 rounded font-mono font-bold focus:outline-none focus:border-gw-accent transition-colors"
                disabled={parseMode === 'regex' || parseMode === 'hybrid' || parseMode === 'jhod_structured'}
              >
                {parseMode === 'jhod_structured' ? (
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Zero Hallucination)</option>
                ) : parseMode === 'hybrid' ? (
                  <option value="auto">Auto: Gemini Flash-Lite</option>
                ) : (
                  <>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Recommended)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gw-primary uppercase tracking-wider">Paste Unstructured Warning Text</label>
              {parseMode === 'jhod_structured' && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-300 rounded">
                  WWNWS / JHOD Schema Active
                </span>
              )}
            </div>
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
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setRawText(
                    `NAVAREA III 0102/26 WESTERN MEDITERRANEAN SEA. GUNNERY EXERCISES 150000 UTC TO 182359 UTC SEP IN AREA BOUNDED BY 37-12N 009-45E, 37-25N 010-10E, 37-05N 010-20E. SHIPS TO KEEP SAFE DISTANCE.\n---\nNAVAREA III 0103/26 EASTERN MEDITERRANEAN. CABLE LAYING OPERATIONS BY C/S DEPENDABLE FROM 20 SEP TO 30 SEP ALONG TRACK: 34-10N 032-15E TO 33-50N 033-05E. 1NM BERTH REQUESTED.`
                  )
                }
                className="text-xs text-gw-accent hover:text-gw-primary transition-colors underline font-mono font-bold uppercase text-left"
              >
                Sample Bulk Text
              </button>
              <button
                type="button"
                onClick={() => {
                  setRawText(
                    `NO.26-0453 Date:2026/10/09 13 UTC\n\nNORTH PACIFIC, MARSHALLS.\nDERELICT BARGE ADRIFT IN VICINITY OF\n05-05.79N 167-14.00E AT 090330Z OCT.\nCANCEL 0449/26.\nCANCEL THIS MSG 120330Z OCT.`
                  );
                  setNavarea('XI');
                  setParseMode('jhod_structured');
                }}
                className="text-xs text-indigo-700 hover:text-indigo-900 transition-colors underline font-mono font-bold uppercase text-left"
              >
                🇯🇵 Sample JHOD NAVAREA XI Telex
              </button>
              <button
                type="button"
                onClick={() => {
                  setRawText(JHOD_19_NOTICES_CORPUS);
                  setNavarea('XI');
                  setParseMode('jhod_structured');
                  setViewMode('table');
                }}
                className="text-xs text-emerald-700 hover:text-emerald-900 transition-colors underline font-mono font-bold uppercase text-left"
              >
                🇯🇵 Load Complete 19-Notice NAVAREA XI Feed
              </button>
              <button
                type="button"
                onClick={() => {
                  setRawText(
                    `NO.26-0499 Date:2026/10/11 08 UTC\n\nNORTH PACIFIC, MARIANAS.\nDERELICT BARGE ADRIFT IN VICINITY OF\n11-52 146-04 AT 110700Z OCT.\nCANCEL THIS MSG 150800Z OCT.`
                  );
                  setNavarea('XI');
                  setParseMode('regex');
                }}
                className="text-xs text-rose-700 hover:text-rose-900 transition-colors underline font-mono font-bold uppercase text-left"
                title="Tests strict quarantine when coordinate is missing both hemisphere letters"
              >
                🛡️ Test Missing Hemisphere (Quarantine)
              </button>
              <button
                type="button"
                onClick={() => {
                  setRawText(
                    `NO.26-0498 Date:2026/10/11 08 UTC\n\nNORTH PACIFIC, OKINOTORI SHIMA.\nHATCH COVER ADRIFT IN\n16-54.1N 134-39.5 AT 110730Z OCT.\nCANCEL THIS MSG 150800Z OCT.`
                  );
                  setNavarea('XI');
                  setParseMode('regex');
                }}
                className="text-xs text-amber-700 hover:text-amber-900 transition-colors underline font-mono font-bold uppercase text-left"
                title="Tests strict quarantine when coordinate has latitude hemisphere but lacks longitude hemisphere"
              >
                🛡️ Test Partial Hemisphere (Quarantine)
              </button>
              <button
                type="button"
                onClick={() => {
                  setRawText(
                    `NO.26-0497 Date:2026/10/11 08 UTC\n\nPHILIPPINE SEA.\nUNEXPLODED ORDNANCE FOUND IN 14-22.5N 142-10.8E.\nWITHIN A RADIUS OF 500 METRES.\nCANCEL THIS MSG 160000Z OCT.`
                  );
                  setNavarea('XI');
                  setParseMode('regex');
                }}
                className="text-xs text-blue-700 hover:text-blue-900 transition-colors underline font-mono font-bold uppercase text-left"
                title="Tests broadened radius regex converting 500 metres to 0.270 NM"
              >
                📏 Test Metric Radius (500m → 0.270 NM)
              </button>
            </div>

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

          {/* Batch Review Header & View Switcher */}
          {parsedResults.length > 0 && (
            <div className="space-y-3 pb-3 border-b-2 border-gw-primary/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-gw-primary uppercase tracking-wider">
                    Extracted {parsedResults.length} Bulletin{parsedResults.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                    {parsedResults.filter(w => w.data_quality === 'EXPLICIT').length} Explicit
                  </span>
                  {parsedResults.filter(w => w.data_quality === 'INFERRED').length > 0 && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      {parsedResults.filter(w => w.data_quality === 'INFERRED').length} Inferred
                    </span>
                  )}
                  {parsedResults.filter(w => w.data_quality === 'AMBIGUOUS' || (w.ambiguous_positions && w.ambiguous_positions.length > 0)).length > 0 && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-rose-700" />
                      <span>{parsedResults.filter(w => w.data_quality === 'AMBIGUOUS' || (w.ambiguous_positions && w.ambiguous_positions.length > 0)).length} Quarantined</span>
                    </span>
                  )}
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
                    {parsedResults.filter(w => w.status === 'active').length} In-Force Active
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-gw-bg border-2 border-gw-primary rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
                        viewMode === 'table' ? 'bg-gw-primary text-gw-secondary shadow-sm' : 'text-gw-accent hover:text-gw-primary'
                      }`}
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                      <span>Table</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('cards')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
                        viewMode === 'cards' ? 'bg-gw-primary text-gw-secondary shadow-sm' : 'text-gw-accent hover:text-gw-primary'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Cards</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleSaveToSupabase(parsedResults)}
                    disabled={isSavingToSupabase}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
                    title="Commit all extracted warnings to Supabase"
                  >
                    {isSavingToSupabase ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                    <span>Save All</span>
                  </button>
                </div>
              </div>

              {/* In-Force Manifest Reconciliation Summary Banner */}
              {manifestSummary && (
                <div className="p-3 bg-indigo-50 border-2 border-indigo-400 rounded-xl space-y-1.5 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center justify-between font-bold text-indigo-950 font-mono">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>IN-FORCE MANIFEST RECONCILED ({manifestSummary.manifestId})</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-200 text-indigo-900 text-[10px]">
                      {manifestSummary.inForceNumbers.length} Notices In Force
                    </span>
                  </div>
                  <div className="text-[11px] text-indigo-900 leading-relaxed font-mono flex flex-wrap items-center gap-2">
                    <span>Cancellations declared:</span>
                    <span className="font-bold text-red-700 bg-white px-2 py-0.5 rounded border border-red-300">
                      {manifestSummary.cancelledByManifest.length > 0 ? manifestSummary.cancelledByManifest.join(', ') : 'None'}
                    </span>
                    {manifestSummary.newlyDeactivatedCount > 0 && (
                      <span className="text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        {manifestSummary.newlyDeactivatedCount} notice(s) marked not-in-force
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {parsedResults.length > 0 ? (
            viewMode === 'table' ? (
              /* Batch Review Table Mode */
              <div className="overflow-x-auto max-h-[600px] custom-scrollbar border-2 border-gw-primary rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gw-bg sticky top-0 z-10 border-b-2 border-gw-primary text-[11px] font-bold uppercase tracking-wider text-gw-primary">
                    <tr>
                      <th className="p-3">Ref ID</th>
                      <th className="p-3">Type / Hazard</th>
                      <th className="p-3">Area & Title</th>
                      <th className="p-3">Data Quality</th>
                      <th className="p-3">Geometry</th>
                      <th className="p-3">Integrity</th>
                      <th className="p-3">Validity / Cancels</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gw-primary/20 bg-white font-mono">
                    {parsedResults.map((w, idx) => {
                      const isQuarantined = Boolean((w.ambiguous_positions && w.ambiguous_positions.length > 0) || w.data_quality === 'AMBIGUOUS');
                      const geom = w.spatial?.geometries?.[0];
                      const geomType = isQuarantined ? 'None' : geom?.type || (w.spatial?.circles?.length ? 'Circle' : 'None');
                      const geomCount =
                        isQuarantined
                          ? '0 Pts'
                          : geomType === 'Polygon'
                          ? Array.isArray(geom?.coordinates?.[0]) ? geom.coordinates[0].length : 0
                          : geomType === 'LineString'
                          ? Array.isArray(geom?.coordinates) ? geom.coordinates.length : 0
                          : geomType === 'Circle'
                          ? `${w.spatial?.circles?.[0]?.radius_nm || geom?.radius_nm || 0} NM`
                          : geomType === 'Point'
                          ? '1 Pt'
                          : 'None';

                      const isManifest = w.series?.includes('MANIFEST') || /MESSAGES IN FORCE/i.test(w.raw_text);

                      return (
                        <tr key={w.source_warning_id || idx} className="hover:bg-gw-bg/60 transition-colors">
                          <td className="p-3 align-top font-bold text-gw-primary whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{w.source_warning_id}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  w.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : 'bg-red-100 text-red-900 border border-red-300'
                                }`}
                              >
                                {w.status}
                              </span>
                            </div>
                            <span className="text-[10px] text-gw-accent block font-normal">
                              {w.issued_date || '2026-10'}
                            </span>
                          </td>

                          <td className="p-3 align-top whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isManifest
                                  ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                  : w.hazard_category === 'environmental' || /TSUNAMI/i.test(w.raw_text)
                                  ? 'bg-red-100 text-red-900 border border-red-300'
                                  : w.hazard_category === 'drifting'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : w.hazard_category === 'military'
                                  ? 'bg-orange-100 text-orange-900 border border-orange-300'
                                  : w.hazard_category === 'subsea'
                                  ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                  : 'bg-slate-100 text-slate-800 border border-slate-300'
                              }`}
                            >
                              {isManifest ? 'Manifest' : w.hazard_category || 'Notice'}
                            </span>
                            {(w as any).details?.vessel?.name && (
                              <div className="text-[10px] text-slate-600 mt-1 truncate max-w-[140px]" title={(w as any).details.vessel.name}>
                                🚢 {(w as any).details.vessel.name}
                              </div>
                            )}
                          </td>

                          <td className="p-3 align-top font-sans text-xs max-w-[200px]">
                            <div className="font-bold text-gw-primary truncate" title={w.title || w.area_text}>
                              {w.title || w.area_text}
                            </div>
                            <div className="text-[11px] text-gw-accent truncate" title={w.area_text}>
                              {w.area_text}
                            </div>
                          </td>

                          <td className="p-3 align-top whitespace-nowrap">
                            {w.data_quality === 'EXPLICIT' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>EXPLICIT</span>
                              </span>
                            ) : w.data_quality === 'INFERRED' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                <span>INFERRED</span>
                              </span>
                            ) : w.data_quality === 'AMBIGUOUS' || isQuarantined ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-300" title="Quarantined: map rendering blocked">
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                <span>QUARANTINED</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-900 bg-red-100 px-2 py-0.5 rounded border border-red-400">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                <span>{w.data_quality || 'INVALID'}</span>
                              </span>
                            )}
                            {w.ambiguous_positions && w.ambiguous_positions.length > 0 && (
                              <div className="text-[9px] font-mono font-bold text-rose-700 mt-1">
                                {w.ambiguous_positions[0].reason === 'PARTIAL_HEMISPHERE' ? '⚠️ Partial Hemi' : '⚠️ Missing Hemi'}
                                <span className="text-[8px] text-slate-500 block font-normal">
                                  Lat: {w.ambiguous_positions[0].has_lat_hem ? '✓' : '✗'} | Lon: {w.ambiguous_positions[0].has_lon_hem ? '✓' : '✗'}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="p-3 align-top whitespace-nowrap">
                            {isQuarantined ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-800 border border-rose-300" title="Map render blocked by safety policy">
                                <ShieldAlert className="w-3 h-3 text-rose-600" />
                                <span>Blocked (0 Pts)</span>
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  geomType === 'Polygon'
                                    ? 'bg-purple-50 text-purple-900 border border-purple-300'
                                    : geomType === 'Circle'
                                    ? 'bg-rose-50 text-rose-900 border border-rose-300'
                                    : geomType === 'LineString'
                                    ? 'bg-blue-50 text-blue-900 border border-blue-300'
                                    : geomType === 'Point'
                                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                <MapPin className="w-3 h-3" />
                                <span>{geomType} ({geomCount})</span>
                              </span>
                            )}
                          </td>

                          <td className="p-3 align-top whitespace-nowrap">
                            {w.extraction_method === 'gemini_structured_output' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Grounded</span>
                              </span>
                            ) : w.extraction_method === 'deterministic_hallucination_fallback' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                                <span>Fallback</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                                <span>Rules</span>
                              </span>
                            )}
                          </td>

                          <td className="p-3 align-top text-[10px] max-w-[140px]">
                            {w.cancels && w.cancels.length > 0 && (
                              <div className="text-red-700 truncate" title={`Cancels: ${w.cancels.join(', ')}`}>
                                ❌ {w.cancels.join(', ')}
                              </div>
                            )}
                            {w.valid_to && (
                              <div className="text-blue-700 truncate" title={`Expires: ${w.valid_to}`}>
                                ⏱️ {w.valid_to.slice(0, 10)}
                              </div>
                            )}
                          </td>

                          <td className="p-3 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setInspectedWarning(w)}
                                className="px-2 py-1 bg-gw-bg hover:bg-gw-primary hover:text-gw-secondary text-gw-primary text-[11px] font-bold rounded border border-gw-primary transition-colors"
                                title="Inspect attributes and ECDIS feature editor"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectWarning(w)}
                                className="px-2 py-1 bg-gw-primary hover:bg-gw-accent text-gw-secondary text-[11px] font-bold rounded transition-colors"
                                title="Inspect in Data Bank & Cartographic Map"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Card View Mode */
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
                        <span className="text-gw-accent uppercase font-bold text-[10px]">Extraction Method & Data Quality:</span>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              parsedResult.data_quality === 'EXPLICIT'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-400'
                                : parsedResult.data_quality === 'INFERRED'
                                ? 'bg-amber-100 text-amber-900 border border-amber-400'
                                : parsedResult.data_quality === 'AMBIGUOUS' || (parsedResult.ambiguous_positions && parsedResult.ambiguous_positions.length > 0)
                                ? 'bg-rose-100 text-rose-900 border border-rose-400'
                                : 'bg-red-100 text-red-900 border border-red-400'
                            }`}
                          >
                            Quality: {parsedResult.data_quality || 'EXPLICIT'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              parsedResult.extraction_method === 'gemini_structured_output'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-400'
                                : parsedResult.extraction_method === 'deterministic_hallucination_fallback'
                                ? 'bg-amber-100 text-amber-900 border border-amber-400'
                                : parsedResult.extraction_method === 'llm_assisted'
                                ? 'bg-amber-100 text-amber-900 border border-amber-400'
                                : 'bg-green-100 text-green-900 border border-green-400'
                            }`}
                          >
                            {parsedResult.extraction_method === 'gemini_structured_output'
                              ? 'Gemini 3.1 Structured Schema'
                              : parsedResult.extraction_method === 'deterministic_hallucination_fallback'
                              ? 'Hallucination Fallback'
                              : parsedResult.extraction_method === 'llm_assisted'
                              ? 'LLM assisted'
                              : 'Deterministic'}
                          </span>
                          {parsedResult.hazard_category && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-900 border border-blue-300">
                              Hazard: {parsedResult.hazard_category}
                            </span>
                          )}
                          {parsedResult.extraction_confidence && (
                            <span className="text-gw-accent font-bold">
                              Confidence: {(parsedResult.extraction_confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quarantine Alert Banner */}
                      {((parsedResult.ambiguous_positions && parsedResult.ambiguous_positions.length > 0) || parsedResult.data_quality === 'AMBIGUOUS') && (
                        <div className="p-2.5 bg-rose-50 border border-rose-300 rounded text-xs text-rose-900 flex items-start gap-2 font-medium">
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block font-mono text-[11px] text-rose-950 uppercase">Quarantined (Ambiguous Hemisphere)</strong>
                            <span>Map rendering blocked by dual-layer safety policy. Position {parsedResult.ambiguous_positions?.[0]?.raw_text || 'detected'} lacks hemisphere letters.</span>
                          </div>
                        </div>
                      )}

                      {/* Grounding & Hallucination Guard Banner */}
                      {parsedResult.extraction_method === 'gemini_structured_output' && (
                        <div className="p-2 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-900 flex items-center gap-2 font-medium">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Verbatim Grounding Verified: coordinates match raw telex exactly (Zero Hallucination).</span>
                        </div>
                      )}
                      {parsedResult.extraction_method === 'deterministic_hallucination_fallback' && (
                        <div className="p-2 bg-amber-50 border border-amber-400 rounded text-xs text-amber-900 flex items-center gap-2 font-medium">
                          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Hallucination Guard Engaged: ungrounded coordinates rejected. Deterministic coordinates preserved & flagged.</span>
                        </div>
                      )}

                      {/* Extracted Details Drawer */}
                      {((parsedResult as any).details || (parsedResult.cancels && parsedResult.cancels.length > 0) || parsedResult.valid_to) && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded space-y-1 text-xs">
                          <span className="text-gw-accent uppercase font-bold text-[10px] block">Extracted Telex Attributes:</span>
                          <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                            {(parsedResult as any).details?.vessel?.name && (
                              <span className="bg-white px-2 py-0.5 rounded border border-slate-300">
                                🚢 Vessel: {(parsedResult as any).details.vessel.name} ({(parsedResult as any).details.vessel.role || 'operation'})
                              </span>
                            )}
                            {(parsedResult as any).details?.aton?.name && (
                              <span className="bg-white px-2 py-0.5 rounded border border-slate-300">
                                💡 AtoN: {(parsedResult as any).details.aton.name} [{(parsedResult as any).details.aton.state}]
                              </span>
                            )}
                            {(parsedResult as any).details?.operation?.type && (
                              <span className="bg-white px-2 py-0.5 rounded border border-slate-300">
                                ⚙️ Operation: {(parsedResult as any).details.operation.type}
                              </span>
                            )}
                            {parsedResult.cancels && parsedResult.cancels.length > 0 && (
                              <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                                ❌ Cancels: {parsedResult.cancels.join(', ')}
                              </span>
                            )}
                            {parsedResult.valid_to && (
                              <span className="bg-blue-50 text-blue-900 px-2 py-0.5 rounded border border-blue-300">
                                ⏱️ Expiry: {new Date(parsedResult.valid_to).toUTCString()}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Unparsed Lines Audit */}
                      {(parsedResult as any).unparsed_lines && (parsedResult as any).unparsed_lines.length > 0 && (
                        <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-700">
                          <span className="font-bold text-slate-800">
                            Preserved Unparsed Lines ({(parsedResult as any).unparsed_lines.length}):
                          </span>
                          <ul className="list-disc list-inside mt-1 space-y-0.5 text-[10px] text-slate-600">
                            {(parsedResult as any).unparsed_lines.map((line: string, i: number) => (
                              <li key={i}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      )}

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
            )
          ) : (
            <div className="text-center py-16 text-gw-accent text-xs font-bold uppercase tracking-wider space-y-2 my-auto">
              <FileText className="w-10 h-10 text-gw-primary opacity-30 mx-auto" />
              <div>Paste warning text on the left and click "Parse & Extract Geometry"</div>
            </div>
          )}

          {/* Dedicated Single Warning Inspection Modal */}
          {inspectedWarning && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white border-2 border-gw-primary rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200 custom-scrollbar">
                <div className="flex items-center justify-between border-b-2 border-gw-primary pb-3">
                  <div>
                    <h3 className="text-base font-bold text-gw-primary font-mono flex items-center gap-2">
                      <span>{inspectedWarning.source_warning_id}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gw-bg border border-gw-primary uppercase">
                        {inspectedWarning.series}
                      </span>
                    </h3>
                    <p className="text-xs text-gw-accent mt-0.5">{inspectedWarning.area_text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectedWarning(null)}
                    className="p-1 rounded-lg hover:bg-gw-bg text-gw-primary transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Data Quality & P0 Safety Diagnostics Panel */}
                  <div className="p-3 rounded-lg border flex flex-col gap-2 font-mono text-xs bg-slate-50 border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase text-[10px] text-gw-accent">Data Quality Rating:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        inspectedWarning.data_quality === 'EXPLICIT'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-400'
                          : inspectedWarning.data_quality === 'INFERRED'
                          ? 'bg-amber-100 text-amber-900 border border-amber-400'
                          : inspectedWarning.data_quality === 'AMBIGUOUS' || (inspectedWarning.ambiguous_positions && inspectedWarning.ambiguous_positions.length > 0)
                          ? 'bg-rose-100 text-rose-900 border border-rose-400'
                          : 'bg-red-100 text-red-900 border border-red-400'
                      }`}>
                        {inspectedWarning.data_quality || 'EXPLICIT'}
                      </span>
                    </div>

                    {/* Ambiguous Position Quarantine Alert */}
                    {inspectedWarning.ambiguous_positions && inspectedWarning.ambiguous_positions.length > 0 && (
                      <div className="p-2.5 rounded bg-rose-50 border border-rose-300 text-rose-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-rose-950">
                          <ShieldAlert className="w-4 h-4 text-rose-700" />
                          <span>QUARANTINED BY P0 SAFETY POLICY</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Automated map rendering is strictly disabled. Raw coordinate "{inspectedWarning.ambiguous_positions[0].raw_text}"
                          lacks explicit hemisphere notation (Lat: {inspectedWarning.ambiguous_positions[0].has_lat_hem ? 'Present' : 'Missing'}, Lon: {inspectedWarning.ambiguous_positions[0].has_lon_hem ? 'Present' : 'Missing'}).
                        </p>
                      </div>
                    )}

                    {/* Grounding Diagnostic Details */}
                    {inspectedWarning.grounding_diagnostic && (
                      <div className="p-2 bg-white rounded border border-slate-200 space-y-1 text-[11px]">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>Grounding Verification:</span>
                          <span className={inspectedWarning.grounding_diagnostic.grounded ? 'text-emerald-700' : 'text-rose-700'}>
                            {inspectedWarning.grounding_diagnostic.grounded ? '✓ 100% Grounded in Raw Text' : '✗ Ungrounded Coordinates Detected'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Checked {inspectedWarning.grounding_diagnostic.checked_count} coordinate phrases.
                          {inspectedWarning.grounding_diagnostic.matched_phrases.length > 0 && (
                            <span className="block text-emerald-800 mt-0.5">Matched: {inspectedWarning.grounding_diagnostic.matched_phrases.join(', ')}</span>
                          )}
                          {inspectedWarning.grounding_diagnostic.unmatched_phrases.length > 0 && (
                            <span className="block text-rose-800 mt-0.5">Unmatched: {inspectedWarning.grounding_diagnostic.unmatched_phrases.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Radius Specifications */}
                    {inspectedWarning.radius_specifications && inspectedWarning.radius_specifications.length > 0 && (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900 space-y-0.5">
                        <span className="font-bold block text-[10px] text-blue-950 uppercase">Radius Normalisation:</span>
                        <div>Stated: <strong>{inspectedWarning.radius_specifications[0].stated_value} {inspectedWarning.radius_specifications[0].raw_stated_unit}</strong></div>
                        <div>Normalised: <strong>{inspectedWarning.radius_specifications[0].radius_nm} NM</strong> (1 NM = 1852 m)</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="font-bold uppercase text-[10px] text-gw-accent">Raw Telex Notice:</span>
                    <pre className="mt-1 p-3 bg-gw-bg rounded-lg border border-gw-primary/30 font-mono text-[11px] whitespace-pre-wrap text-slate-800 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                      {inspectedWarning.raw_text}
                    </pre>
                  </div>

                  <div>
                    <span className="font-bold uppercase text-[10px] text-gw-accent">Parsed Coordinates:</span>
                    <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[11px]">
                      {inspectedWarning.spatial?.raw_coordinate_text?.length ? (
                        inspectedWarning.spatial.raw_coordinate_text.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">No spatial coordinates extracted</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="font-bold uppercase text-[10px] text-gw-accent">ECDIS Feature Editor:</span>
                    <div className="mt-1">
                      <EcdisFeatureEditor
                        warningId={inspectedWarning.source_warning_id || inspectedWarning.warning_id}
                        navarea={inspectedWarning.navarea}
                        rawText={inspectedWarning.raw_text}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gw-primary/20">
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveToSupabase([inspectedWarning]);
                    }}
                    disabled={isSavingToSupabase}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Database className="w-4 h-4 text-emerald-200" />
                    <span>Save to Supabase</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectWarning(inspectedWarning);
                      setInspectedWarning(null);
                    }}
                    className="flex-1 bg-gw-primary hover:bg-gw-accent text-gw-secondary font-bold text-xs uppercase tracking-wider py-2.5 rounded transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Inspect in Bank & Map</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectedWarning(null)}
                    className="px-4 py-2.5 bg-gw-bg hover:bg-slate-200 text-gw-primary font-bold text-xs uppercase tracking-wider rounded border border-gw-primary transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
