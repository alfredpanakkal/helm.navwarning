// src/parsers/common/ids.ts
// Shared Identifier Parsers & Normalizers

import { Sourced } from './provenance.js';

export function normalizeYear(input?: number | string | null): number | null {
  if (input === null || input === undefined || input === '') return null;
  const num = typeof input === 'number' ? input : parseInt(String(input).trim(), 10);
  if (isNaN(num)) return null;
  if (num >= 2000 && num <= 2099) return num % 100;
  if (num >= 0 && num <= 99) return num;
  return null;
}

export function formatWarningId(navarea: string | null | undefined, number: number | null | undefined, year: number | null | undefined): string | null {
  if (!navarea || number === null || number === undefined) return null;
  const normYear = normalizeYear(year);
  if (normYear === null) return null;
  const formattedYear = String(normYear).padStart(2, '0');
  return `NAVAREA ${navarea.toUpperCase()} ${number}/${formattedYear}`;
}

export interface ParsedWarningRef {
  raw: string;
  navarea: string | null;
  number: number | null;
  year: number | null;
  canonicalId: string | null;
  hasUnknownYear: boolean;
  hasUnknownNavarea: boolean;
}

export function parseWarningRef(rawRef: string, defaultNavarea?: string, defaultYear?: number): ParsedWarningRef {
  const trimmed = rawRef.trim().toUpperCase();
  const match = trimmed.match(/(?:NAVAREA\s+([IVXLCDM]+)\s+)?(\d{1,4})(?:\/(\d{2,4}))?/i);

  if (!match) {
    return {
      raw: rawRef,
      navarea: null,
      number: null,
      year: null,
      canonicalId: null,
      hasUnknownYear: true,
      hasUnknownNavarea: true,
    };
  }

  const navarea = match[1] ? match[1].toUpperCase() : defaultNavarea ? defaultNavarea.toUpperCase() : null;
  const number = parseInt(match[2], 10);
  const rawYear = match[3] ? match[3] : defaultYear !== undefined ? defaultYear : null;
  const year = normalizeYear(rawYear);

  const hasUnknownYear = year === null;
  const hasUnknownNavarea = navarea === null;

  const canonicalId = formatWarningId(navarea, number, year);

  return {
    raw: rawRef,
    navarea,
    number,
    year,
    canonicalId,
    hasUnknownYear,
    hasUnknownNavarea,
  };
}
