// src/services/__tests__/aiStudioService.test.ts
// Unit and integration test suite for AI Studio fallback service

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AIStudioClient,
  getAIStudioClient,
  resetAIStudioClient,
  parseInForceListWithAI,
  type AIStudioConfig,
} from '../aiStudioService';
import { parseInForceListAsync } from '../../parsers/inForceListParser';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import type { RawMessageBlock } from '../../types/navarea';

describe('AI Studio Fallback Service Suite', () => {
  const originalEnv = { ...process.env };
  const mockConfig: AIStudioConfig = {
    projectId: 'test-maritime-project',
    location: 'us-central1',
    endpointId: 'gemini-2.0-flash',
    apiKey: 'mock-gemini-api-key',
  };

  function createMockBlock(overrides: Partial<RawMessageBlock> = {}): RawMessageBlock {
    return {
      warningId: 'NAVAREA IX 364/24',
      navarea: 'IX',
      number: 364,
      year: 24,
      rawHeader: 'NAVAREA IX 364/24',
      rawBody: 'NAVAREA IX WARNINGS IN FORCE',
      rawText: 'NAVAREA IX 364/24\nNAVAREA IX WARNINGS IN FORCE:\n2024 SERIES: 085, 102.',
      regionTokens: ['ARABIAN SEA'],
      charts: ['24'],
      filePosition: 0,
      sourceFeed: 'test-feed',
      ...overrides,
    };
  }

  beforeEach(() => {
    resetAIStudioClient();
    vi.restoreAllMocks();

    delete process.env.GOOGLE_AI_STUDIO_PROJECT_ID;
    delete process.env.GOOGLE_AI_STUDIO_LOCATION;
    delete process.env.GOOGLE_AI_STUDIO_ENDPOINT_ID;
    delete process.env.GOOGLE_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetAIStudioClient();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. getAIStudioClient Configuration Tests
  // =========================================================================
  describe('getAIStudioClient()', () => {
    it('returns null when required environment variables are missing', () => {
      expect(getAIStudioClient()).toBeNull();

      process.env.GOOGLE_AI_STUDIO_PROJECT_ID = 'test-proj';
      expect(getAIStudioClient()).toBeNull();

      process.env.GOOGLE_AI_STUDIO_ENDPOINT_ID = 'test-endpoint';
      expect(getAIStudioClient()).toBeNull(); // apiKey still missing
    });

    it('returns a valid client instance when all required env vars are present', () => {
      process.env.GOOGLE_AI_STUDIO_PROJECT_ID = 'test-proj';
      process.env.GOOGLE_AI_STUDIO_ENDPOINT_ID = 'test-endpoint';
      process.env.GOOGLE_API_KEY = 'test-key';

      const client = getAIStudioClient();
      expect(client).toBeInstanceOf(AIStudioClient);
      expect(client?.getConfig().projectId).toBe('test-proj');
      expect(client?.getConfig().location).toBe('us-central1'); // default location
      expect(client?.getConfig().endpointId).toBe('test-endpoint');
      expect(client?.getConfig().apiKey).toBe('test-key');
    });

    it('uses custom GOOGLE_AI_STUDIO_LOCATION if specified', () => {
      process.env.GOOGLE_AI_STUDIO_PROJECT_ID = 'test-proj';
      process.env.GOOGLE_AI_STUDIO_LOCATION = 'europe-west4';
      process.env.GOOGLE_AI_STUDIO_ENDPOINT_ID = 'test-endpoint';
      process.env.GOOGLE_API_KEY = 'test-key';

      const client = getAIStudioClient();
      expect(client?.getConfig().location).toBe('europe-west4');
    });

    it('returns the same singleton instance on subsequent calls', () => {
      process.env.GOOGLE_AI_STUDIO_PROJECT_ID = 'test-proj';
      process.env.GOOGLE_AI_STUDIO_ENDPOINT_ID = 'test-endpoint';
      process.env.GOOGLE_API_KEY = 'test-key';

      const client1 = getAIStudioClient();
      const client2 = getAIStudioClient();
      expect(client1).toBe(client2);
    });

    it('creates a fresh instance after resetInstance() is called', () => {
      process.env.GOOGLE_AI_STUDIO_PROJECT_ID = 'test-proj';
      process.env.GOOGLE_AI_STUDIO_ENDPOINT_ID = 'test-endpoint';
      process.env.GOOGLE_API_KEY = 'test-key';

      const client1 = getAIStudioClient();
      resetAIStudioClient();
      const client2 = getAIStudioClient();
      expect(client1).not.toBe(client2);
    });
  });

  // =========================================================================
  // 2. extractInForceList & Response Parsing Tests
  // =========================================================================
  describe('AIStudioClient.extractInForceList()', () => {
    it('returns null on HTTP 500 API error', async () => {
      const client = AIStudioClient.getInstance(mockConfig);
      const mockBlock = createMockBlock();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await client.extractInForceList(mockBlock);
      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns null on network/fetch exception', async () => {
      const client = AIStudioClient.getInstance(mockConfig);
      const mockBlock = createMockBlock();

      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await client.extractInForceList(mockBlock);
      expect(result).toBeNull();
    });

    it('parses valid JSON prediction response into ParsedInForceList with normalized entries', async () => {
      const client = AIStudioClient.getInstance(mockConfig);
      const mockBlock = createMockBlock({
        warningId: 'NAVAREA IV 978/24',
        navarea: 'IV',
        number: 978,
        year: 24,
      });

      const aiJsonResponse = {
        is_list: true,
        navarea: 'IV',
        warning_id: 'NAVAREA IV 978/24',
        entries: [
          { series_year: 24, number: 977, warning_id: 'NAVAREA IV 977/24' },
          { series_year: 24, number: 976, warning_id: 'NAVAREA IV 976/24' },
          { series_year: 24, number: 222, warning_id: 'NAVAREA IV 222/24' },
        ],
        cancelled_refs: ['NAVAREA IV 975/24'],
        is_partial: false,
        is_self_cancelling: false,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          predictions: [{ content: JSON.stringify(aiJsonResponse) }],
        }),
      });

      const result = await client.extractInForceList(mockBlock);
      expect(result).not.toBeNull();
      expect(result?.isList).toBe(true);
      expect(result?.navarea).toBe('IV');
      expect(result?.warningId).toBe('NAVAREA IV 978/24');
      expect(result?.entryCount).toBe(3);
      expect(result?.inForceEntries).toHaveLength(3);
      expect(result?.inForceEntries[0]).toEqual({
        seriesYear: 24,
        number: 977,
        warningId: 'NAVAREA IV 977/24',
        rawToken: undefined,
      });
      expect(result?.cancelledRefs).toEqual(['NAVAREA IV 975/24']);
    });

    it('handles markdown code block wrapped JSON predictions', async () => {
      const client = AIStudioClient.getInstance(mockConfig);
      const mockBlock = createMockBlock();

      const aiJsonResponse = {
        is_list: true,
        navarea: 'IX',
        warning_id: 'NAVAREA IX 364/24',
        entries: [{ series_year: 24, number: 120, warning_id: 'NAVAREA IX 120/24' }],
        cancelled_refs: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          predictions: [`\`\`\`json\n${JSON.stringify(aiJsonResponse)}\n\`\`\``],
        }),
      });

      const result = await client.extractInForceList(mockBlock);
      expect(result).not.toBeNull();
      expect(result?.entryCount).toBe(1);
      expect(result?.inForceEntries[0].warningId).toBe('NAVAREA IX 120/24');
    });

    it('throws when parseResponse is called directly with malformed JSON', () => {
      const client = AIStudioClient.getInstance(mockConfig);
      const mockBlock = createMockBlock();

      expect(() => client.parseResponse('INVALID JSON NOT AN OBJECT', mockBlock)).toThrow();
    });

    it('handles malformed JSON response safely during extractInForceList by returning null', async () => {
      const client = AIStudioClient.getInstance(mockConfig);
      const mockBlock = createMockBlock();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          predictions: ['NOT_JSON_BODY'],
        }),
      });

      const result = await client.extractInForceList(mockBlock);
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // 3. Fallback Orchestration: parseInForceListWithAI & parseInForceListAsync
  // =========================================================================
  describe('Fallback Orchestration', () => {
    it('uses deterministic parser without calling fetch when deterministic parser finds entries', async () => {
      process.env.GOOGLE_AI_STUDIO_PROJECT_ID = 'test-proj';
      process.env.GOOGLE_AI_STUDIO_ENDPOINT_ID = 'test-endpoint';
      process.env.GOOGLE_API_KEY = 'test-key';

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      // Normal in-force list containing entries (deterministic parser extracts 2 entries)
      const mockBlock = createMockBlock({
        rawText: `NAVAREA IX 364/24\nNAVAREA IX WARNINGS IN FORCE ON 22 OCT 24.\n2024 SERIES: 085, 102.`,
      });

      const result = await parseInForceListWithAI(mockBlock);

      expect(result.isList).toBe(true);
      expect(result.entryCount).toBe(2);
      expect(result.inForceEntries.map((e) => e.warningId)).toEqual([
        'NAVAREA IX 85/24',
        'NAVAREA IX 102/24',
      ]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('triggers AI Studio fallback when deterministic parser identifies an in-force list with 0 entries', async () => {
      process.env.GOOGLE_AI_STUDIO_PROJECT_ID = 'test-proj';
      process.env.GOOGLE_AI_STUDIO_ENDPOINT_ID = 'test-endpoint';
      process.env.GOOGLE_API_KEY = 'test-key';

      // Text that is recognized as an in-force list header, but entries are in an atypical non-numeric format that yields 0 entries deterministically
      const mockBlock = createMockBlock({
        warningId: 'NAVAREA IX 999/24',
        navarea: 'IX',
        rawText: `NAVAREA IX 999/24\nNAVAREA IX WARNINGS IN FORCE ON 22 OCT 24.\nREFER TO ATTACHED ENCRYPTED TABLE NO STANDALONE DIGITS`,
      });

      const aiResponse = {
        is_list: true,
        navarea: 'IX',
        warning_id: 'NAVAREA IX 999/24',
        entries: [
          { series_year: 24, number: 888, warning_id: 'NAVAREA IX 888/24' },
          { series_year: 24, number: 889, warning_id: 'NAVAREA IX 889/24' },
        ],
        cancelled_refs: ['NAVAREA IX 777/24'],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          predictions: [{ content: JSON.stringify(aiResponse) }],
        }),
      });

      const result = await parseInForceListWithAI(mockBlock);

      expect(result.isList).toBe(true);
      expect(result.entryCount).toBe(2);
      expect(result.inForceEntries[0].warningId).toBe('NAVAREA IX 888/24');
      expect(result.inForceEntries[1].warningId).toBe('NAVAREA IX 889/24');
      expect(result.cancelledRefs).toEqual(['NAVAREA IX 777/24']);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('gracefully returns deterministic result when AI Studio is unconfigured', async () => {
      // Env vars deleted in beforeEach
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const mockBlock = createMockBlock({
        rawText: `NAVAREA IX 999/24\nNAVAREA IX WARNINGS IN FORCE ON 22 OCT 24.\nREFER TO ATTACHED ENCRYPTED TABLE NO STANDALONE DIGITS`,
      });

      const result = await parseInForceListWithAI(mockBlock);

      expect(result.isList).toBe(true);
      expect(result.entryCount).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('gracefully returns deterministic result when AI Studio call fails', async () => {
      process.env.GOOGLE_AI_STUDIO_PROJECT_ID = 'test-proj';
      process.env.GOOGLE_AI_STUDIO_ENDPOINT_ID = 'test-endpoint';
      process.env.GOOGLE_API_KEY = 'test-key';

      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const mockBlock = createMockBlock({
        rawText: `NAVAREA IX 999/24\nNAVAREA IX WARNINGS IN FORCE ON 22 OCT 24.\nREFER TO ATTACHED ENCRYPTED TABLE NO STANDALONE DIGITS`,
      });

      const result = await parseInForceListWithAI(mockBlock);

      expect(result.isList).toBe(true);
      expect(result.entryCount).toBe(0);
    });

    it('parseInForceListAsync triggers fallback and returns AI results when enabled', async () => {
      process.env.GOOGLE_AI_STUDIO_PROJECT_ID = 'test-proj';
      process.env.GOOGLE_AI_STUDIO_ENDPOINT_ID = 'test-endpoint';
      process.env.GOOGLE_API_KEY = 'test-key';

      const mockBlock = createMockBlock({
        warningId: 'NAVAREA IX 999/24',
        rawText: `NAVAREA IX 999/24\nNAVAREA IX WARNINGS IN FORCE ON 22 OCT 24.\nREFER TO ATTACHED ENCRYPTED TABLE NO STANDALONE DIGITS`,
      });

      const aiResponse = {
        is_list: true,
        navarea: 'IX',
        warning_id: 'NAVAREA IX 999/24',
        entries: [{ series_year: 24, number: 991, warning_id: 'NAVAREA IX 991/24' }],
        cancelled_refs: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          predictions: [{ content: JSON.stringify(aiResponse) }],
        }),
      });

      const result = await parseInForceListAsync(mockBlock);
      expect(result.entryCount).toBe(1);
      expect(result.inForceEntries[0].warningId).toBe('NAVAREA IX 991/24');
    });

    it('parseInForceListAsync respects FEATURE_FLAGS.aiStudioFallback = false', async () => {
      process.env.GOOGLE_AI_STUDIO_PROJECT_ID = 'test-proj';
      process.env.GOOGLE_AI_STUDIO_ENDPOINT_ID = 'test-endpoint';
      process.env.GOOGLE_API_KEY = 'test-key';

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      // Temporarily toggle feature flag off
      const originalFlag = FEATURE_FLAGS.aiStudioFallback;
      (FEATURE_FLAGS as { aiStudioFallback: boolean }).aiStudioFallback = false;

      try {
        const mockBlock = createMockBlock({
          rawText: `NAVAREA IX 999/24\nNAVAREA IX WARNINGS IN FORCE ON 22 OCT 24.\nREFER TO ATTACHED ENCRYPTED TABLE NO STANDALONE DIGITS`,
        });

        const result = await parseInForceListAsync(mockBlock);
        expect(result.isList).toBe(true);
        expect(result.entryCount).toBe(0);
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        (FEATURE_FLAGS as { aiStudioFallback: boolean }).aiStudioFallback = originalFlag;
      }
    });
  });
});
