// scripts/parser-baseline.ts
// Phase 1e: Generates baseline snapshot corpus.before.json before Rules v3.0 parser changes

import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_WARNINGS } from '../src/data/sourcesRegistry';
import { extractGeometry } from '../src/parsers/geometryExtractor';
import { classifyWarning } from '../src/parsers/warningClassifier';

interface BaselineRecord {
  id: string;
  navarea: string;
  category: string;
  archetype: string;
  vertexCount: number;
  rawTextSnippet: string;
}

export function generateBaselineSnapshot(): BaselineRecord[] {
  const records: BaselineRecord[] = INITIAL_WARNINGS.map((w) => {
    const rawText = w.raw_text || w.title || '';
    const geomRes = extractGeometry(rawText);
    const classification = classifyWarning(rawText);

    return {
      id: w.warning_id,
      navarea: w.navarea,
      category: classification.category,
      archetype: geomRes.geometry.archetype,
      vertexCount: geomRes.geometry.coordinates.length,
      rawTextSnippet: rawText.slice(0, 100),
    };
  });

  const outDir = path.join(process.cwd(), 'baseline');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.join(outDir, 'corpus.before.json');
  fs.writeFileSync(outFile, JSON.stringify(records, null, 2), 'utf-8');
  console.log(`[Baseline Snapshot] Successfully wrote ${records.length} records to ${outFile}`);
  return records;
}

if (process.argv[1] && process.argv[1].includes('parser-baseline')) {
  generateBaselineSnapshot();
}
