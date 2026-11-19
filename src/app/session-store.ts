import { z } from 'zod';
import { findCapability } from '../domain/capabilities/catalog';
import type { CapabilityCatalog } from '../domain/capabilities/types';
import { runSchema } from '../domain/run/run-schema';
import type { Run } from '../domain/run/run';
import type { BriefSnapshot } from '../features/brief/brief-session';
import type { ConfirmedBrief } from '../features/brief/BriefView';
import type { ScenarioId } from '../features/demo/scenarios';

/** A finished result the person can open again. */
export interface HistoryEntry {
  id: string;
  finishedAt: string;
  needSummary: string;
  run: Run;
}

/** Everything the app keeps between page loads. */
export interface SessionSnapshot {
  scenario: ScenarioId;
  brief: BriefSnapshot | null;
  confirmed: ConfirmedBrief | null;
  /** The run in progress, if the person had started the plan. */
  run: Run | null;
  finishedRun: Run | null;
  history: HistoryEntry[];
}

export const EMPTY_SNAPSHOT: SessionSnapshot = {
  scenario: 'normal',
  brief: null,
  confirmed: null,
  run: null,
  finishedRun: null,
  history: [],
};

/** Older results are dropped: the history is a convenience, not an archive. */
export const MAX_HISTORY = 5;

const STORAGE_KEY = 'skandia-platform';
/** Bumped when the stored shape changes; anything saved under another version is ignored. */
const VERSION = 1;

const framedBriefSchema = z.object({
  summary: z.string(),
  facts: z.array(z.object({ label: z.string(), value: z.string(), isAssumption: z.boolean() })),
  questions: z.array(
    z.object({ id: z.string(), question: z.string(), options: z.array(z.string()) }),
  ),
  steps: z.array(
    z.object({ capabilityId: z.string(), reason: z.string(), addedByPlatform: z.boolean() }),
  ),
});

const storedSchema = z.object({
  version: z.literal(VERSION),
  scenario: z.enum(['normal', 'weak-evidence', 'failure', 'delay']),
  brief: z
    .object({
      text: z.string(),
      answers: z.record(z.string(), z.string()),
      brief: framedBriefSchema.nullable(),
      stepIds: z.array(z.string()),
      usedFallback: z.boolean(),
    })
    .nullable(),
  confirmed: z
    .object({ brief: framedBriefSchema, stepIds: z.array(z.string()), need: z.string() })
    .nullable(),
  run: runSchema.nullable(),
  finishedRun: runSchema.nullable(),
  history: z
    .array(
      z.object({
        id: z.string(),
        finishedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
        needSummary: z.string(),
        run: runSchema,
      }),
    )
    .max(MAX_HISTORY),
});

/** Steps of a capability that is no longer in the catalog cannot be shown or resumed. */
function usesOnlyKnownCapabilities(catalog: CapabilityCatalog, snapshot: SessionSnapshot): boolean {
  const runs = [snapshot.run, snapshot.finishedRun, ...snapshot.history.map((entry) => entry.run)];
  const ids = [
    ...(snapshot.brief?.stepIds ?? []),
    ...(snapshot.confirmed?.stepIds ?? []),
    ...runs.flatMap((run) => run?.steps.map((step) => step.capabilityId) ?? []),
  ];
  return ids.every((id) => findCapability(catalog, id) !== undefined);
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Storage can be blocked by the browser; the app then works without remembering.
    return null;
  }
}

export interface SessionStore {
  load(catalog: CapabilityCatalog): SessionSnapshot;
  save(snapshot: SessionSnapshot): void;
}

/**
 * Keeps the session in the browser so a reload does not lose the work. Only redacted
 * text is ever stored, and what is read back is validated before use: anything that
 * does not fit (another version, a manual edit, a retired capability) is discarded.
 */
export function createSessionStore(storage: Storage | null = browserStorage()): SessionStore {
  return {
    load(catalog) {
      try {
        const stored = storedSchema.safeParse(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'));
        if (!stored.success) return EMPTY_SNAPSHOT;

        const { scenario, brief, confirmed, run, finishedRun, history } = stored.data;
        const snapshot = { scenario, brief, confirmed, run, finishedRun, history };
        return usesOnlyKnownCapabilities(catalog, snapshot) ? snapshot : EMPTY_SNAPSHOT;
      } catch {
        return EMPTY_SNAPSHOT;
      }
    },
    save(snapshot) {
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...snapshot }));
      } catch {
        // A full or blocked storage must never break the flow the person is in.
      }
    },
  };
}

/** Adds a finished result to the history, newest first, keeping only the latest few. */
export function addToHistory(
  history: readonly HistoryEntry[],
  entry: HistoryEntry,
): HistoryEntry[] {
  return [entry, ...history.filter((existing) => existing.id !== entry.id)].slice(0, MAX_HISTORY);
}
