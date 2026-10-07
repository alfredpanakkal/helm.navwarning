import { z } from 'zod';

export const SpatialGeometrySchema = z.object({
  type: z.enum(['Point', 'LineString', 'Polygon', 'Circle']),
  coordinates: z.any(),
  radius_nm: z.number().optional(),
  label: z.string().optional(),
});

export const NavWarningLLMSchema = z.object({
  series: z.string().optional(),
  warning_number: z.string().optional().or(z.number().transform(String)),
  warning_year: z.number().optional(),
  area_text: z.string().optional(),
  issued_date: z.string().optional(),
  original_language: z.string().optional(),
  translated_text: z.string().optional().nullable(),
  geometries: z.array(SpatialGeometrySchema).optional(),
});

export type NavWarningLLMOutput = z.infer<typeof NavWarningLLMSchema>;

/**
 * Validates Gemini LLM raw output object before converting to NavWarning or storing in DB.
 * Rejects malformed or hallucinated responses.
 */
export function validateLLMOutput(raw: unknown): NavWarningLLMOutput | null {
  if (!raw || typeof raw !== 'object') {
    console.warn('LLM output validation failed: raw input is not an object');
    return null;
  }
  const result = NavWarningLLMSchema.safeParse(raw);
  if (!result.success) {
    console.warn('LLM output failed Zod schema validation:', result.error.format());
    return null; // reject, don't store garbage
  }
  return result.data;
}
