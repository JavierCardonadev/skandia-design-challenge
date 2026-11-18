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
  /** The framer left this step out although a later one needs it; the platform put it back. */
  addedByPlatform: boolean;
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

/** The contract of a framer's answer, checked on whatever a framer returns. */
export const framedBriefSchema = z.object({
  summary: nonEmptyText,
  facts: z.array(z.object({ label: nonEmptyText, value: nonEmptyText, isAssumption: z.boolean() })),
  questions: z
    .array(z.object({ id: nonEmptyText, question: nonEmptyText, options: z.array(nonEmptyText) }))
    .max(MAX_QUESTIONS),
  steps: z.array(z.object({ capabilityId: nonEmptyText, reason: z.string() })),
});

/** A framer's answer before validation: what the local rules build and what a model is asked for. */
export type RawBrief = z.input<typeof framedBriefSchema>;

/**
 * Validates the shape, then repairs what a model typically gets wrong without making
 * the answer useless: capabilities it invented are dropped, dependencies it skipped are
 * added back (and flagged), and questions the person already answered are removed.
 */
function toFramedBrief(
  catalog: CapabilityCatalog,
  request: FramingRequest,
  raw: unknown,
): FramingOutcome {
  const parsed = framedBriefSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: formatIssues(parsed.error) };

  const { steps, questions, ...brief } = parsed.data;
  const reasons = new Map(steps.map((step) => [step.capabilityId, step.reason]));
  const plan = resolvePlan(catalog, [...reasons.keys()]);
  const pendingQuestions = questions.filter((question) => !(question.id in request.answers));

  if (pendingQuestions.length === 0 && plan.stepIds.length === 0) {
    return { ok: false, issues: ['The brief has no pending questions and no runnable steps'] };
  }

  return {
    ok: true,
    brief: {
      ...brief,
      questions: pendingQuestions,
      steps: plan.stepIds.map((id) => ({
        capabilityId: id,
        reason: reasons.get(id) ?? '',
        addedByPlatform: plan.addedDependencyIds.includes(id),
      })),
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
  return toFramedBrief(catalog, request, raw);
}

export interface Framers {
  primary: BriefFramer;
  /** Used when the primary fails or answers out of contract. Omitted when the primary is local. */
  fallback?: BriefFramer;
}

export interface FramingAttempt {
  outcome: FramingOutcome;
  /** The brief on screen came from the fallback, not from the primary framer. */
  usedFallback: boolean;
  /** Why the primary was not used, for logs and for explaining the failure afterwards. */
  primaryIssues: string[];
}

/**
 * Tries the primary framer and, if it fails for any reason other than being cancelled,
 * falls back so the person still gets a brief instead of a dead end.
 */
export async function frameBriefWithFallback(
  framers: Framers,
  catalog: CapabilityCatalog,
  request: FramingRequest,
): Promise<FramingAttempt> {
  const primary = await frameBrief(framers.primary, catalog, request);
  if (primary.ok || !framers.fallback || request.signal?.aborted) {
    return { outcome: primary, usedFallback: false, primaryIssues: [] };
  }

  return {
    outcome: await frameBrief(framers.fallback, catalog, request),
    usedFallback: true,
    primaryIssues: primary.issues,
  };
}
