import { useEffect, useReducer, useRef } from 'react';
import { requireCapability } from '../../domain/capabilities/catalog';
import type { CapabilityCatalog } from '../../domain/capabilities/types';
import { executeCapability, type CapabilityProvider } from '../../domain/providers/provider';
import {
  completedResults,
  createRun,
  getRunPhase,
  nextStepToRun,
  resumeRun,
  runReducer,
  type Run,
  type RunPhase,
} from '../../domain/run/run';

export interface RunExecution {
  run: Run;
  phase: RunPhase;
  approve: (capabilityId: string) => void;
  /** Sends an output back: with a note it is an adjustment, with null a redo from scratch. */
  requestRevision: (capabilityId: string, note: string | null) => void;
  retry: (capabilityId: string) => void;
  skip: (capabilityId: string) => void;
}

export interface RunExecutionOptions {
  catalog: CapabilityCatalog;
  stepIds: readonly string[];
  /** The redacted need, handed to every capability as context. */
  need: string;
  provider: CapabilityProvider;
  /** A run kept from before a reload. Without it the plan starts from the beginning. */
  initialRun?: Run | null;
  /** Same factor the provider uses, so "longer than expected" matches its pace. */
  speedFactor: number;
}

const MS_PER_SECOND = 1000;

/**
 * Drives a run: starts each step when the state machine allows it, hands the approved
 * outputs to the next capability and reports delays. All decisions stay in the reducer.
 */
export function useRunExecution(options: RunExecutionOptions): RunExecution {
  const { catalog, stepIds, need, provider, speedFactor, initialRun } = options;
  const [run, dispatch] = useReducer(runReducer, undefined, () =>
    initialRun ? resumeRun(initialRun) : createRun(catalog, stepIds),
  );

  // Effects read the latest run without re-running every time it changes.
  const latestRun = useRef(run);
  useEffect(() => {
    latestRun.current = run;
  }, [run]);

  const nextId = nextStepToRun(run)?.capabilityId ?? null;
  useEffect(() => {
    if (nextId) dispatch({ type: 'step-started', capabilityId: nextId });
  }, [nextId]);

  const running = run.steps.find((step) => step.status === 'running');
  const runningId = running?.capabilityId ?? null;
  const attempt = running?.attempt ?? 0;

  useEffect(() => {
    if (!runningId) return;

    const capability = requireCapability(catalog, runningId);
    const current = latestRun.current;
    const controller = new AbortController();
    const delayTimer = setTimeout(
      () => {
        dispatch({ type: 'step-delayed', capabilityId: runningId });
      },
      capability.typicalDuration.maxSeconds * MS_PER_SECOND * speedFactor,
    );

    void executeCapability(provider, {
      capability,
      need,
      attempt,
      upstream: completedResults(current),
      adjustmentNote:
        current.steps.find((step) => step.capabilityId === runningId)?.adjustmentNote ?? null,
      signal: controller.signal,
    }).then((result) => {
      // A new attempt or leaving the view makes this answer irrelevant.
      if (controller.signal.aborted) return;
      dispatch(
        result.status === 'completed'
          ? { type: 'step-completed', capabilityId: runningId, result }
          : { type: 'step-failed', capabilityId: runningId, failure: result.failure },
      );
    });

    return () => {
      controller.abort();
      clearTimeout(delayTimer);
    };
  }, [runningId, attempt, catalog, need, provider, speedFactor]);

  return {
    run,
    phase: getRunPhase(run),
    approve: (capabilityId) => {
      dispatch({ type: 'step-approved', capabilityId });
    },
    requestRevision: (capabilityId, note) => {
      dispatch({ type: 'step-revision-requested', capabilityId, note });
    },
    retry: (capabilityId) => {
      dispatch({ type: 'step-retried', capabilityId });
    },
    skip: (capabilityId) => {
      dispatch({ type: 'step-skipped', capabilityId });
    },
  };
}
