import type { FramedBrief } from '../../domain/brief/framing';
import type { SensitiveScan } from '../../domain/sensitive-data/sensitive-data';

export type BriefStatus = 'writing' | 'framing' | 'framed' | 'failed';

export interface BriefSession {
  status: BriefStatus;
  /** Scan of the need as submitted. Only its redacted text is ever sent anywhere. */
  scan: SensitiveScan | null;
  /** Answers given so far, already redacted. */
  answers: Record<string, string>;
  brief: FramedBrief | null;
  /** The plan as the person has edited it. */
  stepIds: string[];
  /** The brief on screen came from the local rules because the model could not be used. */
  usedFallback: boolean;
}

export type BriefEvent =
  | { type: 'framing-started'; scan: SensitiveScan; answers: Record<string, string> }
  | { type: 'framing-succeeded'; brief: FramedBrief; usedFallback: boolean }
  | { type: 'framing-failed' }
  | { type: 'plan-changed'; stepIds: string[] };

export const initialBriefSession: BriefSession = {
  status: 'writing',
  scan: null,
  answers: {},
  brief: null,
  stepIds: [],
  usedFallback: false,
};

/** What is kept of a brief between page loads. The text is the redacted one, never the original. */
export interface BriefSnapshot {
  text: string;
  answers: Record<string, string>;
  brief: FramedBrief | null;
  stepIds: string[];
  usedFallback: boolean;
}

export function toBriefSnapshot(session: BriefSession): BriefSnapshot {
  return {
    text: session.scan?.redactedText ?? '',
    answers: session.answers,
    // A brief still being read, or one that failed, is not worth restoring.
    brief: session.status === 'framed' ? session.brief : null,
    stepIds: session.status === 'framed' ? session.stepIds : [],
    usedFallback: session.usedFallback,
  };
}

/** Rebuilds the session from what was kept. The text was already redacted when it was saved. */
export function restoreBriefSession(snapshot: BriefSnapshot | null | undefined): BriefSession {
  if (!snapshot?.brief) return initialBriefSession;
  return {
    status: 'framed',
    scan: { findings: [], redactedText: snapshot.text },
    answers: snapshot.answers,
    brief: snapshot.brief,
    stepIds: snapshot.stepIds,
    usedFallback: snapshot.usedFallback,
  };
}

export function briefSessionReducer(session: BriefSession, event: BriefEvent): BriefSession {
  switch (event.type) {
    case 'framing-started':
      // The previous brief stays visible while the new one is prepared.
      return { ...session, status: 'framing', scan: event.scan, answers: event.answers };
    case 'framing-succeeded':
      return {
        ...session,
        status: 'framed',
        brief: event.brief,
        stepIds: event.brief.steps.map((step) => step.capabilityId),
        usedFallback: event.usedFallback,
      };
    case 'framing-failed':
      return { ...session, status: 'failed' };
    case 'plan-changed':
      return { ...session, stepIds: event.stepIds };
  }
}
