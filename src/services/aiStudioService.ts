// src/services/aiStudioService.ts
// AI Studio / Vertex AI fallback service for NAVAREA in-force list extraction

import type { RawMessageBlock } from '../types/navarea.js';
import {
  parseInForceList,
  type ParsedInForceList,
  type InForceEntry,
  normalizeSeriesYear,
  formatWarningId,
} from '../parsers/inForceListParser.js';

export interface AIStudioConfig {
  projectId: string;
  location: string;
  endpointId: string;
  apiKey: string;
}

export interface AIStudioRequest {
  instances: Array<{
    prompt: string;
  }>;
  parameters?: {
    temperature?: number;
    maxOutputTokens?: number;
    [key: string]: unknown;
  };
}

export interface AIStudioResponse {
  predictions?: Array<{
    content?: string;
    text?: string;
    [key: string]: unknown;
  } | string | Record<string, unknown>>;
  error?: unknown;
}

export interface InForceExtractionEntry {
  series_year?: number;
  seriesYear?: number;
  number: number;
  warning_id?: string;
  warningId?: string;
  raw_token?: string;
}

export interface InForceExtractionResult {
  is_list: boolean;
  navarea: string;
  warning_id: string;
  entries: InForceExtractionEntry[];
  cancelled_refs?: string[];
  is_partial?: boolean;
  is_self_cancelling?: boolean;
  self_cancelling_condition?: string;
  raw_text?: string;
}

function getEnvVar(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[name] !== undefined && process.env[name] !== '') {
    return process.env[name];
  }
  try {
    // Vite client / build environment
    const metaEnv = (import.meta as unknown as { env?: Record<string, string> })?.env;
    if (metaEnv && metaEnv[name] !== undefined && metaEnv[name] !== '') {
      return metaEnv[name];
    }
  } catch {
    // Ignore environments where import.meta is unavailable
  }
  return undefined;
}

/**
 * Singleton client for Google AI Studio / Vertex AI fallback extraction.
 */
export class AIStudioClient {
  private static instance: AIStudioClient | null = null;
  private config: AIStudioConfig;

  private constructor(config: AIStudioConfig) {
    this.config = config;
  }

  public static getInstance(config: AIStudioConfig): AIStudioClient {
    if (!AIStudioClient.instance) {
      AIStudioClient.instance = new AIStudioClient(config);
    } else {
      // Keep configuration in sync if new config is supplied
      AIStudioClient.instance.config = config;
    }
    return AIStudioClient.instance;
  }

  public static resetInstance(): void {
    AIStudioClient.instance = null;
  }

  public getConfig(): AIStudioConfig {
    return { ...this.config };
  }

  /**
   * Parses the prediction payload or raw JSON text into a typed ParsedInForceList.
   * Throws if the payload is malformed or cannot be parsed as valid JSON.
   */
  public parseResponse(
    payload: string | Record<string, unknown>,
    block: RawMessageBlock
  ): ParsedInForceList {
    let rawObj: Record<string, unknown>;

    if (typeof payload === 'string') {
      let clean = payload.trim();
      // Remove markdown code fences if present
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }
      rawObj = JSON.parse(clean);
    } else {
      rawObj = payload;
    }

    const navarea = (
      (rawObj.navarea as string) ||
      block.navarea ||
      'IX'
    ).toUpperCase();

    const warningId =
      (rawObj.warning_id as string) ||
      (rawObj.warningId as string) ||
      block.warningId ||
      `NAVAREA ${navarea} ${block.number}/${block.year}`;

    const isList = Boolean(rawObj.is_list ?? rawObj.isList ?? true);

    const rawEntries = Array.isArray(rawObj.entries)
      ? (rawObj.entries as InForceExtractionEntry[])
      : [];

    const inForceEntries: InForceEntry[] = rawEntries.map((e) => {
      const year = normalizeSeriesYear(
        e.series_year ?? e.seriesYear,
        block.year || 24
      );
      const num = typeof e.number === 'number' ? e.number : parseInt(String(e.number), 10);
      const wid =
        e.warning_id ||
        e.warningId ||
        formatWarningId(navarea, num, year);

      return {
        seriesYear: year,
        number: num,
        warningId: wid,
        rawToken: e.raw_token,
      };
    });

    const cancelledRefs: string[] = Array.isArray(rawObj.cancelled_refs)
      ? (rawObj.cancelled_refs as string[])
      : Array.isArray(rawObj.cancelledRefs)
      ? (rawObj.cancelledRefs as string[])
      : [];

    const isPartialList = Boolean(
      rawObj.is_partial ?? rawObj.isPartialList ?? block.truncated
    );

    const isSelfCancelling = Boolean(
      rawObj.is_self_cancelling ?? rawObj.isSelfCancelling ?? false
    );

    const selfCancellingCondition =
      (rawObj.self_cancelling_condition as string) ||
      (rawObj.selfCancellingCondition as string) ||
      undefined;

    return {
      isList,
      warningId,
      navarea,
      inForceEntries,
      cancelledRefs,
      cancellationDetails: [],
      isPartialList,
      entryCount: inForceEntries.length,
      rawText: block.rawText,
      isSelfCancelling,
      selfCancellingCondition,
    };
  }

  /**
   * Calls the Vertex AI / AI Studio predict endpoint to extract an in-force list.
   * Returns null on HTTP failure or network error.
   */
  public async extractInForceList(
    block: RawMessageBlock
  ): Promise<ParsedInForceList | null> {
    const endpointUrl = `https://${this.config.location}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/${this.config.endpointId}:predict`;

    const prompt = `You are a maritime safety expert parsing NAVAREA navigation warnings.
Extract all listed in-force navigation warnings and cancellations from the broadcast into strict JSON.

Output JSON format:
{
  "is_list": true,
  "navarea": "${block.navarea}",
  "warning_id": "${block.warningId}",
  "entries": [
    { "series_year": 24, "number": 360, "warning_id": "NAVAREA ${block.navarea} 360/24" }
  ],
  "cancelled_refs": ["NAVAREA ${block.navarea} 350/24"],
  "is_partial": false,
  "is_self_cancelling": false,
  "self_cancelling_condition": ""
}

Raw NAVAREA Broadcast:
${block.rawText}`;

    const requestBody: AIStudioRequest = {
      instances: [{ prompt }],
      parameters: {
        temperature: 0.0,
        maxOutputTokens: 4096,
      },
    };

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'x-goog-api-key': this.config.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        return null;
      }

      const data: AIStudioResponse = await response.json();
      if (!data.predictions || data.predictions.length === 0) {
        return null;
      }

      const prediction = data.predictions[0];
      let predictionPayload: string | Record<string, unknown>;

      if (typeof prediction === 'string') {
        predictionPayload = prediction;
      } else if (typeof prediction === 'object' && prediction !== null) {
        if (typeof (prediction as { content?: string }).content === 'string') {
          predictionPayload = (prediction as { content: string }).content;
        } else if (typeof (prediction as { text?: string }).text === 'string') {
          predictionPayload = (prediction as { text: string }).text;
        } else {
          predictionPayload = prediction as Record<string, unknown>;
        }
      } else {
        return null;
      }

      return this.parseResponse(predictionPayload, block);
    } catch {
      return null;
    }
  }
}

/**
 * Reads AI Studio configuration from environment and returns singleton client or null.
 */
export function getAIStudioClient(): AIStudioClient | null {
  const projectId = getEnvVar('GOOGLE_AI_STUDIO_PROJECT_ID');
  const location = getEnvVar('GOOGLE_AI_STUDIO_LOCATION') || 'us-central1';
  const endpointId = getEnvVar('GOOGLE_AI_STUDIO_ENDPOINT_ID');
  const apiKey = getEnvVar('GOOGLE_API_KEY');

  if (!projectId || !endpointId || !apiKey) {
    return null;
  }

  return AIStudioClient.getInstance({
    projectId,
    location,
    endpointId,
    apiKey,
  });
}

/**
 * Resets the AI Studio singleton instance (helper for tests).
 */
export function resetAIStudioClient(): void {
  AIStudioClient.resetInstance();
}

/**
 * Deterministic-first fallback orchestrator.
 * Always executes deterministic parser first; only falls back to AI Studio if
 * deterministic parsing identified an in-force list with zero extracted entries.
 */
export async function parseInForceListWithAI(
  block: RawMessageBlock
): Promise<ParsedInForceList> {
  const deterministicResult = parseInForceList(block);

  // Return deterministic immediately if it extracted entries, or if it is not an in-force list
  if (!deterministicResult.isList || deterministicResult.entryCount > 0) {
    return deterministicResult;
  }

  // Deterministic detected an in-force list but found 0 entries: attempt AI Studio fallback
  const client = getAIStudioClient();
  if (!client) {
    return deterministicResult;
  }

  try {
    const aiResult = await client.extractInForceList(block);
    if (aiResult && aiResult.entryCount > 0) {
      return aiResult;
    }
  } catch {
    // Never throw or block pipeline
  }

  return deterministicResult;
}
