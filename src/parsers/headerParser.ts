// src/parsers/headerParser.ts
// Extracts formal headers, DTG issuance timestamps, chart references, and geographic tokens

import type { RawMessageBlock } from '../types/navarea';

export interface ParsedHeader {
  warningId: string;
  navarea: string;
  number: number;
  year: number;
  issuedAt?: string;
  headerStyle: 'telex' | 'jhod' | 'genadmin';
  subjectCode?: string;
  regionTokens: string[];
  charts: string[];
}

const MONTH_MAP: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
};

export function parseHeader(block: RawMessageBlock): ParsedHeader {
  let headerStyle: 'telex' | 'jhod' | 'genadmin' = 'telex';
  if (block.warningId.startsWith('NO.')) {
    headerStyle = 'jhod';
  } else if (block.warningId.startsWith('GENADMIN')) {
    headerStyle = 'genadmin';
  }

  let issuedAt: string | undefined;

  // Search for DTG patterns in header or body:
  // e.g. "151200Z OCT 24" or "101200Z OCT" or "Date:2026/10/10 12 UTC" or "ON 15 OCT 2024"
  const dtgMatch = block.rawText.match(/(\d{2})(\d{4})Z\s+([A-Z]{3})(?:\s+(\d{2}|\d{4}))?/i);
  const jhodDateMatch = block.rawText.match(/Date:(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2})\s+UTC/i);
  const onDateMatch = block.rawText.match(/ON\s+(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);

  if (jhodDateMatch) {
    const [, yr, mo, dy, hr] = jhodDateMatch;
    issuedAt = `${yr}-${mo}-${dy}T${hr}:00:00Z`;
  } else if (dtgMatch) {
    const [, day, time, monthName, rawYear] = dtgMatch;
    const mo = MONTH_MAP[monthName.toUpperCase()] || '01';
    let yr = '2024';
    if (rawYear) {
      yr = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    } else if (block.year) {
      yr = block.year < 100 ? `20${block.year}` : `${block.year}`;
    }
    const hr = time.substring(0, 2);
    const min = time.substring(2, 4);
    issuedAt = `${yr}-${mo}-${day.padStart(2, '0')}T${hr}:${min}:00Z`;
  } else if (onDateMatch) {
    const [, day, monthName, yr] = onDateMatch;
    const mo = MONTH_MAP[monthName.toUpperCase()] || '01';
    issuedAt = `${yr}-${mo}-${day.padStart(2, '0')}T00:00:00Z`;
  }

  // Extract subject code if present (e.g. SUBJ: GUNNERY PRACTICE or 2-letter IMO code)
  let subjectCode: string | undefined;
  const subjMatch = block.rawText.match(/(?:SUBJ|SUBJECT):\s*([A-Z0-9\s-]+?)(?=\n|$)/i);
  if (subjMatch) {
    subjectCode = subjMatch[1].trim();
  }

  return {
    warningId: block.warningId,
    navarea: block.navarea,
    number: block.number,
    year: block.year,
    issuedAt,
    headerStyle,
    subjectCode,
    regionTokens: block.regionTokens,
    charts: block.charts,
  };
}
