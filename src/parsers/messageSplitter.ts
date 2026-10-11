// src/parsers/messageSplitter.ts
// Splits raw broadcast feeds into discrete raw message blocks with position and truncation telemetry

import type { RawMessageBlock } from '../types/navarea';

export interface SplitterOptions {
  defaultNavarea?: string;
  sourceFeed?: string;
}

export function splitBroadcastFeed(
  rawFeedText: string,
  options: SplitterOptions = {}
): RawMessageBlock[] {
  if (!rawFeedText || typeof rawFeedText !== 'string') {
    return [];
  }

  const defaultNavarea = options.defaultNavarea || 'IX';
  const sourceFeed = options.sourceFeed || 'unknown';

  // Normalize line endings
  const normalized = rawFeedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Match message start delimiters:
  // e.g. "NAVAREA IX 364/24" or "NAVAREA IV 978/24" or "NO.26-0455" or GENADMIN blocks
  const headerPattern = /(?:^|\n)(?=(?:NAVAREA\s+[A-Z0-9]+\s+\d+(?:\/\d+)?|NO\.\d+-\d+|SECNAV|GENADMIN))/i;

  const rawChunks = normalized
    .split(headerPattern)
    .map(c => c.trim())
    .filter(c => c.length > 0);

  const blocks: RawMessageBlock[] = [];

  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];
    const lines = chunk.split('\n');
    const firstLine = lines[0].trim();

    // Check truncation indicators
    const isTruncated = /\[MESSAGE TRUNCATED|TRUNCATED BY TRANSMISSION|\bINCOMPLETE\b/i.test(chunk);

    // Extract ID info
    let navarea = defaultNavarea;
    let number = 0;
    let year = new Date().getFullYear() % 100;
    let warningId = '';

    const navareaMatch = firstLine.match(/NAVAREA\s+([A-Z0-9]+)\s+(\d+)(?:\/(\d+))?/i);
    const jhodMatch = firstLine.match(/NO\.(\d+)-(\d+)/i);

    if (navareaMatch) {
      navarea = navareaMatch[1].toUpperCase();
      number = parseInt(navareaMatch[2], 10);
      year = navareaMatch[3] ? parseInt(navareaMatch[3], 10) : year;
      warningId = `NAVAREA ${navarea} ${number}/${year < 10 ? '0' + year : year}`;
    } else if (jhodMatch) {
      year = parseInt(jhodMatch[1], 10);
      number = parseInt(jhodMatch[2], 10);
      navarea = defaultNavarea;
      warningId = `NO.${year}-${number}`;
    } else {
      // Fallback identifier
      warningId = `GENADMIN-${i + 1}`;
    }

    // Header vs body separation
    const headerLines: string[] = [];
    const bodyLines: string[] = [];
    let isHeader = true;

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      if (j === 0) {
        headerLines.push(line);
        continue;
      }
      if (isHeader) {
        if (
          line.trim() === '' ||
          /^[A-Z\s,.-]+:/.test(line) ||
          /^(?:CHARTS?|AREA|ZONE|VICINITY|SUBJ|SUBJECT)\b/i.test(line)
        ) {
          isHeader = false;
          bodyLines.push(line);
        } else if (headerLines.length < 3 && !/^\d{2}-|\bIN AREA\b|\bCOORD\b/i.test(line)) {
          headerLines.push(line);
        } else {
          isHeader = false;
          bodyLines.push(line);
        }
      } else {
        bodyLines.push(line);
      }
    }

    // Extract charts from chunk
    const chartMatches = chunk.match(/CHARTS?\s+([A-Z0-9,\s]+?)(?=\.|\n|$)/i);
    const charts: string[] = [];
    if (chartMatches) {
      const rawCharts = chartMatches[1].split(/[,;\s]+/);
      for (const rc of rawCharts) {
        const clean = rc.trim();
        if (clean && clean.length >= 2 && !/^(AND|THE|BA)$/i.test(clean)) {
          charts.push(clean);
        }
      }
    }

    // Extract region tokens
    const regionTokens: string[] = [];
    const regionMatches = chunk.match(/([A-Z\s]{3,30}),\s*([A-Z\s]{3,30})\./);
    if (regionMatches) {
      regionTokens.push(regionMatches[1].trim());
      regionTokens.push(regionMatches[2].trim());
    }

    blocks.push({
      warningId,
      navarea,
      number,
      year,
      rawHeader: headerLines.join('\n').trim(),
      rawBody: bodyLines.join('\n').trim(),
      rawText: chunk,
      regionTokens,
      charts,
      truncated: isTruncated,
      filePosition: i + 1,
      sourceFeed,
    });
  }

  return blocks;
}
