// src/parsers/temporalParser.ts
// Extracts active operational time windows, cancellation DTGs, and diurnal recurrences

import type { TimeWindow, TemporalRecurrence } from '../types/navarea';

export interface ParsedTemporal {
  windows: TimeWindow[];
  recurrence?: TemporalRecurrence;
  selfCancelDtg?: string;
}

const MONTH_MAP: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
};

export function parseTemporal(text: string, referenceYear = 2024): ParsedTemporal {
  const windows: TimeWindow[] = [];
  let recurrence: TemporalRecurrence | undefined;
  let selfCancelDtg: string | undefined;

  // 1. Self-cancellation phrase: e.g. "CANCEL THIS MSG 150800Z OCT." or "CANCEL THIS MSG 150800Z OCT 24."
  const selfCancelMatch = text.match(/CANCEL\s+THIS\s+MSG\s+(\d{2})(\d{4})Z\s+([A-Z]{3})(?:\s+(\d{2}|\d{4}))?/i);
  if (selfCancelMatch) {
    const [, day, time, mon, rawYr] = selfCancelMatch;
    const mo = MONTH_MAP[mon.toUpperCase()] || '01';
    let yr = `${referenceYear}`;
    if (rawYr) {
      yr = rawYr.length === 2 ? `20${rawYr}` : rawYr;
    }
    const hr = time.substring(0, 2);
    const min = time.substring(2, 4);
    selfCancelDtg = `${yr}-${mo}-${day.padStart(2, '0')}T${hr}:${min}:00Z`;
  }

  // 2. Diurnal recurrence: e.g. "DAILY 0800Z TO 1200Z FROM 18 OCT TO 20 OCT 2024" or "DAILY 0600Z TO 1400Z"
  const dailyMatch = text.match(/DAILY\s+(\d{4})Z\s+TO\s+(\d{4})Z(?:\s+FROM\s+(\d{1,2})\s+([A-Z]{3})(?:\s+TO\s+(\d{1,2})\s+([A-Z]{3}))?(?:\s+(\d{4}))?)?/i);
  if (dailyMatch) {
    const [, startZ, endZ, fromDay, fromMon, toDay, toMon, rawYr] = dailyMatch;
    const startHour = `${startZ.substring(0, 2)}:${startZ.substring(2, 4)}`;
    const endHour = `${endZ.substring(0, 2)}:${endZ.substring(2, 4)}`;

    recurrence = {
      dailyStartUtc: startHour,
      dailyEndUtc: endHour,
      isActiveNow: false,
    };

    if (fromDay && fromMon) {
      const yr = rawYr || `${referenceYear}`;
      const fMo = MONTH_MAP[fromMon.toUpperCase()] || '10';
      const tMo = (toMon && MONTH_MAP[toMon.toUpperCase()]) || fMo;
      const tDay = toDay || fromDay;

      windows.push({
        start: `${yr}-${fMo}-${fromDay.padStart(2, '0')}T${startHour}:00Z`,
        end: `${yr}-${tMo}-${tDay.padStart(2, '0')}T${endHour}:00Z`,
        rawText: dailyMatch[0],
      });
    }
  }

  return {
    windows,
    recurrence,
    selfCancelDtg,
  };
}

export function isTemporalActiveNow(
  recurrence?: TemporalRecurrence,
  windows?: TimeWindow[],
  now = new Date()
): boolean {
  if (windows && windows.length > 0) {
    const nowIso = now.toISOString();
    for (const w of windows) {
      if (w.start && w.end) {
        if (nowIso >= w.start && nowIso <= w.end) {
          // Check daily hour window if recurrence is present
          if (recurrence?.dailyStartUtc && recurrence?.dailyEndUtc) {
            const currentUtcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
            const [sH, sM] = recurrence.dailyStartUtc.split(':').map(Number);
            const [eH, eM] = recurrence.dailyEndUtc.split(':').map(Number);
            const startMins = sH * 60 + sM;
            const endMins = eH * 60 + eM;
            return currentUtcMins >= startMins && currentUtcMins <= endMins;
          }
          return true;
        }
      }
    }
  }
  return false;
}
