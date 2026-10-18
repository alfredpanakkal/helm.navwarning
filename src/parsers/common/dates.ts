// src/parsers/common/dates.ts
// Shared Date & DTG Grammar Parser with Calendar Validation

export const MONTH_MAP: Record<string, string> = {
  JAN: '01', JANUARY: '01',
  FEB: '02', FEBRUARY: '02',
  MAR: '03', MARCH: '03',
  APR: '04', APRIL: '04',
  MAY: '05',
  JUN: '06', JUNE: '06',
  JUL: '07', JULY: '07',
  AUG: '08', AUGUST: '08',
  SEP: '09', SEPT: '09', SEPTEMBER: '09',
  OCT: '10', OCTOBER: '10',
  NOV: '11', NOVEMBER: '11',
  DEC: '12', DECEMBER: '12',
};

export interface ParsedDTG {
  iso: string | null;
  day: number | null;
  hour: number | null;
  minute: number | null;
  month: string | null;
  year: number | null;
  precision: 'day' | 'hour' | 'minute' | 'none';
  isValidCalendar: boolean;
}

export function parseDTG(rawText: string, defaultYear?: number): ParsedDTG {
  if (!rawText) {
    return { iso: null, day: null, hour: null, minute: null, month: null, year: null, precision: 'none', isValidCalendar: false };
  }

  const upper = rawText.toUpperCase();
  // Standard DTG match e.g. "171200 UTC OCT 2026" or "151030Z OCT 26"
  const dtgMatch = upper.match(/(\d{2})(\d{2})?(\d{2})?\s*(?:Z|UTC)?\s*([A-Z]{3,9})\s*(\d{2,4})?/);

  if (!dtgMatch) {
    // Standard Date match e.g. "15 OCT 2026"
    const dateMatch = upper.match(/(\d{1,2})\s+([A-Z]{3,9})\s+(\d{2,4})/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const mStr = dateMatch[2];
      const monthNum = MONTH_MAP[mStr];
      const yr = parseInt(dateMatch[3], 10);
      const fullYear = yr < 100 ? 2000 + yr : yr;

      const isValidCalendar = day >= 1 && day <= 31 && Boolean(monthNum);
      const iso = isValidCalendar ? `${fullYear}-${monthNum}-${String(day).padStart(2, '0')}` : null;

      return {
        iso,
        day,
        hour: null,
        minute: null,
        month: monthNum || null,
        year: fullYear,
        precision: 'day',
        isValidCalendar,
      };
    }

    return { iso: null, day: null, hour: null, minute: null, month: null, year: null, precision: 'none', isValidCalendar: false };
  }

  const day = parseInt(dtgMatch[1], 10);
  const hour = dtgMatch[2] ? parseInt(dtgMatch[2], 10) : null;
  const minute = dtgMatch[3] ? parseInt(dtgMatch[3], 10) : null;
  const mStr = dtgMatch[4];
  const monthNum = MONTH_MAP[mStr];
  const yr = dtgMatch[5] ? parseInt(dtgMatch[5], 10) : defaultYear;
  const fullYear = yr ? (yr < 100 ? 2000 + yr : yr) : null;

  const isValidCalendar = day >= 1 && day <= 31 && Boolean(monthNum) && (hour === null || (hour >= 0 && hour <= 23)) && (minute === null || (minute >= 0 && minute <= 59));

  let precision: 'day' | 'hour' | 'minute' | 'none' = 'none';
  if (minute !== null) precision = 'minute';
  else if (hour !== null) precision = 'hour';
  else if (day !== null) precision = 'day';

  let iso: string | null = null;
  if (isValidCalendar && fullYear && monthNum) {
    const timePart = hour !== null && minute !== null ? `T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z` : 'T00:00:00Z';
    iso = `${fullYear}-${monthNum}-${String(day).padStart(2, '0')}${timePart}`;
  }

  return {
    iso,
    day,
    hour,
    minute,
    month: monthNum || null,
    year: fullYear,
    precision,
    isValidCalendar,
  };
}
