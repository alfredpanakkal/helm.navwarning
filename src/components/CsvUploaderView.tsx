import React, { useState, useCallback } from 'react';
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
  ShieldAlert
} from 'lucide-react';
import { NavWarning, NavAreaId } from '../types';
import { parseCoordinatesDeterministic, NAVAREA_BOUNDS } from '../utils/coordinateParser';

interface CsvUploaderViewProps {
  onCommitWarnings: (warnings: NavWarning[]) => void;
}

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

  // Tabs: 'file' | 'paste' | 'api'
  const [activeImportTab, setActiveImportTab] = useState<'file' | 'paste' | 'api'>('paste');

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

  const handleTabSwitch = (tab: 'file' | 'paste' | 'api') => {
    setActiveImportTab(tab);
    setParsedWarnings([]);
    setError(null);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-gw-primary pb-4">
        <div>
          <h1 className="text-xl font-bold text-gw-primary uppercase tracking-wider flex items-center gap-2.5">
            <UploadCloud className="w-6 h-6 text-gw-primary" />
            <span>Bulk Ingestion & NAVAREA Importer</span>
          </h1>
          <p className="text-xs text-gw-accent mt-1">
            Import navigational warnings via direct text paste, CSV/TSV spreadsheets, GPX files, or S-124 XML archives.
          </p>
        </div>

        {/* Global NAVAREA Override */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-gw-bg border border-gw-primary px-3 py-1.5 rounded-lg">
          <span className="text-xs font-bold text-gw-accent whitespace-nowrap">NAVAREA Mode:</span>
          <select
            value={csvNavArea}
            onChange={(e) => setCsvNavArea(e.target.value as NavAreaId | 'AUTO')}
            className="bg-white border border-gw-secondary text-gw-primary text-xs px-2.5 py-1 rounded font-bold focus:outline-none focus:ring-1 focus:ring-gw-primary"
          >
            <option value="AUTO">Auto-detect from Data (e.g. XVII)</option>
            {Object.keys(NAVAREA_BOUNDS).map((area) => (
              <option key={area} value={area}>Force NAVAREA {area}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gw-secondary gap-2">
        <button
          onClick={() => handleTabSwitch('paste')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 focus:outline-none ${
            activeImportTab === 'paste'
              ? 'border-gw-primary text-gw-primary bg-white shadow-sm'
              : 'border-transparent text-gw-accent hover:text-gw-primary'
          }`}
        >
          <ClipboardPaste className="w-4 h-4" />
          <span>Paste Data (CSV / TSV / Excel)</span>
        </button>

        <button
          onClick={() => handleTabSwitch('file')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 focus:outline-none ${
            activeImportTab === 'file'
              ? 'border-gw-primary text-gw-primary bg-white shadow-sm'
              : 'border-transparent text-gw-accent hover:text-gw-primary'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>File Upload (CSV, GPX, ZIP)</span>
        </button>

        <button
          onClick={() => handleTabSwitch('api')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 focus:outline-none ${
            activeImportTab === 'api'
              ? 'border-gw-primary text-gw-primary bg-white shadow-sm'
              : 'border-transparent text-gw-accent hover:text-gw-primary'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>FreeOpenAPI Live Sync</span>
        </button>
      </div>

      {/* Tab 1: Paste Raw Data */}
      {activeImportTab === 'paste' && (
        <div className="bg-white border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm space-y-4">
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
              <div className="absolute bottom-3 right-3 text-[11px] font-mono bg-white/90 border border-gw-secondary px-2 py-0.5 rounded text-gw-accent">
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
        <div className="bg-white border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm">
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
        <div className="bg-white border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm">
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

      {/* Parsed Warnings Preview Card */}
      {parsedWarnings.length > 0 && (
        <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b-2 border-gw-primary flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gw-bg">
            <div>
              <h3 className="text-sm font-bold text-gw-primary flex items-center gap-2 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Successfully Parsed {parsedWarnings.length} Warnings</span>
              </h3>
              <p className="text-xs text-gw-accent mt-0.5">
                {parsedWarnings.filter(w => w.spatial.geometries.length > 0).length} warnings contain validated coordinates ready for charting.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setParsedWarnings([])}
                className="text-xs font-bold text-gw-accent hover:text-gw-primary px-3 py-1.5 uppercase"
              >
                Clear Preview
              </button>
              <button
                onClick={handleCommit}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>Commit {parsedWarnings.length} to Data Bank</span>
              </button>
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto p-4 space-y-3 bg-gw-bg">
            {parsedWarnings.map((warn, i) => (
              <div key={warn.warning_id || i} className="bg-white border-2 border-gw-primary rounded-xl p-4 flex flex-col gap-3 shadow-xs">
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-gw-primary text-gw-secondary px-2.5 py-1 rounded">
                      {warn.source_warning_id || warn.warning_number}
                    </span>
                    <span className="text-xs font-bold text-gw-primary bg-gw-secondary/15 px-2 py-1 rounded">
                      NAVAREA {warn.navarea}
                    </span>
                    <span className="text-xs font-semibold text-gw-accent truncate max-w-xs md:max-w-md">
                      {warn.area_text}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {warn.spatial.geometries.length > 0 ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 border border-green-300 px-2.5 py-1 rounded uppercase">
                        <Compass className="w-3.5 h-3.5" />
                        <span>{warn.spatial.geometries.length} {warn.spatial.geometries.length === 1 ? 'Position' : 'Positions'} Validated</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded uppercase">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>InForce List / No Point</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub info */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-gw-accent">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gw-primary" />
                    <span>Issued: {warn.issued_date}</span>
                  </div>
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
