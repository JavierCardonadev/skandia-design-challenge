import { z } from 'zod';
import { formatIssues } from '../capabilities/zod-issues';
import { isRealSource } from '../evidence/evidence';
import type { Deliverable, Verdict } from './deliverable';

/** What the person asked for: do it, check something first, or do not do it. */
export type Decision = 'go' | 'validate-first' | 'no-go';

export interface VerdictReason {
  text: string;
  /** Sources of the result that back this reason. Never empty. */
  sourceIds: string[];
}

export interface ModelVerdict {
  decision: Decision;
  headline: string;
  reasons: VerdictReason[];
  nextStep: string;
}

/**
 * The fixed evidence rules bound what the model may conclude: it can be more cautious
 * than the evidence, never more confident. Weak or incomplete evidence rules out "go".
 */
export const ALLOWED_DECISIONS: Record<Verdict, readonly Decision[]> = {
  'ready-to-share': ['go', 'validate-first', 'no-go'],
  'validate-first': ['validate-first', 'no-go'],
  incomplete: ['validate-first', 'no-go'],
};

const MAX_HEADLINE_WORDS = 18;
const MIN_REASONS = 1;
const MAX_REASONS = 4;

const text = z.string().trim().min(1);

/** The schema the model is asked to fill. Kept to what constrained decoding can enforce. */
export const modelVerdictSchema = z.object({
  decision: z.enum(['go', 'validate-first', 'no-go']),
  headline: z.string(),
  reasons: z.array(z.object({ text: z.string(), sourceIds: z.array(z.string()) })),
  nextStep: z.string(),
});

const strictVerdictSchema = z.object({
  decision: z.enum(['go', 'validate-first', 'no-go']),
  headline: text,
  reasons: z
    .array(z.object({ text, sourceIds: z.array(text) }))
    .min(MIN_REASONS)
    .max(MAX_REASONS),
  nextStep: text,
});

export type VerdictOutcome = { ok: true; verdict: ModelVerdict } | { ok: false; issues: string[] };

/**
 * Checks a model-written verdict against the result it talks about. Shape is not
 * enough: the decision must fit what the evidence rules allow, every reason must cite
 * sources that exist, and going ahead must rest on at least one real source.
 */
export function parseModelVerdict(deliverable: Deliverable, raw: unknown): VerdictOutcome {
  const parsed = strictVerdictSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: formatIssues(parsed.error) };

  const verdict = parsed.data;
  const issues: string[] = [];

  if (!ALLOWED_DECISIONS[deliverable.verdict].includes(verdict.decision)) {
    issues.push(
      `decision: "${verdict.decision}" claims more than the evidence supports (${deliverable.verdict})`,
    );
  }
  if (verdict.headline.split(/\s+/).length > MAX_HEADLINE_WORDS) {
    issues.push(`headline: longer than ${MAX_HEADLINE_WORDS} words`);
  }

  const known = new Map(deliverable.sources.map(({ source }) => [source.id, source]));
  verdict.reasons.forEach((reason, index) => {
    const unknown = reason.sourceIds.filter((id) => !known.has(id));
    if (reason.sourceIds.length === 0) issues.push(`reasons.${index}: cites no source`);
    if (unknown.length > 0) {
      issues.push(`reasons.${index}: cites unknown sources ${unknown.join(', ')}`);
    }
  });

  const citesRealSource = verdict.reasons.some((reason) =>
    reason.sourceIds.some((id) => {
      const source = known.get(id);
      return source !== undefined && isRealSource(source);
    }),
  );
  if (verdict.decision === 'go' && !citesRealSource) {
    issues.push('decision: "go" is not backed by any real source');
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, verdict };
}

/** What a verdict writer needs to know about a result. Built from the deliverable. */
export interface VerdictInput {
  need: string;
  ruleVerdict: Verdict;
  evidence: { level: string; realSourceCount: number; syntheticSourceCount: number };
  skippedSteps: string[];
  sections: { step: string; content: Record<string, unknown>; warnings: string[] }[];
  sources: { id: string; description: string; origin: 'real' | 'simulated' | 'ai-made' }[];
}

export function toVerdictInput(
  deliverable: Deliverable,
  need: string,
  nameOf: (capabilityId: string) => string,
): VerdictInput {
  return {
    need,
    ruleVerdict: deliverable.verdict,
    evidence: {
      level: deliverable.evidence.level,
      realSourceCount: deliverable.evidence.realSourceCount,
      syntheticSourceCount: deliverable.evidence.syntheticSourceCount,
    },
    skippedSteps: deliverable.skippedStepIds.map(nameOf),
    sections: deliverable.sections.map(({ capabilityId, result }) => ({
      step: nameOf(capabilityId),
      content: result.content,
      warnings: result.warnings,
    })),
    sources: deliverable.sources.map(({ source }) => {
      const origin = isRealSource(source) ? 'real' : source.isSynthetic ? 'simulated' : 'ai-made';
      return { id: source.id, description: source.description, origin };
    }),
  };
}

/** Writes the recommendation of a result: the live model. The answer is untrusted. */
export interface VerdictWriter {
  write(input: VerdictInput, signal?: AbortSignal): Promise<unknown>;
}

/** Asks for a verdict and always resolves: a writer that throws becomes a failed outcome. */
export async function requestVerdict(
  writer: VerdictWriter,
  deliverable: Deliverable,
  input: VerdictInput,
  signal?: AbortSignal,
): Promise<VerdictOutcome> {
  let raw: unknown;
  try {
    raw = await writer.write(input, signal);
  } catch (error) {
    return { ok: false, issues: [error instanceof Error ? error.message : 'Unknown error'] };
  }
  return parseModelVerdict(deliverable, raw);
}
