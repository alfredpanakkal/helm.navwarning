// src/parsers/inForceListParser.ts
// Identifies meta in-force bulletin messages and extracts cited active identifiers and cancellations

import type { RawMessageBlock } from '../types/navarea';

export interface InForceEntry {
  seriesYear: number;
  number: number;
  warningId: string;
}

export interface ParsedInForceList {
  isList: boolean;
  warningId: string;
  navarea: string;
  inForceEntries: InForceEntry[];
  cancelledRefs: string[];
  isPartialList: boolean;
  entryCount: number;
  rawText: string;
}

export function parseInForceList(block: RawMessageBlock): ParsedInForceList {
  const text = block.rawText;
  const isList = /IN\s+FORCE\b/i.test(text) && /(?:WARNING\s+MESSAGES|WARNINGS)\s+IN\s+FORCE/i.test(text);

  if (!isList) {
    return {
      isList: false,
      warningId: block.warningId,
      navarea: block.navarea,
      inForceEntries: [],
      cancelledRefs: [],
      isPartialList: false,
      entryCount: 0,
      rawText: text,
    };
  }

  const inForceEntries: InForceEntry[] = [];
  const defaultYear = block.year || 24;

  // Match series blocks like: "2024 SERIES: 084, 103, 189, 201..."
  const seriesRegex = /(?:(\d{4})\s+SERIES:|\bSERIES\s+(\d{4}):?)([^.]+?)(?=\.\s*(?:\d{4}\s+SERIES:|[A-Z]+|\n|$))/gi;
  let match: RegExpExecArray | null;

  while ((match = seriesRegex.exec(text)) !== null) {
    const rawYear = match[1] || match[2];
    const seriesYear = parseInt(rawYear, 10) % 100;
    const entriesBlock = match[3];

    // Numbers separated by commas or spaces
    const nums = entriesBlock.match(/\b\d{1,4}\b/g) || [];
    for (const numStr of nums) {
      const num = parseInt(numStr, 10);
      if (num > 0) {
        const yrFmt = seriesYear < 10 ? `0${seriesYear}` : `${seriesYear}`;
        inForceEntries.push({
          seriesYear,
          number: num,
          warningId: `NAVAREA ${block.navarea} ${num}/${yrFmt}`,
        });
      }
    }
  }

  // Also support list style with space separated items: e.g. "0398 0400 0401 ... 0454/26"
  if (inForceEntries.length === 0) {
    const spaceListRegex = /(?:MESSAGES\s+ARE\s+LISTED\s+HEREIN\.?|IN\s+FORCE\s+ON[^.]*?\.)\s*([\d\s,/]+)/i;
    const spaceMatch = text.match(spaceListRegex);
    if (spaceMatch) {
      const tokens = spaceMatch[1].trim().split(/[\s,]+/);
      for (const tok of tokens) {
        if (!tok) continue;
        const subMatch = tok.match(/^(\d{1,4})(?:\/(\d{2}))?$/);
        if (subMatch) {
          const num = parseInt(subMatch[1], 10);
          const yr = subMatch[2] ? parseInt(subMatch[2], 10) : defaultYear;
          const yrFmt = yr < 10 ? `0${yr}` : `${yr}`;
          inForceEntries.push({
            seriesYear: yr,
            number: num,
            warningId: `NAVAREA ${block.navarea} ${num}/${yrFmt}`,
          });
        }
      }
    }
  }

  // Extract explicit cancellation references (e.g. "CANCEL NAVAREA IV 857/24, 961/24" or "CANCEL 360/24.")
  const cancelledRefs: string[] = [];
  const cancelRegex = /CANCEL\s+(?:NAVAREA\s+[A-Z0-9]+\s+)?([0-9\s,/]+?)(?=\.|\n|$)/gi;
  let cMatch: RegExpExecArray | null;

  while ((cMatch = cancelRegex.exec(text)) !== null) {
    const rawRefs = cMatch[1];
    const items = rawRefs.split(/[,;\s]+/);
    for (const it of items) {
      const clean = it.trim();
      const m = clean.match(/^(\d{1,4})(?:\/(\d{2}))?$/);
      if (m) {
        const num = parseInt(m[1], 10);
        const yr = m[2] ? parseInt(m[2], 10) : defaultYear;
        const yrFmt = yr < 10 ? `0${yr}` : `${yr}`;
        cancelledRefs.push(`NAVAREA ${block.navarea} ${num}/${yrFmt}`);
      }
    }
  }

  const isPartialList = Boolean(block.truncated) || /\[MESSAGE TRUNCATED/i.test(text);

  return {
    isList: true,
    warningId: block.warningId,
    navarea: block.navarea,
    inForceEntries,
    cancelledRefs,
    isPartialList,
    entryCount: inForceEntries.length,
    rawText: text,
  };
}
