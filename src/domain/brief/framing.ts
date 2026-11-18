import { z } from 'zod';
import type { CapabilityCatalog } from '../capabilities/types';
import { formatIssues } from '../capabilities/zod-issues';
import { resolvePlan } from '../plan/plan';

/** Something the platform understood from the need, or assumed to keep going. */
export interface BriefFact {
  label: string;
  value: string;
  /** True when the person never said it: shown as an assumption they can correct. */
  isAssumption: boolean;
}

/** What the platform asks instead of guessing. No options means a free-text answer. */
export interface BriefQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface PlannedStep {
  capabilityId: string;
  /** Why this step serves this particular need, in plain language. May be empty. */
  reason: string;
}

export interface FramedBrief {
  summary: string;
  facts: BriefFact[];
  /** Empty when the need is clear enough to propose a plan. */
  questions: BriefQuestion[];
  steps: PlannedStep[];
}

export interface FramingRequest {
  /** The need as written by the person, already redacted. */
  text: string;
  /** Answers to earlier questions, by question id, already redacted. */
  answers: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Turns a need into a brief and a plan: the local rules or a live model.
 * The answer is untrusted; `frameBrief` validates it.
 */
export interface BriefFramer {
  frame(request: FramingRequest): Promise<unknown>;
}

export type FramingOutcome = { ok: true; brief: FramedBrief } | { ok: false; issues: string[] };

/** More questions than this stops being "asking for precision" and becomes a form. */
export const MAX_QUESTIONS = 3;

const nonEmptyText = z.string().trim().min(1);

/** The contract of a framer's answer. This is the schema a live model is asked to follow. */
export const framedBriefSchema = z.object({
  summary: nonEmptyText,
  facts: z.array(z.object({ label: nonEmptyText, value: nonEmptyText, isAssumption: z.boolean() })),
  questions: z
    .array(z.object({ id: nonEmptyText, question: nonEmptyText, options: z.array(nonEmptyText) }))
    .max(MAX_QUESTIONS),
  steps: z.array(z.object({ capabilityId: nonEmptyText, reason: z.string() })),
});

/**
 * Validates the shape, then makes the plan runnable: steps the catalog does not know
 * are dropped (a model can invent capabilities) and missing dependencies are added.
 */
function toFramedBrief(catalog: CapabilityCatalog, raw: unknown): FramingOutcome {
  const parsed = framedBriefSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: formatIssues(parsed.error) };

  const { steps, ...brief } = parsed.data;
  const reasons = new Map(steps.map((step) => [step.capabilityId, step.reason]));
  const { stepIds } = resolvePlan(catalog, [...reasons.keys()]);

  if (brief.questions.length === 0 && stepIds.length === 0) {
    return { ok: false, issues: ['The brief has no questions and no runnable steps'] };
  }

  return {
    ok: true,
    brief: {
      ...brief,
      steps: stepIds.map((id) => ({ capabilityId: id, reason: reasons.get(id) ?? '' })),
    },
  };
}

/** Frames a need and always resolves: a framer that throws becomes a failed outcome. */
export async function frameBrief(
  framer: BriefFramer,
  catalog: CapabilityCatalog,
  request: FramingRequest,
): Promise<FramingOutcome> {
  let raw: unknown;
  try {
    raw = await framer.frame(request);
  } catch (error) {
    return { ok: false, issues: [error instanceof Error ? error.message : 'Unknown error'] };
  }
  return toFramedBrief(catalog, raw);
}
