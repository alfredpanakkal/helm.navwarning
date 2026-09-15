import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Layers, Save, RefreshCw, Key, CloudDownload, Globe } from 'lucide-react';
import { NavWarning, NavAreaId } from '../types';
import { parseCoordinatesDeterministic, NAVAREA_BOUNDS } from '../utils/coordinateParser';

interface CsvUploaderViewProps {
  onCommitWarnings: (warnings: NavWarning[]) => void;
}

export const CsvUploaderView: React.FC<CsvUploaderViewProps> = ({ onCommitWarnings }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [parsedWarnings, setParsedWarnings] = useState<NavWarning[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // FreeOpenAPI state
  const [apiKey, setApiKey] = useState('');
  const [apiNavArea, setApiNavArea] = useState<NavAreaId>('IV');
  
  // CSV Import State
  const [csvNavArea, setCsvNavArea] = useState<NavAreaId | 'AUTO'>('AUTO');

  const processApiData = (data: any[]) => {
    setIsProcessing(true);
    setError(null);

    try {
      const now = new Date();
      const timestampIso = now.toISOString();
      const genId = `gen-api-import-${Date.now()}`;
      const newWarnings: NavWarning[] = [];

      data.forEach((row, index) => {
        // Handle varying possible fields from an unknown external API
        const rawText = row.text || row.message || row.msgText || row.description || row.raw_text || JSON.stringify(row);
        
        if (!rawText || typeof rawText !== 'string') return;

        let warningNumber = row.number || row.id || row.warningNumber || `API-${index + 1}`;
        let warningYear = row.year || row.warningYear || now.getFullYear();

        const spatial = parseCoordinatesDeterministic(rawText, apiNavArea);

        const newWarn: NavWarning = {
          schema_version: 1,
          warning_id: `warn-api-${warningYear}-${warningNumber}-${Date.now()}-${index}`,
          publisher_id: 'freeopenapi-import',
          source_id: 'api-sync',
          navarea: apiNavArea,
          series: `NAVAREA ${apiNavArea}`,
          source_warning_id: `${warningNumber}/${warningYear}`,
          warning_number: warningNumber.toString(),
          warning_year: Number(warningYear),
          issued_at: timestampIso,
          issued_date: now.toISOString().split('T')[0],
          issued_time_precision: 'day',
          issued_text: now.toISOString().split('T')[0],
          valid_from: timestampIso,
          valid_to: null,
          cancelled_at: null,
          status: 'active',
          status_basis: 'manual_csv_import',
          area_text: `API Imported Warning`,
          original_language: 'en',
          raw_text: rawText,
          translated_text: null,
          spatial: spatial,
          supersedes: [],
          cancels: [],
          source_url: 'FreeOpenAPI Live Sync',
          raw_artifact_ref: 'api-sync',
          content_hash: 'api-' + Date.now() + '-' + index,
          parser_version: 'deterministic-v1',
          extraction_method: 'deterministic',
          extraction_confidence: spatial.geometries.length > 0 ? 0.95 : 0.0,
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

      setParsedWarnings(newWarnings);
    } catch (err: any) {
      setError(`Failed to process API data: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApiSync = async () => {
    if (!apiKey) {
      setError('API Key is required to use FreeOpenAPI Live Sync.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/freeopenapi/warnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, navArea: apiNavArea })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || response.statusText);
      }

      const data = await response.json();
      
      // Ensure it's an array
      const arrData = Array.isArray(data) ? data : data.warnings || data.data || [data];
      if (!Array.isArray(arrData) || arrData.length === 0) {
         throw new Error('API returned an empty or unrecognized format.');
      }

      processApiData(arrData);

    } catch (err: any) {
      setError(`FreeOpenAPI Error: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const parseCsvDataToWarnings = (data: any[], genIdPrefix: string = 'csv'): NavWarning[] => {
    const now = new Date();
    const timestampIso = now.toISOString();
    const genId = `gen-${genIdPrefix}-import-${Date.now()}`;

    const newWarnings: NavWarning[] = [];

    data.forEach((row, index) => {
      // Handle Simple Scraper defaults (span for text, b for reference) or explicit names
      const rawText = row.msgText || row.MSGTEXT || row.MsgText || row['warning-description'] || row.span || row.warning_text;
      const status = row.status || row.STATUS || row.Status;

      if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') return;
      if (status && status.toUpperCase() !== 'INFORCE') return; // Skip cancelled warnings if any

      // Basic heuristic to extract NAVAREA and ID
      let navarea: NavAreaId = csvNavArea === 'AUTO' ? 'IV' : csvNavArea; 
      let warningNumber = `CSV-${index + 1}`;
      let warningYear = now.getFullYear();

      // Attempt to parse warning reference from explicit columns, <b> tag, or the text itself
      const warningRefRaw = row['warning-reference'] || row.b || row.warning_id || '';
      const navareaMatch = rawText.match(/NAVAREA\s+([IXV1-9]+)\s+(\d+)\/(\d+)/i) || warningRefRaw.match(/NAVAREA\s+([IXV1-9]+)\s+(\d+)\/(\d+)/i);
      
      if (navareaMatch) {
        // Map arabic numerals back to roman if needed
        const areaRaw = navareaMatch[1].toUpperCase();
        const romanMap: Record<string, string> = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII', '13': 'XIII', '14': 'XIV', '15': 'XV', '16': 'XVI', '17': 'XVII', '18': 'XVIII', '19': 'XIX', '20': 'XX', '21': 'XXI' };
        if (csvNavArea === 'AUTO') {
          navarea = (romanMap[areaRaw] || areaRaw) as NavAreaId;
        }
        warningNumber = navareaMatch[2];
        const yy = parseInt(navareaMatch[3], 10);
        warningYear = yy < 100 ? 2000 + yy : yy;
      } else if (row['warning-type'] && csvNavArea === 'AUTO') {
        const typeMatch = row['warning-type'].match(/NAVAREA\s+([IXV1-9]+)/i);
        if (typeMatch) {
            const areaRaw = typeMatch[1].toUpperCase();
            const romanMap: Record<string, string> = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII', '13': 'XIII', '14': 'XIV', '15': 'XV', '16': 'XVI', '17': 'XVII', '18': 'XVIII', '19': 'XIX', '20': 'XX', '21': 'XXI' };
            navarea = (romanMap[areaRaw] || areaRaw) as NavAreaId;
        }
      } else if (warningRefRaw) {
        // Handle Baltic format: "SWEDISH NAV WARN 150/26"
        const balticMatch = warningRefRaw.match(/(\d+)\/(\d+)/);
        if (balticMatch) {
          warningNumber = balticMatch[1];
          const yy = parseInt(balticMatch[2], 10);
          warningYear = yy < 100 ? 2000 + yy : yy;
          if (csvNavArea === 'AUTO') {
            navarea = 'I'; // Baltic Sea falls under NAVAREA I
          }
        }
      }

      const spatial = parseCoordinatesDeterministic(rawText, navarea);
      const subArea = row.h5 || row.area || row['sub-area'] || '';
      const issueDateRaw = row['warning-date-time'] || row.p || now.toISOString().split('T')[0];

      const newWarn: NavWarning = {
        schema_version: 1,
        warning_id: `warn-${genIdPrefix}-${warningYear}-${warningNumber}-${Date.now()}-${index}`,
        publisher_id: 'csv-scraper', 
        source_id: 'csv-upload',
        navarea,
        series: `NAVAREA ${navarea}`,
        source_warning_id: `${warningNumber}/${warningYear}`,
        warning_number: warningNumber,
        warning_year: warningYear,
        issued_at: timestampIso,
        issued_date: issueDateRaw,
        issued_time_precision: 'day',
        issued_text: issueDateRaw,
        valid_from: timestampIso,
        valid_to: null,
        cancelled_at: null,
        status: 'active',
        status_basis: 'manual_csv_import',
        area_text: subArea ? `Baltic Sea - ${subArea}` : `CSV Imported Warning`,
        original_language: 'en',
        raw_text: rawText,
        translated_text: null,
        spatial: spatial,
        supersedes: [],
        cancels: [],
        source_url: 'Scraper CSV',
        raw_artifact_ref: 'csv-upload',
        content_hash: `${genIdPrefix}-` + Date.now() + '-' + index,
        parser_version: 'deterministic-v1',
        extraction_method: 'deterministic',
        extraction_confidence: spatial.geometries.length > 0 ? 0.95 : 0.0,
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

  const processCsvData = (data: any[]) => {
    setIsProcessing(true);
    setError(null);
    try {
      const newWarnings = parseCsvDataToWarnings(data, 'csv');
      setParsedWarnings(newWarnings);
    } catch (err: any) {
      setError(`Failed to process CSV: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const parseGpxToWarning = (xmlText: string, defaultNavarea: NavAreaId, filename: string, index: number, genId: string): NavWarning => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const metadataName = xmlDoc.querySelector('metadata > name')?.textContent || '';
    const metadataDesc = xmlDoc.querySelector('metadata > desc')?.textContent || '';
    const link = xmlDoc.querySelector('metadata > link')?.getAttribute('href') || '';
    
    let warningNumber = `GPX-${index + 1}`;
    let warningYear = new Date().getFullYear();
    let navarea = defaultNavarea;
    
    const match = metadataName.match(/NAVAREA\s+([IXV1-9]+)\s+(\d+)\/(\d+)/i) || metadataDesc.match(/NAVAREA\s+([IXV1-9]+)\s+(\d+)\/(\d+)/i);
    if (match) {
        const areaRaw = match[1].toUpperCase();
        const romanMap: Record<string, string> = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII', '13': 'XIII', '14': 'XIV', '15': 'XV', '16': 'XVI', '17': 'XVII', '18': 'XVIII', '19': 'XIX', '20': 'XX', '21': 'XXI' };
        navarea = (romanMap[areaRaw] || areaRaw) as NavAreaId;
        warningNumber = match[2];
        const yy = parseInt(match[3], 10);
        warningYear = yy < 100 ? 2000 + yy : yy;
    }
    
    const geometries: any[] = [];
    
    const trks = xmlDoc.querySelectorAll('trk');
    trks.forEach(trk => {
        const trkDesc = trk.querySelector('desc')?.textContent || '';
        const pts = trk.querySelectorAll('trkpt');
        if (pts.length === 1) {
            geometries.push({
                type: 'Point',
                coordinates: [[parseFloat(pts[0].getAttribute('lon') || '0'), parseFloat(pts[0].getAttribute('lat') || '0')]],
                label: trkDesc.trim() || 'Track Point'
            });
        } else if (pts.length > 1) {
            const coords = Array.from(pts).map(pt => [parseFloat(pt.getAttribute('lon') || '0'), parseFloat(pt.getAttribute('lat') || '0')]);
            geometries.push({
                type: 'LineString',
                coordinates: coords,
                label: trkDesc.trim() || 'Track'
            });
        }
    });
    
    const wpts = xmlDoc.querySelectorAll('wpt');
    wpts.forEach(wpt => {
        const wptDesc = wpt.querySelector('desc')?.textContent || '';
        geometries.push({
            type: 'Point',
            coordinates: [[parseFloat(wpt.getAttribute('lon') || '0'), parseFloat(wpt.getAttribute('lat') || '0')]],
            label: wptDesc.trim() || 'Waypoint'
        });
    });
    
    const rtes = xmlDoc.querySelectorAll('rte');
    rtes.forEach(rte => {
         const rteDesc = rte.querySelector('desc')?.textContent || '';
         const pts = rte.querySelectorAll('rtept');
         if (pts.length > 0) {
             const coords = Array.from(pts).map(pt => [parseFloat(pt.getAttribute('lon') || '0'), parseFloat(pt.getAttribute('lat') || '0')]);
             geometries.push({
                type: pts.length === 1 ? 'Point' : 'LineString',
                coordinates: coords,
                label: rteDesc.trim() || 'Route'
             });
         }
    });

    const rawText = `Name: ${metadataName}\nDescription: ${metadataDesc}\n\nGPX Data Extracted.`;
    const now = new Date();
    const timestampIso = now.toISOString();

    return {
          schema_version: 1,
          warning_id: `warn-gpx-${warningYear}-${warningNumber}-${Date.now()}-${index}`,
          publisher_id: 'ping-france', 
          source_id: 'gpx-upload',
          navarea,
          series: `NAVAREA ${navarea}`,
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
          status_basis: 'manual_gpx_import',
          area_text: 'Imported GPX Warning',
          original_language: 'en',
          raw_text: rawText,
          translated_text: null,
          spatial: {
             geometries,
             circles: [],
             raw_coordinate_text: [],
             validation_status: geometries.length > 0 ? 'passed' : 'not_present'
          },
          supersedes: [],
          cancels: [],
          source_url: link || 'GPX Upload',
          raw_artifact_ref: filename,
          content_hash: 'gpx-' + Date.now() + '-' + index,
          parser_version: 'gpx-parser-v1',
          extraction_method: 'deterministic',
          extraction_confidence: geometries.length > 0 ? 1.0 : 0.0,
          first_seen_at: timestampIso,
          last_seen_at: timestampIso,
          not_in_force_observed_at: null,
          generation_id: genId,
          validation: {
            identity: 'passed',
            dates: 'passed',
            geometry: geometries.length > 0 ? 'passed' : 'not_present',
          },
    };
  };

  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    
    setIsProcessing(true);
    setError(null);
    let allWarnings: NavWarning[] = [];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.toLowerCase().endsWith('.zip')) {
          const zip = new JSZip();
          const unzipped = await zip.loadAsync(file);
          const now = new Date();
          const timestampIso = now.toISOString();
          const genId = `gen-zip-import-${Date.now()}`;
          let defaultNav: NavAreaId = csvNavArea === 'AUTO' ? 'II' : csvNavArea;
          
          let index = 0;
          for (const [filename, fileData] of Object.entries(unzipped.files)) {
            if (!fileData.dir) {
              if (filename.toLowerCase().endsWith('.xml')) {
                const xmlText = await fileData.async('text');
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                
                const textNodes = xmlDoc.getElementsByTagName('*');
                let rawText = '';
                let warningNumber = `ZIP-${index + 1}`;
                let warningYear = now.getFullYear();
                let navarea: NavAreaId = defaultNav;
                let areaText = 'Imported S-124 Warning';
                
                for (let j = 0; j < textNodes.length; j++) {
                  const nodeName = textNodes[j].nodeName.toLowerCase();
                  if (nodeName.includes('text') && textNodes[j].textContent) {
                     rawText += textNodes[j].textContent + '\n';
                  }
                  if (nodeName.includes('warningidentifier') && textNodes[j].textContent) {
                     const idText = textNodes[j].textContent || '';
                     const match = idText.match(/(\d+)\/(\d+)/);
                     if (match) {
                       warningNumber = match[1];
                       const yy = parseInt(match[2], 10);
                       warningYear = yy < 100 ? 2000 + yy : yy;
                     }
                  }
                }

                if (!rawText.trim()) {
                   rawText = xmlText;
                }

                const spatial = parseCoordinatesDeterministic(rawText, navarea);
                
                allWarnings.push({
                  schema_version: 1,
                  warning_id: `warn-zip-${warningYear}-${warningNumber}-${Date.now()}-${index}`,
                  publisher_id: 'ping-france', 
                  source_id: 'zip-upload',
                  navarea,
                  series: `NAVAREA ${navarea}`,
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
                  area_text: areaText,
                  original_language: 'en',
                  raw_text: rawText,
                  translated_text: null,
                  spatial: spatial,
                  supersedes: [],
                  cancels: [],
                  source_url: 'S-124 ZIP Payload',
                  raw_artifact_ref: filename,
                  content_hash: 'zip-' + Date.now() + '-' + index,
                  parser_version: 'deterministic-v1',
                  extraction_method: 'deterministic',
                  extraction_confidence: spatial.geometries.length > 0 ? 0.95 : 0.0,
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
              } else if (filename.toLowerCase().endsWith('.gpx')) {
                const gpxText = await fileData.async('text');
                const warn = parseGpxToWarning(gpxText, defaultNav, filename, index, genId);
                allWarnings.push(warn);
                index++;
              }
            }
          }
        } else if (file.name.toLowerCase().endsWith('.gpx')) {
           const gpxText = await file.text();
           const defaultNav: NavAreaId = csvNavArea === 'AUTO' ? 'II' : csvNavArea;
           const warn = parseGpxToWarning(gpxText, defaultNav, file.name, i, `gen-gpx-import-${Date.now()}`);
           allWarnings.push(warn);
        } else if (file.name.toLowerCase().endsWith('.csv')) {
           const csvWarnings = await new Promise<NavWarning[]>((resolve, reject) => {
             Papa.parse(file, {
               header: true,
               skipEmptyLines: true,
               complete: (results) => {
                 if (results.errors.length > 0) {
                   console.warn('CSV Parsing Errors:', results.errors);
                 }
                 try {
                   const warnings = parseCsvDataToWarnings(results.data, `csv-${i}`);
                   resolve(warnings);
                 } catch (e) {
                   reject(e);
                 }
               },
               error: (err) => {
                 reject(new Error(`CSV Parse Error: ${err.message}`));
               }
             });
           });
           allWarnings.push(...csvWarnings);
        }
      }
      
      setParsedWarnings(allWarnings);
    } catch (err: any) {
      setError(`Failed to process files: ${err.message}`);
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

  const [activeImportTab, setActiveImportTab] = useState<'file' | 'api'>('file');

  const handleTabSwitch = (tab: 'file' | 'api') => {
    setActiveImportTab(tab);
    setParsedWarnings([]);
    setError(null);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex border-b-2 border-gw-primary gap-2">
        <button
          onClick={() => handleTabSwitch('file')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary ${
            activeImportTab === 'file'
              ? 'border-gw-primary text-gw-primary bg-white'
              : 'border-transparent text-gw-accent hover:text-gw-primary'
          }`}
        >
          File Upload (CSV, GPX, ZIP)
        </button>
        <button
          onClick={() => handleTabSwitch('api')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary ${
            activeImportTab === 'api'
              ? 'border-gw-primary text-gw-primary bg-white'
              : 'border-transparent text-gw-accent hover:text-gw-primary'
          }`}
        >
          FreeOpenAPI Live Sync
        </button>
      </div>

      {activeImportTab === 'file' && (
        <div className="bg-white border-2 border-gw-primary p-5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <UploadCloud className="w-5 h-5 text-gw-primary" />
            <h2 className="text-base font-bold text-gw-primary uppercase tracking-wider">Bulk CSV, S-124 ZIP & GPX Import</h2>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <p className="text-xs text-gw-accent flex-1 leading-relaxed">
              Upload a CSV file (e.g., NGA), a ZIP file containing S-124 XMLs/GPX, or a direct .gpx file (e.g., French PING). 
              The system will automatically extract spatial geometries and queue them for ingestion.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gw-accent whitespace-nowrap">Default NAVAREA:</span>
              <select
                value={csvNavArea}
                onChange={(e) => setCsvNavArea(e.target.value as NavAreaId | 'AUTO')}
                className="bg-gw-bg border border-gw-primary text-gw-primary text-xs px-3 py-2 rounded font-bold focus:outline-none focus:ring-2 focus:ring-gw-primary"
              >
                <option value="AUTO">Auto-detect from text</option>
                {Object.keys(NAVAREA_BOUNDS).map((area) => (
                  <option key={area} value={area}>NAVAREA {area}</option>
                ))}
              </select>
            </div>
          </div>

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
                accept=".csv,.zip,.gpx"
                multiple
                className="sr-only"
                id="csv-upload-input"
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

          {isProcessing && (
            <div className="p-12 text-center space-y-3 border-2 border-gw-primary rounded-xl bg-gw-bg">
              <RefreshCw className="w-8 h-8 text-gw-primary animate-spin mx-auto" />
              <div className="text-sm font-bold text-gw-primary uppercase tracking-wider">Processing Data...</div>
              <div className="text-xs text-gw-accent">Extracting spatial coordinates and building geometries.</div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border-2 border-red-500 p-4 rounded-xl flex items-start gap-3 text-red-700 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

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
              <label className="block text-xs font-bold text-gw-primary uppercase tracking-wider">NAVAREA</label>
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

      {parsedWarnings.length > 0 && (
        <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden shadow-sm flex flex-col h-[600px]">
          <div className="p-4 border-b-2 border-gw-primary flex items-center justify-between bg-gw-bg shrink-0">
            <div>
              <h3 className="text-sm font-bold text-gw-primary flex items-center gap-2 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Parsed {parsedWarnings.length} Warnings</span>
              </h3>
              <p className="text-xs text-gw-accent mt-0.5">
                Review the extracted spatial geometries before committing them to the Data Bank.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setParsedWarnings([])}
                className="text-xs font-bold text-gw-accent hover:text-gw-primary px-3 py-1.5 uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded flex items-center gap-2 transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>Commit to Data Bank</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gw-bg">
            {parsedWarnings.map((warn, i) => (
              <div key={i} className="bg-white border-2 border-gw-primary rounded-xl p-4 flex flex-col gap-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-gw-primary text-gw-secondary px-2 py-0.5 rounded">
                      {warn.source_warning_id}
                    </span>
                    <span className="text-xs font-bold text-gw-primary">
                      NAVAREA {warn.navarea}
                    </span>
                  </div>
                  {warn.spatial.geometries.length > 0 ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 border border-green-300 px-2 py-0.5 rounded uppercase">
                      <Layers className="w-3 h-3" />
                      {warn.spatial.geometries.length} Geometries Extracted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded uppercase">
                      <AlertTriangle className="w-3 h-3" />
                      No Geometries Found
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-gw-secondary bg-gw-primary p-3 rounded whitespace-pre-wrap max-h-32 overflow-y-auto">
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
