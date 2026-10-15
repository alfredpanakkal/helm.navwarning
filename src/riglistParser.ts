/**
 * NAVAREA I RIGLIST parser — golden pattern 26.
 * Verified 17/17 against hand-derived ground truth for I 223/26.
 * Handles: W-hemisphere coords, region sub-headers with coverage suffixes,
 * bare-degree tokens (rejected, never phantoms), wrapped "NEW <name>" rows
 * (attach to previous rig), NEW+coords rows, (EX ...) aliases, ACP meta,
 * message-level safety-zone note, cross-NAVAREA handoff.
 */

export type Pos = [number, number];

export interface LabeledPoint {
  label: string;
  position: Pos;
  meta?: string;       // "ACP K12-G (EX NOBLE REACHER)"
  isNew?: boolean;     // "NEW 61-02.20N ..." rows
  newName?: string;    // wrapped "NEW SCHIEDAM SWIFT 10" → renamed previous rig
}

export interface RigGroup { label: string; count: number }

export interface RiglistWarning {
  id: { navarea: string; number: number; year: number };
  issuedAt: string | null;                    // "2026-10-05"
  category: 'rig';
  archetype: 'multipoint';
  points: LabeledPoint[];
  groups: RigGroup[];
  clearanceNm?: number;                        // Note A → 500/1852 ≈ 0.27
  handoffArea?: [string, string, string];     // ["65", "5", "XIX"] (Note C)
  rawText: string;
}

const NUM_ORDS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

/** Parses one DM/DMS-hyphen component ("53-31.70W"). Returns signed decimal degrees. */
export function parseComponent(tok: string): number | null {
  const m = tok.match(/^(\d{1,3})-(\d{1,2}(?:\.\d{1,4})?)(?:-(\d{1,2}(?:\.\d{1,4})?))?([NSEW])$/);
  if (!m) return null;
  const deg = +m[1], min = +m[2], sec = m[3] ? +m[3] : 0;
  if (min >= 60 || sec >= 60) return null;
  const v = deg + min / 60 + sec / 3600;
  return (m[4] === 'S' || m[4] === 'W') ? -v : v;   // W/S → negative
}

export function parseRiglist(raw: string): RiglistWarning {
  const points: LabeledPoint[] = [];
  const groups: RigGroup[] = [];
  let currentGroup = '';

  const idMatch = raw.match(/NAVAREA\s+([IVXL]+)\s+(\d+)\/(\d+)/);
  const dtgMatch = raw.match(/CORRECT AT\s+(\d{2})(\d{2})(\d{2})\s+UTC\s+(\w{3})\s+(\d{4})/i);

  const addPoint = (latT: string, lonT: string, rest: string, isNew: boolean) => {
    const lat = parseComponent(latT), lon = parseComponent(lonT);
    if (lat === null || lon === null) return false;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
    const ex = rest.match(/\(EX\s+([^)]+)\)/)?.[1];
    const acp = rest.split(/\s+ACP\s+/)[1]?.split(/\s*\(EX/)[0].trim();
    const label = rest.replace(/\s*\(EX[^)]*\)\s*/g, ' ').split(/\s+ACP\b/)[0].trim();
    const meta = [ex ? `(EX ${ex})` : '', acp ? `ACP ${acp}` : ''].filter(Boolean).join(' ') || undefined;
    points.push({ label, position: [lat, lon], meta, isNew: isNew || undefined });
    const g = groups.find(x => x.label === currentGroup);
    if (g) g.count++;
    return true;
  };

  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || /^NAVAREA\s/.test(t) || /^\d+\.\s+RIGLIST/i.test(t)) continue;
    if (/^NOTES?:/i.test(t)) { currentGroup = 'NOTES'; continue; }

    // 1) "NEW <lat> <lon> NAME" — new rig at its own position
    const isNewRow = /^NEW\s+(\d{1,3}-\d{1,2}(?:\.\d+)?[NS])\s+(\d{1,3}-\d{1,2}(?:\.\d+)?[EW])\s+(.*)$/.exec(t);
    if (isNewRow) { addPoint(isNewRow[1], isNewRow[2], isNewRow[3], true); continue; }

    // 2) "<lat> <lon> NAME [ACP x] [(EX y)]" — standard row
    const row = /^(\d{1,3}-\d{1,2}(?:\.\d+)?[NS])\s+(\d{1,3}-\d{1,2}(?:\.\d+)?[EW])\s+(.*)$/.exec(t);
    if (row) { addPoint(row[1], row[2], row[3], false); continue; }

    // 3) Group header — ALL-CAPS letters-only name, optional ": COVERAGE" (may contain
    //    bare degrees like 51N TO 55N, which are coverage prose, NOT coordinates).
    if (!t.startsWith('NEW ') && !/[a-z]/.test(t)) {
      const hdr = /^([A-Z][A-Z &,'-]+)\s*(?::\s*(.*))?$/.exec(t);
      if (hdr) {
        currentGroup = hdr[1].trim();
        if (!groups.some(g => g.label === currentGroup)) groups.push({ label: currentGroup, count: 0 });
        continue;
      }
    }

    // 4) Wrapped "NEW <NAME>" with no coords — the new rig name for the PREVIOUS
    //    position (rig renamed/replaced): "NOBLE INTREPID" + "NEW SCHIEDAM SWIFT 10".
    const wrap = /^NEW\s+([A-Z][A-Z0-9 .&'-]*)$/.exec(t);
    if (wrap && points.length) { points[points.length - 1].newName = wrap[1].trim(); continue; }
  }

  const clearanceM = raw.match(/(\d+)\s*METRE\s*SAFETY ZONE/i);
  return {
    id: { navarea: idMatch?.[1] ?? '', number: +(idMatch?.[2] ?? 0), year: +(idMatch?.[3] ?? 0) },
    issuedAt: dtgMatch ? `${dtgMatch[5]}-${NUM_ORDS[dtgMatch[4].toUpperCase()] ?? 'XX'}-${dtgMatch[1]}` : null,
    category: 'rig',
    archetype: 'multipoint',   // cloud of rigs — never a polygon through them
    points,
    groups,
    clearanceNm: clearanceM ? parseInt(clearanceM[1], 10) / 1852 : undefined,
    handoffArea: raw.match(/NORTH OF (\d{2})N, EAST OF (\d+)W.*?NAVAREA ([IVXL]+)/)?.slice(1) as [string, string, string] | undefined,
    rawText: raw,
  };
}
