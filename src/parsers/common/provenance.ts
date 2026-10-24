// src/parsers/common/provenance.ts
// Provenance & Field Quality Metadata Models

import { ParserFlag } from './flags.js';

export type FieldState = 'explicit' | 'repaired' | 'inferred' | 'ambiguous' | 'invalid' | 'human_verified';

export type Method = 'deterministic' | 'llm_assisted' | 'manual_user_override';

export interface Sourced<T> {
  value: T | null;
  rawSnippet: string;
  state: FieldState;
  method: Method;
  flags: ParserFlag[];
}
