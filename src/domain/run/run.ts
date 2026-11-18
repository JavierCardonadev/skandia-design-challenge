import { requireCapability } from '../capabilities/catalog';
import type { CapabilityCatalog, CapabilityFailure, CompletedResult } from '../capabilities/types';

export type StepStatus = 'pending' | 'running' | 'awaiting-review' | 'done' | 'failed' | 'skipped';

export interface StepRun {
  capabilityId: string;
  /** Snapshot of the contract taken when the run starts, so the reducer stays self-contained. */
  dependsOn: string[];
  requiresReview: boolean;
  status: StepStatus;
  /** How many times the step has been started. */
  attempt: number;
  /** The step is taking longer than the capability's typical maximum. */
  isDelayed: boolean;
  result: CompletedResult | null;
  failure: CapabilityFailure | null;
  /** What the person asked to change when they sent the output back. */
  adjustmentNote: string | null;
}

export interface Run {
  steps: StepRun[];
}

export type RunEvent =
  | { type: 'step-started'; capabilityId: string }
  | { type: 'step-delayed'; capabilityId: string }
  | { type: 'step-completed'; capabilityId: string; result: CompletedResult }
  | { type: 'step-failed'; capabilityId: string; failure: CapabilityFailure }
  | { type: 'step-approved'; capabilityId: string }
  /** The person rejected the output: with a note it is an adjustment, without one a redo. */
  | { type: 'step-revision-requested'; capabilityId: string; note: string | null }
  | { type: 'step-retried'; capabilityId: string }
  | { type: 'step-skipped'; capabilityId: string };

export type RunPhase = 'ready' | 'running' | 'awaiting-review' | 'needs-attention' | 'finished';

export function createRun(catalog: CapabilityCatalog, stepIds: readonly string[]): Run {
  return {
    steps: stepIds.map((id) => {
      const capability = requireCapability(catalog, id);
      return {
        capabilityId: id,
        dependsOn: capability.dependsOn,
        requiresReview: capability.requiresHumanReview,
        status: 'pending',
        attempt: 0,
        isDelayed: false,
        result: null,
        failure: null,
        adjustmentNote: null,
      };
    }),
  };
}

/** Applies `change` to one step, but only if it is in the status the event expects. */
function transition(
  run: Run,
  capabilityId: string,
  from: StepStatus,
  change: (step: StepRun) => Partial<StepRun>,
): Run {
  const target = run.steps.find((step) => step.capabilityId === capabilityId);
  if (target?.status !== from) return run;

  return {
    steps: run.steps.map((step) => (step === target ? { ...step, ...change(step) } : step)),
  };
}

/** Skips a failed step and every pending step that cannot run without it. */
function skipWithDependents(run: Run, capabilityId: string): Run {
  const target = run.steps.find((step) => step.capabilityId === capabilityId);
  if (target?.status !== 'failed') return run;

  const skipped = new Set([capabilityId]);
  // Steps are dependency-ordered, so a single pass reaches transitive dependents.
  const steps = run.steps.map((step): StepRun => {
    const isBlocked =
      step.status === 'pending' && step.dependsOn.some((dependency) => skipped.has(dependency));
    if (step !== target && !isBlocked) return step;

    skipped.add(step.capabilityId);
    return { ...step, status: 'skipped' };
  });
  return { steps };
}

/**
 * Pure state machine of a run. Events that do not apply to the step's current
 * status are ignored, so late or duplicated events cannot corrupt the run.
 */
export function runReducer(run: Run, event: RunEvent): Run {
  switch (event.type) {
    case 'step-started':
      return transition(run, event.capabilityId, 'pending', (step) => ({
        status: 'running',
        attempt: step.attempt + 1,
        isDelayed: false,
        failure: null,
      }));
    case 'step-delayed':
      return transition(run, event.capabilityId, 'running', () => ({ isDelayed: true }));
    case 'step-completed':
      return transition(run, event.capabilityId, 'running', (step) => ({
        status: step.requiresReview ? 'awaiting-review' : 'done',
        isDelayed: false,
        result: event.result,
      }));
    case 'step-failed':
      return transition(run, event.capabilityId, 'running', () => ({
        status: 'failed',
        isDelayed: false,
        failure: event.failure,
      }));
    case 'step-approved':
      return transition(run, event.capabilityId, 'awaiting-review', () => ({ status: 'done' }));
    case 'step-revision-requested':
      return transition(run, event.capabilityId, 'awaiting-review', () => ({
        status: 'pending',
        result: null,
        adjustmentNote: event.note,
      }));
    case 'step-retried':
      return transition(run, event.capabilityId, 'failed', () => ({ status: 'pending' }));
    case 'step-skipped':
      return skipWithDependents(run, event.capabilityId);
  }
}

const BLOCKING_STATUSES: readonly StepStatus[] = ['running', 'awaiting-review', 'failed'];

/**
 * The step to start now, or null. Steps run one at a time and nothing starts while
 * a step is running, waiting for the person's review or failed.
 */
export function nextStepToRun(run: Run): StepRun | null {
  if (run.steps.some((step) => BLOCKING_STATUSES.includes(step.status))) return null;

  const doneIds = run.steps.filter((s) => s.status === 'done').map((s) => s.capabilityId);
  const inPlan = run.steps.map((s) => s.capabilityId);
  return (
    run.steps.find(
      (step) =>
        step.status === 'pending' &&
        step.dependsOn.every((id) => doneIds.includes(id) || !inPlan.includes(id)),
    ) ?? null
  );
}

export function getRunPhase(run: Run): RunPhase {
  const has = (status: StepStatus) => run.steps.some((step) => step.status === status);

  if (has('failed')) return 'needs-attention';
  if (has('awaiting-review')) return 'awaiting-review';
  if (has('running')) return 'running';
  return has('pending') ? 'ready' : 'finished';
}

/** Results the person can rely on: produced, and approved where a review was required. */
export function completedResults(run: Run): CompletedResult[] {
  return run.steps.flatMap((step) => (step.status === 'done' && step.result ? [step.result] : []));
}
