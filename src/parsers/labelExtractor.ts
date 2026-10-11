// src/parsers/labelExtractor.ts
// Extracts structured area/point labels (e.g. AREA A, ZONE 1, SITE-1, ALPHA, BUOY-1)

export interface ParsedGroupLabel {
  label: string;
  kind: 'area' | 'zone' | 'site' | 'point' | 'buoy';
  rawSnippet: string;
}

export function extractGroupLabels(text: string): ParsedGroupLabel[] {
  const labels: ParsedGroupLabel[] = [];
  const lines = text.split('\n');

  const pattern = /^(?:(AREA|ZONE|SITE|BUOY)\s+([A-Z0-9-]+)|([A-Z])\s+\d{2}-|(ALPHA|BRAVO|CHARLIE|DELTA)\s+\d{2}-)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(pattern);
    if (match) {
      if (match[1] && match[2]) {
        const kind = match[1].toLowerCase() as any;
        labels.push({
          label: `${match[1].toUpperCase()} ${match[2].toUpperCase()}`,
          kind: kind === 'area' ? 'area' : kind === 'zone' ? 'zone' : kind === 'buoy' ? 'buoy' : 'site',
          rawSnippet: trimmed,
        });
      } else if (match[3]) {
        labels.push({
          label: match[3].toUpperCase(),
          kind: 'point',
          rawSnippet: trimmed,
        });
      } else if (match[4]) {
        labels.push({
          label: match[4].toUpperCase(),
          kind: 'point',
          rawSnippet: trimmed,
        });
      }
    }
  }

  return labels;
}
