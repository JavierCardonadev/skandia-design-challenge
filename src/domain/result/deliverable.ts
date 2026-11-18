import type { CompletedResult, EvidenceSource } from '../capabilities/types';
import { summarizeEvidence, type EvidenceSummary } from '../evidence/evidence';
import type { Run } from '../run/run';

/**
 * What the evidence lets the person do with the result. The platform does not decide
 * for them: it says how far the result can be trusted and what is missing.
 */
export type Verdict = 'ready-to-share' | 'validate-first' | 'incomplete';

export interface DeliverableSection {
  capabilityId: string;
  result: CompletedResult;
  /** A person approved this output before the run moved on. */
  wasReviewed: boolean;
}

export interface TracedSource {
  source: EvidenceSource;
  /** Capabilities whose output cites this source. */
  usedBy: string[];
}

export interface StepWarning {
  capabilityId: string;
  text: string;
}

export interface Deliverable {
  verdict: Verdict;
  evidence: EvidenceSummary;
  sections: DeliverableSection[];
  sources: TracedSource[];
  warnings: StepWarning[];
  /** Planned steps that did not run, so the result does not pass for complete. */
  skippedStepIds: string[];
  /** Capabilities the outputs themselves suggest running or repeating next. */
  suggestedStepIds: string[];
}

function traceSources(sections: readonly DeliverableSection[]): TracedSource[] {
  const traced = new Map<string, TracedSource>();
  for (const { capabilityId, result } of sections) {
    for (const source of result.evidence.sources) {
      const entry = traced.get(source.id) ?? { source, usedBy: [] };
      entry.usedBy.push(capabilityId);
      traced.set(source.id, entry);
    }
  }
  return [...traced.values()];
}

/** A step suggests itself when it should be repeated, or another one that has not been done. */
function suggestSteps(sections: readonly DeliverableSection[]): string[] {
  const doneIds = sections.map((section) => section.capabilityId);
  const suggested = sections.flatMap(({ capabilityId, result }) =>
    result.nextCapabilityIds.filter((id) => id === capabilityId || !doneIds.includes(id)),
  );
  return [...new Set(suggested)];
}

/** Consolidates a finished run into one deliverable, or null when nothing was completed. */
export function buildDeliverable(run: Run): Deliverable | null {
  const sections = run.steps.flatMap((step): DeliverableSection[] =>
    step.status === 'done' && step.result
      ? [{ capabilityId: step.capabilityId, result: step.result, wasReviewed: step.requiresReview }]
      : [],
  );
  const evidence = summarizeEvidence(sections.map((section) => section.result));
  if (!evidence) return null;

  const skippedStepIds = run.steps
    .filter((step) => step.status === 'skipped')
    .map((step) => step.capabilityId);

  let verdict: Verdict = 'ready-to-share';
  if (evidence.isWeak) verdict = 'validate-first';
  if (skippedStepIds.length > 0) verdict = 'incomplete';

  return {
    verdict,
    evidence,
    sections,
    sources: traceSources(sections),
    warnings: sections.flatMap(({ capabilityId, result }) =>
      result.warnings.map((text) => ({ capabilityId, text })),
    ),
    skippedStepIds,
    suggestedStepIds: suggestSteps(sections),
  };
}
