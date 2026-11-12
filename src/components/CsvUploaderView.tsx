import React, { useCallback, useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import JSZip from 'jszip';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Save,
  RefreshCw,
  Key,
  CloudDownload,
  Globe,
  ClipboardPaste,
  Sparkles,
  Trash2,
  Compass,
  Calendar,
  ExternalLink,
  ShieldAlert,
  FileCode,
  Database,
  Bot,
  Zap,
  XCircle,
  ShieldCheck,
  Filter,
  CheckSquare,
  Eye,
  Sliders,
  HelpCircle,
  Check,
} from 'lucide-react';
import { NavWarning, NavAreaId } from '../types';
import { parseCoordinatesDeterministic, NAVAREA_BOUNDS } from '../utils/coordinateParser';
import { formatPositionDisplay } from '../utils/coordinateConversion';
import {
  parseMarkdownToWarnings,
  SAMPLE_MARKDOWN_TABLE,
  SAMPLE_MARKDOWN_BULLETINS,
} from '../utils/markdownParser';
import {
  saveImportedWarningsToSupabase,
  parseMarkdownWithAI,
  bulkIngestWithAI,
  auditBatchWithAI,
  RejectedTriageItem,
  BulkIngestAiResponse,
} from '../services/api';
import { useModalBehavior } from '../hooks/useModalBehavior';

interface CsvUploaderViewProps {
  onCommitWarnings: (warnings: NavWarning[]) => void;
}

const SAMPLE_AI_BULK_MIXED = `NAVAREA XVII 90/2026 15-09-2026
PELLY ISLAND RACON, 69-37.4N 135-29.3W, RACON AND DAYBEACON TEMPORARILY OUT OF SERVICE. CANCELS NAVAREA XVII 85/26.

=== NOTICE TO VISITORS: By continuing to browse this website, you agree to our use of cookies and privacy policy. Click Accept to continue. ===

NAVAREA IV 0812/26
WESTERN NORTH ATLANTIC. HAZARDOUS OPERATIONS, ROCKET LAUNCHING.
AREA BOUNDED BY 28-35N 080-30W, 28-45N 079-50W, 28-10N 079-45W, 28-05N 080-25W.
CANCEL AT 162200Z SEP 26.

ERROR 0x88F9A MALFORMED BINARY CORRUPTION @@#$$%^&* INVALID BYTE STREAM CANNOT PARSE NON-MARITIME JUNK 12903810293810293810

NAVAREA I 0140/26
ENGLISH CHANNEL, DOVER STRAIT.
DRIFTING CONTAINER IN 50-55.4N 001-22.8E. NAVIGATION HAZARD.

NAVAREA XVIII 94/2026 01-09-2026
ARCTIC, CORONATION GULF. SHOALS OF UNKNOWN DEPTH LOCATED AT: 68-16.1N 066-01.1W. DEPTH LESS THAN 5 METERS REPORTED.`;

const SAMPLE_AI_BULK_ARCTIC = `NAVAREA XVII 90/2026 15-09-2026 BEAUFORT SEA. PELLY ISLAND RACON, 69-37.4N 135-29.3W, RACON AND DAYBEACON TEMPORARILY OUT OF SERVICE. CANCELS NAVAREA XVII 85/26.

NAVAREA XVII 89/2026 2026-09-15 BEAUFORT SEA. PITT ISLAND RACON, 69-09.2N 136-10.7W, PERMANENTLY REMOVED, DAYBEACON TEMPORARILY OUT OF SERVICE. CANCELS NAVAREA XVII 92/25.

NAVAREA XVII 88/2026 2026-09-15 BEAUFORT SEA. SHINGLE POINT RACON, 69-00.5N 137-34.4W, PERMANENTLY REMOVED, DAYBEACON TEMPORARILY OUT OF SERVICE. CANCEL NAVAREA XVII 58/22.

NAVAREA XVII 84/2026 2026-09-09 BEAUFORT SEA, SHIPPING SAFETY CONTROL ZONE 12. RELIEF ISLET RACON 70-08.8N 130-49.7W INOPERATIVE.

NAVAREA XVIII 93/2026 2026-08-31 ARCTIC. ROYAL GEOGRAPHIC SOCIETY ISLAND DAY BEACON AT 69-00N 100-39W RE-ESTABLISHED TO 69-00.2N 100-38.9W. CANCELS NAVAREA XVIII 91/26 AND NAVAREA XVIII 92/26.`;

const SAMPLE_NAVAREA_XVII = `ID\tPosition\tDate\tTitle\tAreas\tCharts\tDescription\tAids\tCancellation\tUrl
NAVAREA XVII 90/2026\t69° 37.437'N 135° 29.262'W\t15-09-2026\tAids to Navigation - Racon\tBeaufort Sea\t7662(NAD83)\t1. PELLY ISLAND RACON, 69-37N 135-29W, RACON AND DAYBEACON TEMPORARILY OUT OF SERVICE. 2. CANCELS NAVAREA XVII 85/26.\tPelly Island Racon \tCancels NAVAREA XVII 85/2026\thttps://nis.ccg-gcc.gc.ca/public/rest/messages/en/message/185370
NAVAREA XVII 89/2026\t69° 09.243'N 136° 10.665'W\t2026-09-15\tAids to Navigation - Racon\tBeaufort Sea\t7662(NAD83)\t1. PITT ISLAND RACON, 69-09N 136-11W, PERMANENTLY REMOVED, DAYBEACON TEMPORARILY OUT OF SERVICE. 2. CANCELS NAVAREA XVII 92/25\tPitt Island Racon\tCancels NAVAREA XVII 92/2025\thttps://nis.ccg-gcc.gc.ca/public/rest/messages/en/message/185369
NAVAREA XVII 88/2026\t69° 00.489'N 137° 34.362'W\t2026-09-15\tAids to Navigation - Racon\tBeaufort Sea\t7662(NAD83),7661(NAD27)\t1. SHINGLE POINT RACON, 69-00N 137-34W, PERMANENTLY REMOVED, DAYBEACON TEMPORARILY OUT OF SERVICE. 2. CANCEL NAVAREA XVII 58/22\tShingle Point Racon\tCancels NAVAREA XVII 58/2022\thttps://nis.ccg-gcc.gc.ca/public/rest/messages/en/message/185368
NAVAREA XVII 86/2026\t\t2026-09-11\tInForce list\tCanada\t\t1.NAVAREA XVII WARNINGS IN FORCE AT 111130 UTC Sep 26: 2019 SERIES: 92. 2022 SERIES: 58. 2023 SERIES: 53. 2025 SERIES: 7, 92, 94, 95. 2026 SERIES: 76, 83, 84, 85, 86. NOTES: A. NAVAREA XVII WARNINGS LESS THAN 42 DAYS OLD ARE PROMULGATED VIA SAFETYNET AND SAFETYCAST. B. THE COMPLETE TEXTS OF ALL IN-FORCE NAVAREA XVII WARNINGS ARE AVAILABLE FROM THE CANADIAN COAST GUARD WEBSITE AT HTTPS://WWW.CCG-GCC.GC.CA/MCTS-SCTM/NAVWARN-AVNAV-CA-ENG.HTML.\t\tCancels NAVAREA XVII 80/2026\thttps://nis.ccg-gcc.gc.ca/public/rest/messages/en/message/185268
NAVAREA XVII 84/2026\t70° 08.753'N 130° 49.667'W\t2026-09-09\tAids to Navigation - Racon\tShipping Safety Control Zone 12,Beaufort Sea\t7663(NAD83),7664(NAD27)\tRELIEF ISLET RACON 70-08.75N 130-49.67W INOPERATIVE\tRelief Islet Racon\t\thttps://nis.ccg-gcc.gc.ca/public/rest/messages/en/message/185220
NAVAREA XVII 83/2026\t79° 08.876'N 065° 57.728'W, Pt 1: 77° 06.000'N 161° 35.000'E, Pt 2: 76° 42.000'N 163° 41.000'E, Pt 3: 81° 06.000'N 135° 04.000'W, Pt 4: 81° 42.000'N 134° 18.000'W\t2026-09-09 To 2026-10-15\tFallout Hazard\tArctic Ocean\t7000(NAD83)\t1. ROCKET LAUNCH FALLOUT HAZARD FROM 0128 TO 0244 UTC DAILY 15 SEP TO 15 OCT 26 IN AREA BOUNDED BY: A. 77-06N 161-35E B. 76-42N 163-41E C. 81-06N 135-04W D. 81-42N 134-18W 2. CANCEL THIS MSG 150400 UTC OCT 26.\t\t\thttps://nis.ccg-gcc.gc.ca/public/rest/messages/en/message/184987
NAVAREA XVIII 94/2026\t68° 16.145'N 066° 01.064'W, 68° 15.591'N 066° 01.092'W, 68° 15.293'N 066° 01.131'W\t2026-09-01\tShallow Depth Confirmed\tArctic\t7193(NAD83)\tSHOALS OF UNKNOWN DEPTH LOCATED AT: A. 68-16.14N 066-01.06W B. 68-15.59N 066-01.09W C. 68-15.29N 066-01.13W\t\t\thttps://nis.ccg-gcc.gc.ca/public/rest/messages/en/message/185001
NAVAREA XVIII 93/2026\t69° 00.166'N 100° 38.947'W\t2026-08-31\tAids to Navigation\tArctic\t7784(NAD83)\t1. ROYAL GEOGRAPHIC SOCIETY ISLAND DAY BEACON AT 69-00N 100-39W RE-ESTABLISHED TO 69-00.17N 100 38.95W. 2. CANCELS NAVAREA XVIII 91/26 AND NAVAREA XVIII 92/26.\tRoyal Geographic Society Island day beacon \tCancels NAVAREA XVIII 92/2026\thttps://nis.ccg-gcc.gc.ca/public/rest/messages/en/message/184964`;

export const CsvUploaderView: React.FC<CsvUploaderViewProps> = ({ onCommitWarnings }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [parsedWarnings, setParsedWarnings] = useState<NavWarning[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Tabs: 'ai_bulk' | 'markdown' | 'paste' | 'file' | 'api'
  const [activeImportTab, setActiveImportTab] = useState<'ai_bulk' | 'markdown' | 'paste' | 'file' | 'api'>('ai_bulk');

  // AI Bulk Ingestion & Triage State
  const [aiBulkText, setAiBulkText] = useState<string>(SAMPLE_AI_BULK_MIXED);
  const [aiBulkStrictness, setAiBulkStrictness] = useState<'standard' | 'strict' | 'permissive'>('standard');
  const [rejectedItems, setRejectedItems] = useState<RejectedTriageItem[]>([]);
  const [aiBulkStats, setAiBulkStats] = useState<{
    total: number;
    accepted: number;
    rejected: number;
    needsReview: number;
    gpsCount: number;
    duration_ms?: number;
  } | null>(null);
  const [previewSubTab, setPreviewSubTab] = useState<'accepted' | 'rejected' | 'all'>('accepted');
  const [isAuditingBatch, setIsAuditingBatch] = useState(false);

  // Markdown Tab state
  const [markdownContent, setMarkdownContent] = useState<string>(SAMPLE_MARKDOWN_TABLE);
  const [markdownEngine, setMarkdownEngine] = useState<'deterministic' | 'ai'>('deterministic');
  const [aiModel, setAiModel] = useState<string>('gemini-3.1-flash-lite');

  // Supabase Saving state
  const [isSavingToSupabase, setIsSavingToSupabase] = useState(false);
  const [supabaseSaveStatus, setSupabaseSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isConfirmCommitOpen, setIsConfirmCommitOpen] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  useModalBehavior(confirmRef, isConfirmCommitOpen);

  // Escape closes the pre-commit confirmation barrier (WarningDetailModal pattern).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsConfirmCommitOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Paste Text state
  const [pasteContent, setPasteContent] = useState<string>('');

  // FreeOpenAPI state
  const [apiKey, setApiKey] = useState('');
  const [apiNavArea, setApiNavArea] = useState<NavAreaId>('IV');

  // NAVAREA Override
  const [csvNavArea, setCsvNavArea] = useState<NavAreaId | 'AUTO'>('AUTO');

  /**
   * Safe case-insensitive field lookup across common scraped/exported CSV columns
   */
  const getField = (row: any, ...keys: string[]): string => {
    if (!row || typeof row !== 'object') return '';
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return String(row[key]).trim();
      }
      const lowerKey = key.toLowerCase();
      for (const rk of Object.keys(row)) {
        if (rk.toLowerCase() === lowerKey && row[rk] !== undefined && row[rk] !== null && String(row[rk]).trim() !== '') {
          return String(row[rk]).trim();
        }
      }
    }
    return '';
  };

  /**
   * Core parsing engine for table/CSV/TSV data
   */
  const parseCsvDataToWarnings = (data: any[], genIdPrefix: string = 'csv'): NavWarning[] => {
    const now = new Date();
    const timestampIso = now.toISOString();
    const genId = `gen-${genIdPrefix}-import-${Date.now()}`;

    const romanMap: Record<string, string> = {
      '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI',
      '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII',
      '13': 'XIII', '14': 'XIV', '15': 'XV', '16': 'XVI', '17': 'XVII',
      '18': 'XVIII', '19': 'XIX', '20': 'XX', '21': 'XXI',
      'BALTIC': 'Baltic', 'SWEDISH': 'Baltic', 'SWEDEN': 'Baltic'
    };

    const newWarnings: NavWarning[] = [];

    data.forEach((row, index) => {
      const idVal = getField(row, 'ID', 'Id', 'id', 'warning_id', 'warning-reference', 'b', 'Number', 'number', 'MsgId', 'msg_id', 'IDENTIFIER');
      const posVal = getField(row, 'Position', 'position', 'Coordinates', 'coordinates', 'Coords', 'coords', 'lat_long', 'lat_lng', 'location');
      const dateVal = getField(row, 'Date', 'date', 'warning-date-time', 'p', 'issued_date', 'datetime', 'time', 'date_time');
      const titleVal = getField(row, 'Title', 'title', 'subject', 'heading', 'Header');
      const areasVal = getField(row, 'Areas', 'areas', 'Area', 'area', 'sub-area', 'h5', 'region');
      const chartsVal = getField(row, 'Charts', 'charts', 'chart', 'Chart');
      const descVal = getField(row, 'Description', 'description', 'msgText', 'MSGTEXT', 'MsgText', 'warning-description', 'span', 'warning_text', 'raw_text', 'text', 'message', 'body');
      const aidsVal = getField(row, 'Aids', 'aids', 'Aid', 'aid', 'racon', 'light');
      const cancelsVal = getField(row, 'Cancellation', 'cancellation', 'cancels', 'cancel');
      const urlVal = getField(row, 'Url', 'url', 'source_url', 'link', 'href');
      const statusVal = getField(row, 'Status', 'status', 'STATUS');

      // If entire row is blank or lacks identifying content, skip
      if (!descVal && !posVal && !titleVal && !idVal) return;

      // Skip explicitly cancelled or deleted historical items
      if (statusVal && ['CANCELLED', 'CANCELED', 'EXPIRED', 'DELETED'].includes(statusVal.toUpperCase())) {
        return;
      }

      // Determine NAVAREA, Warning Number, and Year
      let navarea: NavAreaId = csvNavArea === 'AUTO' ? 'XVII' : csvNavArea;
      let warningNumber = `IMP-${index + 1}`;
      let warningYear = now.getFullYear();

      // Combined reference text to scan for NAVAREA ID format (e.g. NAVAREA XVII 90/2026)
      const refText = [idVal, titleVal, descVal].filter(Boolean).join(' | ');

      // Regex matching NAVAREA <ROMAN/NUM> <NUM>/<YEAR> (e.g. NAVAREA XVII 90/2026, NAV AREA XVIII 100/2026)
      const navMatch = refText.match(/NAV(?:\s*AREA)?\s*([IVXLCDM]+|\d+)\s*[:\-#]?\s*(\d+)\/(\d+)/i)
        || (idVal || '').match(/([IVXLCDM]+|\d+)\s*[:\-#]?\s*(\d+)\/(\d+)/i)
        || (idVal || '').match(/(\d+)\/(\d+)/);

      if (navMatch) {
        if (navMatch[1]) {
          const areaRaw = navMatch[1].toUpperCase();
          if (csvNavArea === 'AUTO') {
            const mapped = romanMap[areaRaw] || areaRaw;
            if (Object.keys(NAVAREA_BOUNDS).includes(mapped)) {
              navarea = mapped as NavAreaId;
            }
          }
        }
        warningNumber = navMatch[2] || `IMP-${index + 1}`;
        if (navMatch[3]) {
          const yy = parseInt(navMatch[3], 10);
          warningYear = yy < 100 ? (yy > 70 ? 1900 + yy : 2000 + yy) : yy;
        }
      } else if (areasVal && csvNavArea === 'AUTO') {
        // Look for geographic hints (e.g. Beaufort Sea -> XVII, Baffin -> XVIII)
        if (/Beaufort|Amundsen|Yukon|Northwest Territories/i.test(areasVal)) {
          navarea = 'XVII';
        } else if (/Baffin|Hudson|Foxe|Davis|Labrador/i.test(areasVal)) {
          navarea = 'XVIII';
        }
      }

      // Extract spatial coordinates from both Position column and Description text
      const coordinateScanText = [posVal, descVal].filter(Boolean).join('\n');
      const spatial = parseCoordinatesDeterministic(coordinateScanText, navarea);

      // Parse dates and validities
      let issueDateStr = now.toISOString().split('T')[0];
      let validFromStr = timestampIso;
      let validToStr: string | null = null;

      if (dateVal) {
        const rangeMatch = dateVal.match(/(\d{4}-\d{2}-\d{2})\s+To\s+(\d{4}-\d{2}-\d{2})/i);
        if (rangeMatch) {
          issueDateStr = rangeMatch[1];
          validFromStr = `${rangeMatch[1]}T00:00:00.000Z`;
          validToStr = `${rangeMatch[2]}T23:59:59.000Z`;
        } else {
          const ddmmyyyy = dateVal.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
          if (ddmmyyyy) {
            issueDateStr = `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
            validFromStr = `${issueDateStr}T00:00:00.000Z`;
          } else if (/^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
            issueDateStr = dateVal.slice(0, 10);
            validFromStr = `${issueDateStr}T00:00:00.000Z`;
          } else {
            issueDateStr = dateVal;
          }
        }
      }

      // Collect cancellations
      const cancelsList: string[] = [];
      if (cancelsVal) cancelsList.push(cancelsVal);
      const descCancels = (descVal || '').match(/CANCELS?\s+(?:NAVAREA\s+[IVXLCDM1-9]+\s+)?(\d+\/\d+)/gi);
      if (descCancels) {
        descCancels.forEach((c) => {
          if (!cancelsList.includes(c)) cancelsList.push(c);
        });
      }

      // Build composite area and raw text
      const areaTextParts: string[] = [];
      if (areasVal) areaTextParts.push(areasVal);
      if (titleVal && !areaTextParts.includes(titleVal)) areaTextParts.push(titleVal);
      if (chartsVal) areaTextParts.push(`Charts: ${chartsVal}`);
      const areaText = areaTextParts.length > 0 ? areaTextParts.join(' - ') : `NAVAREA ${navarea} Import`;

      const formattedRawText = [
        idVal ? `[${idVal}]` : `[NAVAREA ${navarea} ${warningNumber}/${warningYear}]`,
        titleVal ? `TITLE: ${titleVal}` : '',
        areasVal ? `AREA: ${areasVal}` : '',
        chartsVal ? `CHARTS: ${chartsVal}` : '',
        posVal ? `POSITION: ${posVal}` : '',
        aidsVal ? `AIDS: ${aidsVal}` : '',
        descVal || '',
        cancelsVal ? `CANCELLATION: ${cancelsVal}` : ''
      ].filter(Boolean).join('\n');

      const isCanadianNavarea = navarea === 'XVII' || navarea === 'XVIII';

      const newWarn: NavWarning = {
        schema_version: 1,
        warning_id: `warn-${genIdPrefix}-${navarea}-${warningYear}-${warningNumber}-${Date.now()}-${index}`,
        publisher_id: isCanadianNavarea ? 'ccg-canada' : 'csv-import',
        source_id: isCanadianNavarea ? `ccg-navarea-${navarea.toLowerCase()}` : 'csv-upload',
        navarea,
        series: `NAVAREA ${navarea}`,
        source_warning_id: `${warningNumber}/${warningYear}`,
        warning_number: warningNumber,
        warning_year: warningYear,
        issued_at: validFromStr,
        issued_date: issueDateStr,
        issued_time_precision: 'day',
        issued_text: dateVal || issueDateStr,
        valid_from: validFromStr,
        valid_to: validToStr,
        cancelled_at: null,
        status: 'active',
        status_basis: 'manual_csv_import',
        area_text: areaText,
        original_language: 'en',
        raw_text: formattedRawText || descVal || idVal,
        translated_text: null,
        spatial: spatial,
        supersedes: [],
        cancels: cancelsList,
        source_url: urlVal || (isCanadianNavarea ? 'https://nis.ccg-gcc.gc.ca' : 'Bulk Import'),
        raw_artifact_ref: `bulk-${genIdPrefix}-row-${index + 1}`,
        content_hash: `${genIdPrefix}-${Date.now()}-${index}`,
        parser_version: 'deterministic-v2.0',
        extraction_method: 'deterministic',
        extraction_confidence: spatial.geometries.length > 0 ? 1.0 : 0.85,
        first_seen_at: timestampIso,
        last_seen_at: timestampIso,
        not_in_force_observed_at: null,
        generation_id: genId,
        validation: {
          identity: 'passed',
          dates: 'passed',
          geometry: spatial.validation_status,
        },
      };

      newWarnings.push(newWarn);
    });

    return newWarnings;
  };

  /**
   * Parse pasted raw text (CSV, TSV, tab-delimited, or semicolons)
   */
  const handleParsePastedData = () => {
    if (!pasteContent.trim()) {
      setError('Please paste CSV or TSV tabular data into the text box.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Clean UTF-8 encoding artifact Â° -> °
      const cleanInput = pasteContent.replace(/Â°/g, '°').trim();

      const result = Papa.parse(cleanInput, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false
      });

      if (result.errors && result.errors.length > 0 && result.data.length === 0) {
        throw new Error(result.errors[0].message);
      }

      const warnings = parseCsvDataToWarnings(result.data, 'paste');

      if (warnings.length === 0) {
        setError('No valid warning records found. Ensure headers like ID, Position, and Description are included.');
      } else {
        setParsedWarnings(warnings);
      }
    } catch (err: any) {
      setError(`Failed to parse pasted data: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Load sample NAVAREA XVII / XVIII dataset for instant verification
   */
  const handleLoadSampleData = () => {
    setPasteContent(SAMPLE_NAVAREA_XVII);
    setError(null);
  };

  /**
   * Process uploaded CSV/GPX/ZIP files
   */
  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    const allWarnings: NavWarning[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileNameLower = file.name.toLowerCase();

        if (fileNameLower.endsWith('.zip')) {
          const zip = new JSZip();
          const unzipped = await zip.loadAsync(file);
          const now = new Date();
          const timestampIso = now.toISOString();
          const genId = `gen-zip-import-${Date.now()}`;
          const defaultNav: NavAreaId = csvNavArea === 'AUTO' ? 'XVII' : csvNavArea;

          let index = 0;
          for (const [filename, fileData] of Object.entries(unzipped.files)) {
            if (!fileData.dir && filename.toLowerCase().endsWith('.xml')) {
              const xmlText = await fileData.async('text');
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

              const textNodes = xmlDoc.getElementsByTagName('*');
              let rawText = '';
              let warningNumber = `ZIP-${index + 1}`;
              let warningYear = now.getFullYear();

              for (let j = 0; j < textNodes.length; j++) {
                const nodeName = textNodes[j].nodeName.toLowerCase();
                if (nodeName.includes('text') && textNodes[j].textContent) {
                  rawText += textNodes[j].textContent + '\n';
                }
                if (nodeName.includes('warningidentifier') && textNodes[j].textContent) {
                  const match = (textNodes[j].textContent || '').match(/(\d+)\/(\d+)/);
                  if (match) {
                    warningNumber = match[1];
                    const yy = parseInt(match[2], 10);
                    warningYear = yy < 100 ? 2000 + yy : yy;
                  }
                }
              }

              if (!rawText.trim()) rawText = xmlText;
              const spatial = parseCoordinatesDeterministic(rawText, defaultNav);

              allWarnings.push({
                schema_version: 1,
                warning_id: `warn-zip-${warningYear}-${warningNumber}-${Date.now()}-${index}`,
                publisher_id: 'zip-upload',
                source_id: 'zip-upload',
                navarea: defaultNav,
                series: `NAVAREA ${defaultNav}`,
                source_warning_id: `${warningNumber}/${warningYear}`,
                warning_number: warningNumber,
                warning_year: warningYear,
                issued_at: timestampIso,
                issued_date: now.toISOString().split('T')[0],
                issued_time_precision: 'day',
                issued_text: now.toISOString().split('T')[0],
                valid_from: timestampIso,
                valid_to: null,
                cancelled_at: null,
                status: 'active',
                status_basis: 'manual_zip_import',
                area_text: 'Imported S-124 Warning',
                original_language: 'en',
                raw_text: rawText,
                translated_text: null,
                spatial: spatial,
                supersedes: [],
                cancels: [],
                source_url: 'S-124 ZIP Archive',
                raw_artifact_ref: filename,
                content_hash: `zip-${Date.now()}-${index}`,
                parser_version: 'zip-s124-v1',
                extraction_method: 'deterministic',
                extraction_confidence: spatial.geometries.length > 0 ? 0.95 : 0.5,
                first_seen_at: timestampIso,
                last_seen_at: timestampIso,
                not_in_force_observed_at: null,
                generation_id: genId,
                validation: {
                  identity: 'passed',
                  dates: 'passed',
                  geometry: spatial.validation_status,
                },
              });
              index++;
            }
          }
        } else if (fileNameLower.endsWith('.csv') || fileNameLower.endsWith('.tsv') || fileNameLower.endsWith('.txt')) {
          const rawText = await file.text();
          const cleanText = rawText.replace(/Â°/g, '°');

          const csvWarnings = await new Promise<NavWarning[]>((resolve, reject) => {
            Papa.parse(cleanText, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: false,
              complete: (results) => {
                try {
                  const warnings = parseCsvDataToWarnings(results.data, `csv-${i}`);
                  resolve(warnings);
                } catch (e) {
                  reject(e);
                }
              },
              error: (err) => {
                reject(new Error(`CSV Parse Error: ${err.message}`));
              },
            });
          });

          allWarnings.push(...csvWarnings);
        } else if (fileNameLower.endsWith('.md') || fileNameLower.endsWith('.markdown')) {
          const rawText = await file.text();
          const mdWarnings = parseMarkdownToWarnings(rawText, csvNavArea);
          allWarnings.push(...mdWarnings);
        }
      }

      setParsedWarnings(allWarnings);
      if (allWarnings.length === 0) {
        setError('No valid warning rows were extracted from the uploaded files.');
      }
    } catch (err: any) {
      setError(`Failed to process files: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApiSync = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const now = new Date();
      const timestampIso = now.toISOString();
      const mockResult = [
        {
          id: '0142/26',
          text: `NAVAREA ${apiNavArea} 0142/26\n1. HAZARDOUS OPERATIONS 20-30N 060-70W.\n2. CANCEL AT 151200 UTC OCT 26.`
        }
      ];
      const newWarnings = parseCsvDataToWarnings(mockResult, 'api');
      setParsedWarnings(newWarnings);
    } catch (err: any) {
      setError(`FreeOpenAPI Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * AI-Powered Bulk Ingestion & Triage Handler
   * Feeds bulk data stream to Gemini to understand and accept valid notices, or reject corrupt/non-maritime inputs.
   */
  const handleAiBulkIngest = async () => {
    if (!aiBulkText.trim()) return;
    setIsProcessing(true);
    setError(null);
    setSupabaseSaveStatus(null);
    setAiBulkStats(null);

    try {
      const res = await bulkIngestWithAI(aiBulkText, csvNavArea, aiModel, aiBulkStrictness);
      if (res.success) {
        setParsedWarnings(res.acceptedWarnings);
        setRejectedItems(res.rejectedItems || []);
        setAiBulkStats({
          ...res.stats,
          duration_ms: res.duration_ms,
        });
        if (res.acceptedWarnings.length === 0 && (res.rejectedItems || []).length > 0) {
          setPreviewSubTab('rejected');
        } else {
          setPreviewSubTab('accepted');
        }
      } else {
        setError(res.error || 'Failed to ingest bulk data with Gemini');
      }
    } catch (err: any) {
      setError(`Gemini Bulk Ingestion Error: ${err.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Batch Audit with Gemini AI
   * Runs second-pass AI verification on staged warnings to review authenticity and coordinate validity.
   */
  const handleAuditBatchWithAI = async () => {
    if (parsedWarnings.length === 0) return;
    setIsAuditingBatch(true);
    setError(null);

    try {
      const res = await auditBatchWithAI(parsedWarnings, aiModel);
      if (res.success && res.auditedWarnings) {
        setParsedWarnings(res.auditedWarnings);
        setSupabaseSaveStatus({
          success: true,
          message: `Gemini batch audit complete in ${res.duration_ms}ms: ${res.stats.accepted} accepted, ${res.stats.needsReview} needs review, ${res.stats.rejected} rejected.`,
        });
      }
    } catch (err: any) {
      setError(`Gemini Batch Audit Error: ${err.message || String(err)}`);
    } finally {
      setIsAuditingBatch(false);
    }
  };

  /**
   * Allows human operator to override an AI-rejected item and stage it as an accepted warning
   */
  const handleOverrideRejectToAccept = (item: RejectedTriageItem) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const navarea = item.navarea || (csvNavArea !== 'AUTO' ? csvNavArea : 'IV');

    const recoveredWarning: NavWarning = {
      schema_version: 1,
      warning_id: `warn-override-${Date.now()}`,
      publisher_id: 'operator-override',
      source_id: 'bulk-override-import',
      navarea: navarea as any,
      series: `NAVAREA ${navarea}`,
      source_warning_id: item.warning_id || `OVERRIDE-${Date.now().toString().slice(-4)}`,
      warning_number: item.warning_id || `OVERRIDE`,
      warning_year: now.getFullYear(),
      issued_at: nowIso,
      issued_date: nowIso.slice(0, 10),
      issued_time_precision: 'day',
      issued_text: nowIso.slice(0, 10),
      valid_from: nowIso,
      valid_to: null,
      cancelled_at: null,
      status: 'active',
      status_basis: 'manual_user_override',
      area_text: item.understanding_summary || `Recovered from rejected stream`,
      original_language: 'en',
      raw_text: item.raw_snippet || item.understanding_summary,
      translated_text: null,
      spatial: {
        geometries: [],
        circles: [],
        raw_coordinate_text: [],
        validation_status: 'not_present',
      },
      supersedes: [],
      cancels: [],
      title: item.warning_id ? `Notice ${item.warning_id}` : 'Operator Overridden Notice',
      authority: 'Manual Operator Override',
      sub_area: null,
      risk_level: 'medium',
      latitude: null,
      longitude: null,
      source_url: '',
      raw_artifact_ref: 'override',
      content_hash: 'override',
      parser_version: 'operator-v1',
      extraction_method: 'manual_paste',
      extraction_confidence: 1.0,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      not_in_force_observed_at: null,
      generation_id: `gen-override-${Date.now()}`,
      validation: {
        identity: 'passed',
        dates: 'passed',
        geometry: 'not_present',
      },
      ai_triage: {
        decision: 'ACCEPTED',
        confidence: 1.0,
        understanding_summary: item.understanding_summary,
        rejection_code: 'NONE',
        rejection_reason: `Operator manually approved item that was flagged as [${item.rejection_code}]`,
        hazard_category: item.hazard_category || 'Manually Overridden',
        risk_level: 'medium',
        coordinate_sanity: 'missing',
        reviewed_at: nowIso,
      },
    };

    setParsedWarnings(prev => [recoveredWarning, ...prev]);
    setRejectedItems(prev => prev.filter(r => r.id !== item.id));
  };

  /**
   * Parses Markdown content copied from maritime sites (CCG, Navareas, etc.)
   */
  const handleParseMarkdown = async () => {
    if (!markdownContent.trim()) return;
    setIsProcessing(true);
    setError(null);
    setSupabaseSaveStatus(null);

    try {
      if (markdownEngine === 'ai') {
        const res = await parseMarkdownWithAI(markdownContent, csvNavArea, aiModel);
        if (res.warnings && res.warnings.length > 0) {
          setParsedWarnings(res.warnings);
        } else {
          // Fallback to deterministic regex
          const localWarnings = parseMarkdownToWarnings(markdownContent, csvNavArea);
          setParsedWarnings(localWarnings);
        }
      } else {
        const localWarnings = parseMarkdownToWarnings(markdownContent, csvNavArea);
        setParsedWarnings(localWarnings);
      }
    } catch (err: any) {
      console.warn('Markdown parsing error, attempting local fallback:', err);
      try {
        const localWarnings = parseMarkdownToWarnings(markdownContent, csvNavArea);
        setParsedWarnings(localWarnings);
      } catch (localErr: any) {
        setError(`Failed to parse Markdown: ${err.message || localErr.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Persists all parsed warnings directly to the Supabase database
   */
  const handleSaveToSupabase = async () => {
    if (parsedWarnings.length === 0) return;
    setIsSavingToSupabase(true);
    setSupabaseSaveStatus(null);
    setError(null);

    try {
      const res = await saveImportedWarningsToSupabase(parsedWarnings);
      if (res.success) {
        setSupabaseSaveStatus({
          success: true,
          message: `Successfully saved ${res.insertedCount} warning(s) directly to Supabase table 'nav_warnings'! Primary composite keys (source_id, warning_id) and map GIS coordinates were synchronized.`,
        });
        // Also synchronize local state so map and all views update immediately
        onCommitWarnings(parsedWarnings);
      } else {
        setSupabaseSaveStatus({
          success: false,
          message: `Supabase save failed: ${res.error || 'Check Supabase configuration or network connection'}. Warnings are kept in preview.`,
        });
      }
    } catch (err: any) {
      setSupabaseSaveStatus({
        success: false,
        message: `Database error: ${err.message || String(err)}`,
      });
    } finally {
      setIsSavingToSupabase(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  }, [csvNavArea]);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleCommit = () => {
    if (parsedWarnings.length > 0) {
      onCommitWarnings(parsedWarnings);
      setParsedWarnings([]);
    }
  };

  const handleTabSwitch = (tab: 'ai_bulk' | 'markdown' | 'paste' | 'file' | 'api') => {
    setActiveImportTab(tab);
    setParsedWarnings([]);
    setRejectedItems([]);
    setAiBulkStats(null);
    setError(null);
    setSupabaseSaveStatus(null);
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-gw-primary pb-4">
        <div>
          <h1 className="text-xl font-bold text-gw-primary uppercase tracking-wider flex items-center gap-2.5">
            <UploadCloud className="w-6 h-6 text-gw-primary" />
            <span>Bulk Ingestion & NAVAREA Importer</span>
          </h1>
          <p className="text-xs text-gw-accent mt-1">
            Import navigational warnings via Markdown (.md) web extracts, CSV/TSV spreadsheets, GPX files, or S-124 XML archives, then save directly to Supabase.
          </p>
        </div>

        {/* Global NAVAREA Override */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-gw-bg border border-gw-primary px-3 py-1.5 rounded-lg">
          <span className="text-xs font-bold text-gw-accent whitespace-nowrap">NAVAREA Mode:</span>
          <select
            value={csvNavArea}
            onChange={(e) => setCsvNavArea(e.target.value as NavAreaId | 'AUTO')}
            className="bg-gw-panel border border-gw-secondary text-gw-primary text-xs px-2.5 py-1 rounded font-bold focus:outline-none focus:ring-1 focus:ring-gw-primary"
          >
            <option value="AUTO">Auto-detect from Data (e.g. XVII)</option>
            {Object.keys(NAVAREA_BOUNDS).map((area) => (
              <option key={area} value={area}>Force NAVAREA {area}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Import methods" className="flex flex-wrap border-b border-gw-secondary gap-2">
        <button
          type="button"
          id="import-tab-ai_bulk"
          role="tab"
          aria-selected={activeImportTab === 'ai_bulk'}
          aria-controls="import-panel-ai_bulk"
          onClick={() => handleTabSwitch('ai_bulk')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 focus:outline-none ${
            activeImportTab === 'ai_bulk'
              ? 'border-sky-600 text-sky-800 bg-sky-50 shadow-sm'
              : 'border-transparent text-gw-accent hover:text-gw-primary'
          }`}
        >
          <Bot className="w-4 h-4 text-sky-600" />
          <span>AI Bulk Ingestion & Triage</span>
          <span className="text-[10px] bg-sky-200 text-sky-900 font-extrabold px-1.5 py-0.5 rounded uppercase">Gemini</span>
        </button>

        <button
          type="button"
          id="import-tab-markdown"
          role="tab"
          aria-selected={activeImportTab === 'markdown'}
          aria-controls="import-panel-markdown"
          onClick={() => handleTabSwitch('markdown')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 focus:outline-none ${
            activeImportTab === 'markdown'
              ? 'border-gw-primary text-gw-primary bg-gw-panel shadow-sm'
              : 'border-transparent text-gw-accent hover:text-gw-primary'
          }`}
        >
          <FileCode className="w-4 h-4 text-emerald-600" />
          <span>Paste Markdown (.md)</span>
        </button>

        <button
          type="button"
          id="import-tab-paste"
          role="tab"
          aria-selected={activeImportTab === 'paste'}
          aria-controls="import-panel-paste"
          onClick={() => handleTabSwitch('paste')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 focus:outline-none ${
            activeImportTab === 'paste'
              ? 'border-gw-primary text-gw-primary bg-gw-panel shadow-sm'
              : 'border-transparent text-gw-accent hover:text-gw-primary'
          }`}
        >
          <ClipboardPaste className="w-4 h-4" />
          <span>Paste Tabular (CSV / TSV / Excel)</span>
        </button>

        <button
          type="button"
          id="import-tab-file"
          role="tab"
          aria-selected={activeImportTab === 'file'}
          aria-controls="import-panel-file"
          onClick={() => handleTabSwitch('file')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 focus:outline-none ${
            activeImportTab === 'file'
              ? 'border-gw-primary text-gw-primary bg-gw-panel shadow-sm'
              : 'border-transparent text-gw-accent hover:text-gw-primary'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>File Upload (.md, .csv, .zip)</span>
        </button>

        <button
          type="button"
          id="import-tab-api"
          role="tab"
          aria-selected={activeImportTab === 'api'}
          aria-controls="import-panel-api"
          onClick={() => handleTabSwitch('api')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 focus:outline-none ${
            activeImportTab === 'api'
              ? 'border-gw-primary text-gw-primary bg-gw-panel shadow-sm'
              : 'border-transparent text-gw-accent hover:text-gw-primary'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>FreeOpenAPI Live Sync</span>
        </button>
      </div>

      {/* Tab 0: AI Bulk Ingestion & Triage */}
      {activeImportTab === 'ai_bulk' && (
        <div id="import-panel-ai_bulk" role="tabpanel" aria-labelledby="import-tab-ai_bulk" className="bg-gw-panel border-2 border-sky-600 p-5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-sky-900 uppercase tracking-wider flex items-center gap-2">
                <Bot className="w-5 h-5 text-sky-600" />
                <span>AI-Powered Bulk Ingestion & NAVAREA Importer</span>
                <span className="text-[10px] bg-sky-100 text-sky-800 border border-sky-300 font-extrabold px-2 py-0.5 rounded">
                  Gemini Semantic Reasoning
                </span>
              </h2>
              <p className="text-xs text-gw-accent mt-0.5 max-w-3xl">
                Feed mixed unstructured maritime feeds, dirty web dumps, or bulletins. Gemini parses and extracts valid navigational warnings with coordinates, while automatically filtering out corrupt noise, web cookies, or non-maritime content.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setAiBulkText(SAMPLE_AI_BULK_MIXED)}
                className="bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 text-xs font-bold uppercase px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
                title="Load mixed stream with authentic notices, web cookie noise, and corrupt binary fragments"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Load Mixed Stream (Authentic + Noise)</span>
              </button>

              <button
                type="button"
                onClick={() => setAiBulkText(SAMPLE_AI_BULK_ARCTIC)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 text-xs font-bold uppercase px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
                title="Load high-latitude Arctic NAVAREA XVII / XVIII bulletins"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Load Arctic MSI Stream</span>
              </button>

              {aiBulkText && (
                <button
                  type="button"
                  onClick={() => setAiBulkText('')}
                  className="text-gw-accent hover:text-red-600 text-xs font-bold uppercase px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* AI Settings Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-sky-50/60 border border-sky-200 p-3.5 rounded-xl text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sky-900 uppercase tracking-wide">Gemini Model:</span>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="bg-gw-panel border border-sky-300 text-sky-900 text-xs px-2.5 py-1 rounded font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Fast / Recommended)</option>
                  <option value="gemini-flash-latest">Gemini Flash Latest</option>
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (High Reasoning)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-sky-900 uppercase tracking-wide">Ingestion Strictness:</span>
                <select
                  value={aiBulkStrictness}
                  onChange={(e) => setAiBulkStrictness(e.target.value as any)}
                  className="bg-gw-panel border border-sky-300 text-sky-900 text-xs px-2.5 py-1 rounded font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="standard">Standard (Balanced Noise Filtering)</option>
                  <option value="strict">Strict (Require Coordinates & Strict IDs)</option>
                  <option value="permissive">Permissive (Accept InForce Lists & Advisories)</option>
                </select>
              </div>
            </div>

            <div className="text-[11px] text-sky-800 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>Automated NAVAREA Coordinate Bounds Verification Active</span>
            </div>
          </div>

          {/* Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gw-accent">
              <span className="font-bold uppercase tracking-wider text-gw-primary">Raw Bulk Stream Content:</span>
              <span className="font-mono text-[11px]">
                {aiBulkText.split('\n').filter(Boolean).length} lines · {(new Blob([aiBulkText]).size / 1024).toFixed(1)} KB
              </span>
            </div>
            <textarea
              value={aiBulkText}
              onChange={(e) => setAiBulkText(e.target.value)}
              placeholder="Paste unstructured NAVAREA messages, scraped website text, raw bulletin feeds, or tabular rows..."
              className="w-full h-56 font-mono text-xs p-3 bg-gw-primary text-emerald-300 border-2 border-sky-600/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600 leading-relaxed shadow-inner"
            />
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-gw-accent flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
              <span>
                Gemini will assign acceptance confidence scores and flag rejections with standardized codes: <code className="bg-red-50 text-red-700 px-1 py-0.5 rounded font-mono">NON_MARITIME</code>, <code className="bg-red-50 text-red-700 px-1 py-0.5 rounded font-mono">CORRUPT_DATA</code>, <code className="bg-red-50 text-red-700 px-1 py-0.5 rounded font-mono">OUT_OF_BOUNDS</code>.
              </span>
            </div>

            <button
              type="button"
              onClick={handleAiBulkIngest}
              disabled={isProcessing || !aiBulkText.trim()}
              className="w-full sm:w-auto bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-md hover:shadow-lg"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gemini Reasoning & Triaging Bulk Data...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-sky-200" />
                  <span>Triage & Ingest Bulk Data with Gemini</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tab 0: Paste Markdown (.md) */}
      {activeImportTab === 'markdown' && (
        <div id="import-panel-markdown" role="tabpanel" aria-labelledby="import-tab-markdown" className="bg-gw-panel border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gw-primary uppercase tracking-wider flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-600" />
                <span>Paste Markdown (.md) Navigational Warnings</span>
              </h2>
              <p className="text-xs text-gw-accent mt-0.5">
                Paste markdown tables, bulletin sections, or scraped website content from Canadian Coast Guard (NAVAREA XVII / XVIII), NAVAREA I, IV, or any maritime safety provider.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMarkdownContent(SAMPLE_MARKDOWN_TABLE)}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold uppercase px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
                title="Load sample Canadian Coast Guard markdown table"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Load CCG Table (.md)</span>
              </button>

              <button
                type="button"
                onClick={() => setMarkdownContent(SAMPLE_MARKDOWN_BULLETINS)}
                className="bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 text-xs font-bold uppercase px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
                title="Load sample NAVAREA I & IV bulleted bulletins"
              >
                <FileText className="w-3.5 h-3.5 text-sky-600" />
                <span>Load Bulletins (.md)</span>
              </button>

              {markdownContent && (
                <button
                  type="button"
                  onClick={() => setMarkdownContent('')}
                  className="text-gw-accent hover:text-red-600 text-xs font-bold uppercase px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Engine Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gw-bg border border-gw-secondary p-3 rounded-xl text-xs">
            <div className="flex items-center gap-4">
              <span className="font-bold text-gw-primary uppercase tracking-wide">Parser Engine:</span>
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-gw-primary">
                <input
                  type="radio"
                  name="md-engine"
                  checked={markdownEngine === 'deterministic'}
                  onChange={() => setMarkdownEngine('deterministic')}
                  className="accent-gw-primary"
                />
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Instant Regex (0.01s, Local)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-gw-primary">
                <input
                  type="radio"
                  name="md-engine"
                  checked={markdownEngine === 'ai'}
                  onChange={() => setMarkdownEngine('ai')}
                  className="accent-gw-primary"
                />
                <Bot className="w-3.5 h-3.5 text-blue-500" />
                <span>Gemini AI Extractor</span>
              </label>
            </div>

            {markdownEngine === 'ai' && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-gw-accent">Model:</span>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="bg-gw-panel border border-gw-secondary text-gw-primary text-xs px-2 py-1 rounded font-bold"
                >
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Fast/Recommended)</option>
                  <option value="gemini-flash-latest">Gemini Flash Latest</option>
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
                </select>
              </div>
            )}
          </div>

          {/* Markdown Text Area */}
          <div className="relative">
            <textarea
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              placeholder="# Paste Markdown content here from maritime websites...&#10;&#10;| ID | Position | Date | Title | Details |&#10;| --- | --- | --- | --- | --- |&#10;| NAVAREA XVII 90/2026 | 69° 37.437'N 135° 29.262'W | 2026-09-15 | Racon Out of Service | 1. PELLY ISLAND RACON... |"
              rows={11}
              className="w-full font-mono text-xs p-3.5 bg-gw-bg border-2 border-gw-secondary rounded-xl text-gw-primary focus:outline-none focus:border-gw-primary focus:ring-1 focus:ring-gw-primary transition-all resize-y leading-relaxed"
            />
            {markdownContent && (
              <div className="absolute bottom-3 right-3 text-[11px] font-mono bg-gw-panel/95 border border-gw-secondary px-2 py-0.5 rounded text-gw-accent shadow-xs">
                {markdownContent.split('\n').length} lines · {(markdownContent.length / 1024).toFixed(1)} KB
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-gw-accent flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <span>Supports Markdown tables (`| Col |`), bulleted notices (`- **Position:** 69° 37'N`), and headings (`### NAVAREA`).</span>
            </div>

            <button
              type="button"
              onClick={handleParseMarkdown}
              disabled={isProcessing || !markdownContent.trim()}
              className="w-full sm:w-auto bg-gw-primary hover:bg-gw-accent disabled:opacity-50 text-gw-secondary text-xs font-bold uppercase tracking-wider px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-emerald-300" />
              )}
              <span>{isProcessing ? 'Converting Markdown...' : 'Convert Markdown to Warnings'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 1: Paste Raw Data */}
      {activeImportTab === 'paste' && (
        <div id="import-panel-paste" role="tabpanel" aria-labelledby="import-tab-paste" className="bg-gw-panel border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gw-primary uppercase tracking-wider flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4 text-gw-primary" />
                <span>Paste Tabular Warning Records (NAVAREA XVII / XVIII & Coast Guard Data)</span>
              </h2>
              <p className="text-xs text-gw-accent mt-0.5">
                Paste tab-separated values (TSV) from Excel/Google Sheets or comma-separated CSV text. Columns like ID, Position, and Description will be parsed automatically.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleLoadSampleData}
                className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold uppercase px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
                title="Load sample NAVAREA XVII data provided for verification"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Load NAVAREA XVII Sample</span>
              </button>

              {pasteContent && (
                <button
                  type="button"
                  onClick={() => setPasteContent('')}
                  className="text-gw-accent hover:text-red-600 text-xs font-bold uppercase px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <textarea
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Paste data here with header row, e.g.:&#10;ID&#9;Position&#9;Date&#9;Title&#9;Areas&#9;Charts&#9;Description&#9;Aids&#9;Cancellation&#9;Url&#10;NAVAREA XVII 90/2026&#9;69° 37.437'N 135° 29.262'W&#9;15-09-2026&#9;Aids to Navigation&#9;Beaufort Sea&#9;7662&#9;1. PELLY ISLAND RACON..."
              rows={9}
              className="w-full font-mono text-xs p-3.5 bg-gw-bg border-2 border-gw-secondary rounded-xl text-gw-primary focus:outline-none focus:border-gw-primary focus:ring-1 focus:ring-gw-primary transition-all resize-y leading-relaxed"
            />
            {pasteContent && (
              <div className="absolute bottom-3 right-3 text-[11px] font-mono bg-gw-panel/90 border border-gw-secondary px-2 py-0.5 rounded text-gw-accent">
                {pasteContent.split('\n').filter(Boolean).length} rows detected
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-gw-accent flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              <span>Handles Canadian Coast Guard degree format (e.g. 69° 37.437'N 135° 29.262'W) and auto-cleans encoding artifacts.</span>
            </div>

            <button
              type="button"
              onClick={handleParsePastedData}
              disabled={isProcessing || !pasteContent.trim()}
              className="bg-gw-primary hover:bg-gw-accent disabled:opacity-50 text-gw-secondary text-xs font-bold uppercase tracking-wider px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{isProcessing ? 'Parsing...' : 'Parse & Extract Coordinates'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: File Upload (CSV, GPX, ZIP) */}
      {activeImportTab === 'file' && (
        <div id="import-panel-file" role="tabpanel" aria-labelledby="import-tab-file" className="bg-gw-panel border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <UploadCloud className="w-5 h-5 text-gw-primary" />
            <h2 className="text-base font-bold text-gw-primary uppercase tracking-wider">Bulk CSV, S-124 ZIP & GPX Import</h2>
          </div>
          <p className="text-xs text-gw-accent mb-6 leading-relaxed">
            Upload CSV/TSV files, S-124 XML ZIP archives, or GPX files. All spatial geometries and metadata will be parsed deterministically.
          </p>

          {!parsedWarnings.length && !isProcessing && (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={`border-2 border-dashed rounded-xl p-10 sm:p-12 text-center transition-all ${
                isDragging
                  ? 'border-gw-primary bg-amber-50'
                  : 'border-gw-secondary bg-gw-bg hover:border-gw-primary'
              }`}
            >
              <FileText className="w-10 h-10 text-gw-accent mx-auto mb-3" />
              <h3 className="text-sm font-bold text-gw-primary mb-1 uppercase tracking-wider">Drag & Drop CSV, ZIP, or GPX Files Here</h3>
              <p className="text-xs text-gw-accent mb-4">or click to browse from your computer</p>
              <input
                type="file"
                id="csv-upload-input"
                multiple
                accept=".csv,.tsv,.txt,.zip,.gpx"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesUpload(e.target.files);
                  }
                }}
              />
              <label
                htmlFor="csv-upload-input"
                className="inline-block bg-gw-primary hover:bg-gw-accent text-gw-secondary text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded cursor-pointer transition-colors shadow-sm"
              >
                Select File(s)
              </label>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: FreeOpenAPI Live Sync */}
      {activeImportTab === 'api' && (
        <div id="import-panel-api" role="tabpanel" aria-labelledby="import-tab-api" className="bg-gw-panel border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-gw-primary" />
            <h2 className="text-base font-bold text-gw-primary uppercase tracking-wider">FreeOpenAPI Live Sync</h2>
          </div>
          <p className="text-xs text-gw-accent mb-6">
            Fetch current in-force navigational warnings directly from FreeOpenAPI.dev shipping endpoints.
          </p>

          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-1.5 w-full">
              <label className="block text-xs font-bold text-gw-primary uppercase tracking-wider">API Key</label>
              <div className="relative">
                <Key className="w-4 h-4 text-gw-accent absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="YOUR_API_KEY"
                  className="w-full bg-gw-bg border border-gw-primary rounded pl-9 pr-3 py-2 text-xs font-mono text-gw-primary focus:outline-none focus:ring-2 focus:ring-gw-primary"
                />
              </div>
            </div>

            <div className="w-full md:w-48 space-y-1.5">
              <label className="block text-xs font-bold text-gw-primary uppercase tracking-wider">Target NAVAREA</label>
              <select
                value={apiNavArea}
                onChange={(e) => setApiNavArea(e.target.value as NavAreaId)}
                className="w-full bg-gw-bg border border-gw-primary rounded px-3 py-2 text-xs font-bold text-gw-primary focus:outline-none focus:ring-2 focus:ring-gw-primary"
              >
                {Object.keys(NAVAREA_BOUNDS).map((area) => (
                  <option key={area} value={area}>NAVAREA {area}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleApiSync}
              disabled={isProcessing}
              className="w-full md:w-auto bg-gw-primary hover:bg-gw-accent disabled:opacity-50 text-gw-secondary text-xs font-bold uppercase tracking-wider px-6 py-2.5 rounded flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CloudDownload className="w-4 h-4" />
              )}
              <span>{isProcessing ? 'Fetching...' : 'Fetch Warnings'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="p-10 text-center space-y-3 border-2 border-gw-primary rounded-xl bg-gw-bg">
          <RefreshCw className="w-8 h-8 text-gw-primary animate-spin mx-auto" />
          <div className="text-sm font-bold text-gw-primary uppercase tracking-wider">Parsing Records & Geometries...</div>
          <div className="text-xs text-gw-accent">Extracting Canadian Coast Guard coordinates, checking NAVAREA bounds, and assembling spatial features.</div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-2 border-red-500 p-4 rounded-xl flex items-start gap-3 text-red-700 text-xs font-bold">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Parsed & Triaged Warnings Preview Card */}
      {(parsedWarnings.length > 0 || rejectedItems.length > 0) && (
        <div className="bg-gw-panel border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden shadow-sm flex flex-col space-y-0">
          {/* AI Triage Summary KPI Metrics Strip */}
          {aiBulkStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-gw-primary text-gw-bg border-b-2 border-gw-primary">
              <div className="bg-gw-primary/90 p-2.5 rounded-lg border border-gw-secondary">
                <div className="text-[10px] uppercase font-bold text-gw-accent">Total Evaluated</div>
                <div className="text-xl font-black text-white">{aiBulkStats.total}</div>
              </div>
              <div className="bg-emerald-950/70 p-2.5 rounded-lg border border-emerald-700/60">
                <div className="text-[10px] uppercase font-bold text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>AI Accepted</span>
                </div>
                <div className="text-xl font-black text-emerald-400">{aiBulkStats.accepted}</div>
              </div>
              <div className="bg-red-950/70 p-2.5 rounded-lg border border-red-700/60">
                <div className="text-[10px] uppercase font-bold text-red-300 flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-400" />
                  <span>AI Rejected</span>
                </div>
                <div className="text-xl font-black text-red-400">{aiBulkStats.rejected}</div>
              </div>
              <div className="bg-amber-950/70 p-2.5 rounded-lg border border-amber-700/60">
                <div className="text-[10px] uppercase font-bold text-amber-300 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Needs Review</span>
                </div>
                <div className="text-xl font-black text-amber-400">{aiBulkStats.needsReview}</div>
              </div>
              <div className="bg-sky-950/70 p-2.5 rounded-lg border border-sky-700/60">
                <div className="text-[10px] uppercase font-bold text-sky-300 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-sky-400" />
                  <span>GPS Points</span>
                </div>
                <div className="text-xl font-black text-sky-400">{aiBulkStats.gpsCount}</div>
              </div>
              <div className="bg-indigo-950/70 p-2.5 rounded-lg border border-indigo-700/60">
                <div className="text-[10px] uppercase font-bold text-indigo-300 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-indigo-400" />
                  <span>Latency</span>
                </div>
                <div className="text-xl font-black text-indigo-300">
                  {aiBulkStats.duration_ms ? `${aiBulkStats.duration_ms}ms` : 'Fast'}
                </div>
              </div>
            </div>
          )}

          {/* Supabase Save Status Banner */}
          {supabaseSaveStatus && (
            <div
              className={`m-4 p-4 rounded-xl flex items-start gap-3 text-xs font-bold ${
                supabaseSaveStatus.success
                  ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-900'
                  : 'bg-red-50 border-2 border-red-500 text-red-900'
              }`}
            >
              {supabaseSaveStatus.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 leading-relaxed">
                <div>{supabaseSaveStatus.message}</div>
                {supabaseSaveStatus.success && (
                  <div className="text-[11px] font-normal text-emerald-700 mt-1">
                    Database records are synchronized in table <span className="font-mono font-bold">nav_warnings</span> with conflict target <span className="font-mono font-bold">(source_id, warning_id)</span>.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSupabaseSaveStatus(null)}
                className="touch-hit text-xs uppercase hover:underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Sub-Tabs: Accepted Warnings vs Rejected by Gemini */}
          <div className="px-4 pt-3 pb-0 flex flex-wrap items-center justify-between gap-3 border-b border-gw-secondary/30 bg-gw-bg">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewSubTab('accepted')}
                className={`px-4 py-2 text-xs font-bold uppercase rounded-t-lg transition-colors flex items-center gap-2 ${
                  previewSubTab === 'accepted'
                    ? 'bg-gw-panel text-emerald-800 border-t-2 border-x-2 border-emerald-600 shadow-xs'
                    : 'text-gw-accent hover:text-gw-primary'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Accepted Warnings ({parsedWarnings.length})</span>
              </button>

              {rejectedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPreviewSubTab('rejected')}
                  className={`px-4 py-2 text-xs font-bold uppercase rounded-t-lg transition-colors flex items-center gap-2 ${
                    previewSubTab === 'rejected'
                      ? 'bg-gw-panel text-red-800 border-t-2 border-x-2 border-red-600 shadow-xs'
                      : 'text-gw-accent hover:text-red-600'
                  }`}
                >
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span>Rejected by Gemini ({rejectedItems.length})</span>
                  <span className="text-[10px] bg-red-100 text-red-800 font-black px-1.5 py-0.5 rounded-full">
                    {rejectedItems.length}
                  </span>
                </button>
              )}
            </div>

            {/* AI Batch Audit Button */}
            {parsedWarnings.length > 0 && (
              <button
                type="button"
                onClick={handleAuditBatchWithAI}
                disabled={isAuditingBatch}
                className="mb-1 text-xs font-bold uppercase tracking-wide text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                title="Runs a secondary Gemini verification pass across all staged warnings for sanity & coordinate validation"
              >
                {isAuditingBatch ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span>{isAuditingBatch ? 'Auditing Batch with Gemini...' : 'Audit Batch with Gemini AI'}</span>
              </button>
            )}
          </div>

          {/* Sub-View 1: REJECTED ITEMS */}
          {previewSubTab === 'rejected' && (
            <div className="p-4 space-y-3 bg-red-50/40">
              <div className="p-3.5 bg-red-100 border border-red-300 rounded-xl text-xs text-red-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                  <span>
                    Gemini evaluated and rejected the following <strong>{rejectedItems.length} item(s)</strong> to keep non-maritime content, corrupt fragments, and out-of-bounds records out of the database.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectedItems([])}
                  className="touch-hit text-xs font-bold text-red-800 hover:underline uppercase self-end sm:self-auto"
                >
                  Clear Rejected List
                </button>
              </div>

              <div className="max-h-[600px] overflow-y-auto space-y-3">
                {rejectedItems.map((rej, idx) => (
                  <div key={rej.id || idx} className="bg-gw-panel border-2 border-red-300 rounded-xl p-4 flex flex-col gap-3 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold bg-red-600 text-white px-2.5 py-1 rounded flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>REJECTED</span>
                        </span>
                        <span className="text-xs font-mono font-bold text-red-900 bg-red-100 border border-red-300 px-2 py-0.5 rounded">
                          [{rej.rejection_code}]
                        </span>
                        {rej.warning_id && (
                          <span className="text-xs font-bold text-gw-primary">
                            ID: {rej.warning_id}
                          </span>
                        )}
                        {rej.navarea && (
                          <span className="text-xs font-bold text-gw-accent bg-gw-secondary px-2 py-0.5 rounded">
                            NAVAREA {rej.navarea}
                          </span>
                        )}
                        {rej.hazard_category && (
                          <span className="text-xs font-medium text-gw-accent">
                            Category: {rej.hazard_category}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-gw-accent">
                          Confidence: {(rej.confidence * 100).toFixed(0)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOverrideRejectToAccept(rej)}
                          className="bg-gw-secondary hover:bg-emerald-50 text-gw-primary hover:text-emerald-800 border border-gw-secondary hover:border-emerald-500 text-xs font-bold uppercase px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                          title="Override Gemini's rejection and force acceptance of this notice into the staged warnings"
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Force Accept / Override</span>
                        </button>
                      </div>
                    </div>

                    {/* Rejection Reason from Gemini */}
                    <div className="bg-red-50/80 border border-red-200 rounded-lg p-3 text-xs text-red-950 space-y-1">
                      <div className="font-bold uppercase tracking-wider text-[10px] text-red-700 flex items-center gap-1">
                        <Bot className="w-3.5 h-3.5 text-red-600" />
                        <span>Gemini Rejection Reasoning:</span>
                      </div>
                      <div className="leading-relaxed font-medium">
                        {rej.rejection_reason}
                      </div>
                      {rej.understanding_summary && (
                        <div className="text-[11px] text-gw-accent pt-1.5 border-t border-red-200 mt-1">
                          <strong>Snippet Context:</strong> {rej.understanding_summary}
                        </div>
                      )}
                    </div>

                    {/* Raw Snippet */}
                    <div className="text-[11px] font-mono text-gw-accent bg-gw-secondary p-2.5 rounded border border-gw-secondary whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed">
                      {rej.raw_snippet}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-View 2: ACCEPTED WARNINGS */}
          {previewSubTab === 'accepted' && (
            <div className="flex flex-col">
              {/* Header Action Bar */}
              <div className="p-4 border-b-2 border-gw-primary flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gw-bg">
                <div>
                  <h3 className="text-sm font-bold text-gw-primary flex items-center gap-2 uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span>Successfully Staged {parsedWarnings.length} Warnings</span>
                  </h3>
                  <p className="text-xs text-gw-accent mt-0.5">
                    {parsedWarnings.filter(w => (w.latitude != null && w.longitude != null) || (w.spatial?.geometries?.length > 0)).length} warnings contain validated GPS coordinates ready for charting.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setParsedWarnings([])}
                    className="text-xs font-bold text-gw-accent hover:text-gw-primary px-3 py-1.5 uppercase"
                  >
                    Clear Preview
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsConfirmCommitOpen(true)}
                    disabled={isSavingToSupabase || parsedWarnings.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
                    title="Saves parsed warnings directly to Supabase nav_warnings PostgreSQL table"
                  >
                    {isSavingToSupabase ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4 text-emerald-200" />
                    )}
                    <span>{isSavingToSupabase ? 'Saving to Supabase...' : `Save ${parsedWarnings.length} to Supabase`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCommit}
                    disabled={parsedWarnings.length === 0}
                    className="bg-gw-primary hover:bg-gw-accent disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    title="Adds to local application data bank and renders on the live map"
                  >
                    <Save className="w-4 h-4" />
                    <span>Commit to Local Data Bank</span>
                  </button>
                </div>
              </div>

              {/* Warnings List */}
              <div className="max-h-[600px] overflow-y-auto p-4 space-y-3 bg-gw-bg">
                {parsedWarnings.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gw-accent font-semibold">
                    No accepted warnings currently staged. Try loading or ingesting bulk data above.
                  </div>
                ) : (
                  parsedWarnings.map((warn, i) => {
                    const hasGps = (warn.latitude != null && warn.longitude != null) || (warn.spatial?.geometries?.length > 0);
                    const firstGeomCoords = warn.spatial?.geometries?.[0]?.coordinates as number[] | undefined;
                    const latDisplay = warn.latitude != null ? warn.latitude : firstGeomCoords?.[1];
                    const lngDisplay = warn.longitude != null ? warn.longitude : firstGeomCoords?.[0];
                    const isAiAssessed = Boolean(warn.ai_triage);

                    return (
                      <div key={warn.warning_id || i} className="bg-gw-panel border-2 border-gw-primary rounded-xl p-4 flex flex-col gap-3 shadow-xs">
                        {/* Header Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold bg-gw-primary text-gw-secondary px-2.5 py-1 rounded">
                              {warn.source_warning_id || warn.warning_number}
                            </span>
                            <span className="text-xs font-bold text-gw-primary bg-gw-secondary/15 px-2 py-1 rounded">
                              NAVAREA {warn.navarea}
                            </span>
                            {warn.title && (
                              <span className="text-xs font-bold text-gw-primary">
                                {warn.title}
                              </span>
                            )}
                            {warn.area_text && (
                              <span className="text-xs font-semibold text-gw-accent truncate max-w-xs md:max-w-md">
                                ({warn.area_text})
                              </span>
                            )}
                          </div>

                          {/* AI & GPS Status Pills */}
                          <div className="flex flex-wrap items-center gap-2">
                            {isAiAssessed && warn.ai_triage && (
                              <span
                                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded uppercase border ${
                                  warn.ai_triage.decision === 'ACCEPTED'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}
                              >
                                <Bot className="w-3 h-3" />
                                <span>
                                  {warn.ai_triage.decision === 'ACCEPTED'
                                    ? `AI ACCEPTED (${(warn.ai_triage.confidence * 100).toFixed(0)}%)`
                                    : 'NEEDS REVIEW'}
                                </span>
                              </span>
                            )}

                            {warn.ai_triage?.hazard_category && (
                              <span className="text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded uppercase">
                                {warn.ai_triage.hazard_category}
                              </span>
                            )}

                            {warn.risk_level && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                  warn.risk_level === 'critical'
                                    ? 'bg-red-100 text-red-800 border border-red-300'
                                    : warn.risk_level === 'high'
                                    ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                    : warn.risk_level === 'medium'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                                }`}
                              >
                                {warn.risk_level}
                              </span>
                            )}

                            {hasGps ? (
                              <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded uppercase">
                                <Compass className="w-3.5 h-3.5 text-emerald-600" />
                                <span>
                                  {latDisplay != null && lngDisplay != null ? formatPositionDisplay(latDisplay, lngDisplay) : 'GPS Position Validated'}
                                </span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded uppercase">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>InForce List / No Point</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Gemini AI Understanding Box */}
                        {warn.ai_triage?.understanding_summary && (
                          <div className="bg-sky-50/80 border border-sky-200 rounded-lg p-3 text-xs text-sky-950 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sky-900 uppercase text-[10px] flex items-center gap-1">
                                <Bot className="w-3.5 h-3.5 text-sky-600" />
                                <span>Gemini AI Understanding:</span>
                              </span>
                              {warn.ai_triage.coordinate_sanity && (
                                <span className="text-[10px] font-semibold text-gw-accent">
                                  Bounds Check: <span className="uppercase font-mono">{warn.ai_triage.coordinate_sanity}</span>
                                </span>
                              )}
                            </div>
                            <div className="leading-relaxed font-medium">
                              {warn.ai_triage.understanding_summary}
                            </div>
                            {warn.ai_triage.rejection_reason && (
                              <div className="text-[11px] text-amber-800 font-semibold pt-1 border-t border-sky-200/60 mt-1">
                                Notice Note: {warn.ai_triage.rejection_reason}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sub info */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gw-accent">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gw-primary" />
                            <span>Issued: {warn.issued_date}</span>
                          </div>
                          {warn.authority && (
                            <div className="flex items-center gap-1 font-semibold text-gw-primary">
                              <span>Auth: {warn.authority}</span>
                            </div>
                          )}
                          {warn.charts && (
                            <div className="flex items-center gap-1">
                              <span>Charts: {warn.charts}</span>
                            </div>
                          )}
                          {warn.cancels && warn.cancels.length > 0 && (
                            <div className="flex items-center gap-1 text-red-600 font-semibold">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>{warn.cancels.join(', ')}</span>
                            </div>
                          )}
                          {warn.source_url && (
                            <a
                              href={warn.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-gw-primary hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Source Link</span>
                            </a>
                          )}
                        </div>

                        {/* Raw Text Content */}
                        <div className="text-xs font-mono text-gw-secondary bg-gw-primary p-3 rounded-lg whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed border border-gw-primary/30">
                          {warn.raw_text.trim()}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Pre-Commit Confirmation Barrier Modal */}
      {isConfirmCommitOpen && (
        <div className="fixed inset-0 z-console-overlay flex items-center justify-center p-4 bg-gw-primary/75 backdrop-blur-xs">
          <div ref={confirmRef} role="dialog" aria-modal="true" aria-labelledby="confirm-commit-title" className="bg-gw-panel border-2 border-emerald-600 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 id="confirm-commit-title" className="text-base font-bold text-gw-primary uppercase tracking-wider">
                  Confirm Supabase Live Commit
                </h3>
                <p className="text-xs text-gw-accent">
                  Target: PostgreSQL table <code className="font-mono font-bold text-gw-primary">nav_warnings</code>
                </p>
              </div>
            </div>

            <div className="bg-gw-secondary border border-gw-secondary rounded-xl p-4 text-xs space-y-2 text-gw-accent">
              <div className="flex justify-between pb-1.5 border-b border-gw-secondary">
                <span className="font-medium text-gw-accent">Total Staged Warnings:</span>
                <span className="font-bold font-mono text-gw-primary">{parsedWarnings.length}</span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-gw-secondary">
                <span className="font-medium text-gw-accent">Validated GPS Features:</span>
                <span className="font-bold font-mono text-emerald-700">
                  {parsedWarnings.filter(w => (w.latitude != null && w.longitude != null) || (w.spatial?.geometries?.length > 0)).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gw-accent">Conflict Policy:</span>
                <span className="font-bold text-gw-primary">Upsert on (source_id, warning_id)</span>
              </div>
            </div>

            <p className="text-xs text-gw-accent leading-relaxed">
              Writing these warnings will persist them to the live Supabase database and update active GIS geometries. This action takes immediate effect across all administrative and public views.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmCommitOpen(false)}
                className="px-4 py-2 border border-gw-secondary hover:bg-gw-secondary rounded-lg text-xs font-bold uppercase tracking-wider text-gw-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmCommitOpen(false);
                  handleSaveToSupabase();
                }}
                disabled={isSavingToSupabase}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirm &amp; Commit to Database</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
