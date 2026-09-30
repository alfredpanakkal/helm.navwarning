import { INITIAL_SOURCES_REGISTRY } from '../data/sourcesRegistry.js';

export interface ScraperSource {
  id: string;
  url: string;
  navarea: string;
  type: 'html' | 'json' | 'pdf';
}

export const sources: ScraperSource[] = INITIAL_SOURCES_REGISTRY.map((s) => ({
  id: s.source_id,
  url: s.discovery_url,
  navarea: s.navareas[0] || 'I',
  type: s.format === 'pdf' ? 'pdf' : s.format === 'json' ? 'json' : 'html',
}));

