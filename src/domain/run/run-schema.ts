import { z } from 'zod';
import type { Run } from './run';

/*
 * The shape of a run as it is kept between page loads. Anything read back from storage
 * is untrusted (it may be from an older version, or edited), so it is validated like
 * any other outside data before the app uses it.
 */

const sourceSchema = z.object({
  id: z.string(),
  kind: z.enum(['qualitative', 'quantitative', 'benchmark', 'guideline', 'synthetic', 'generated']),
  description: z.string(),
  isSynthetic: z.boolean(),
});

export const completedResultSchema = z.object({
  status: z.literal('completed'),
  capabilityId: z.string(),
  durationSeconds: z.number(),
  evidence: z.object({
    level: z.enum(['high', 'medium', 'low']),
    summary: z.string(),
    sources: z.array(sourceSchema),
  }),
  content: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string()),
  nextCapabilityIds: z.array(z.string()),
});

const failureSchema = z.object({
  code: z.enum([
    'timeout',
    'incomplete-input',
    'dependency-not-approved',
    'source-unavailable',
    'unsupported-segment',
    'invalid-output',
    'provider-error',
    'unknown',
  ]),
  technicalMessage: z.string(),
  retryable: z.boolean(),
  durationSeconds: z.number(),
});

const stepRunSchema = z.object({
  capabilityId: z.string(),
  dependsOn: z.array(z.string()),
  requiresReview: z.boolean(),
  status: z.enum(['pending', 'running', 'awaiting-review', 'done', 'failed', 'skipped']),
  attempt: z.number().int().nonnegative(),
  isDelayed: z.boolean(),
  result: completedResultSchema.nullable(),
  failure: failureSchema.nullable(),
  adjustmentNote: z.string().nullable(),
});

export const runSchema: z.ZodType<Run> = z.object({ steps: z.array(stepRunSchema) });
