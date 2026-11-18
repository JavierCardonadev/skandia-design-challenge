import { useCallback, useEffect, useReducer, useRef } from 'react';
import { frameBrief, type BriefFramer } from '../../domain/brief/framing';
import type { CapabilityCatalog } from '../../domain/capabilities/types';
import { removeStep, resolvePlan } from '../../domain/plan/plan';
import { scanSensitiveData, type SensitiveScan } from '../../domain/sensitive-data/sensitive-data';
import { briefSessionReducer, initialBriefSession, type BriefSession } from './brief-session';

export interface BriefFraming {
  session: BriefSession;
  /** Frames a new need from scratch. */
  submit: (text: string) => void;
  /** Adds answers to the pending questions and frames again. */
  answer: (answers: Record<string, string>) => void;
  /** Repeats the last framing attempt after a failure. */
  retry: () => void;
  removeFromPlan: (capabilityId: string) => void;
  addToPlan: (capabilityId: string) => void;
}

/**
 * Owns the brief view's session: scans what the person writes, sends only the
 * redacted version to the framer and keeps the editable plan.
 */
export function useBriefFraming(framer: BriefFramer, catalog: CapabilityCatalog): BriefFraming {
  const [session, dispatch] = useReducer(briefSessionReducer, initialBriefSession);
  const inFlight = useRef<AbortController | null>(null);

  const abortInFlight = useCallback(() => {
    inFlight.current?.abort();
  }, []);
  useEffect(() => abortInFlight, [abortInFlight]);

  const frame = useCallback(
    async (scan: SensitiveScan, answers: Record<string, string>) => {
      abortInFlight();
      const controller = new AbortController();
      inFlight.current = controller;

      dispatch({ type: 'framing-started', scan, answers });
      const outcome = await frameBrief(framer, catalog, {
        text: scan.redactedText,
        answers,
        signal: controller.signal,
      });
      // A newer attempt or an unmount makes this answer irrelevant.
      if (controller.signal.aborted) return;

      dispatch(
        outcome.ok
          ? { type: 'framing-succeeded', brief: outcome.brief }
          : { type: 'framing-failed' },
      );
    },
    [framer, catalog, abortInFlight],
  );

  const { scan, answers, stepIds } = session;

  return {
    session,
    submit: (text) => {
      void frame(scanSensitiveData(text), {});
    },
    answer: (newAnswers) => {
      if (!scan) return;
      // Answers are free text too, so they get the same treatment as the need.
      const redacted = Object.fromEntries(
        Object.entries(newAnswers).map(([id, value]) => [
          id,
          scanSensitiveData(value).redactedText,
        ]),
      );
      void frame(scan, { ...answers, ...redacted });
    },
    retry: () => {
      if (scan) void frame(scan, answers);
    },
    removeFromPlan: (capabilityId) => {
      dispatch({
        type: 'plan-changed',
        stepIds: removeStep(catalog, stepIds, capabilityId).stepIds,
      });
    },
    addToPlan: (capabilityId) => {
      // Resolving in catalog order keeps the plan in its natural sequence after an addition.
      const wanted = catalog.capabilities
        .map((capability) => capability.id)
        .filter((id) => id === capabilityId || stepIds.includes(id));
      dispatch({ type: 'plan-changed', stepIds: resolvePlan(catalog, wanted).stepIds });
    },
  };
}
