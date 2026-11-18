import type { CompletedResult, EvidenceLevel, EvidenceSource } from '../capabilities/types';

/** Below this many real sources the evidence is reported as weak ("few sources"). */
export const MIN_REAL_SOURCES = 2;

const LEVELS_FROM_WEAKEST: readonly EvidenceLevel[] = ['low', 'medium', 'high'];

export interface EvidenceSummary {
  level: EvidenceLevel;
  /** Distinct sources backed by real people, data, benchmarks or guidelines. */
  realSourceCount: number;
  /** Distinct sources that are simulated users or unsupported AI output. */
  syntheticSourceCount: number;
  /** Nothing in the results rests on a real source. */
  isSyntheticOnly: boolean;
  /** The person should treat the result as a lead, not as a confirmation. */
  isWeak: boolean;
}

/**
 * A source counts as real evidence when it is neither synthetic nor derived:
 * `generated` sources restate other outputs, so they add no independent backing.
 */
export function isRealSource(source: EvidenceSource): boolean {
  return !source.isSynthetic && source.kind !== 'synthetic' && source.kind !== 'generated';
}

export function weakestLevel(levels: readonly EvidenceLevel[]): EvidenceLevel | null {
  return LEVELS_FROM_WEAKEST.find((level) => levels.includes(level)) ?? null;
}

function distinctById(sources: EvidenceSource[]): EvidenceSource[] {
  return [...new Map(sources.map((source) => [source.id, source])).values()];
}

/**
 * Combines the evidence of several results into the signal shown with a deliverable.
 *
 * The level is the weakest among the results that rest on at least one real source.
 * Results backed only by simulated users or derived content do not lower it: they
 * are counted and flagged separately, because they guide but do not confirm.
 */
export function summarizeEvidence(results: readonly CompletedResult[]): EvidenceSummary | null {
  if (results.length === 0) return null;

  const sources = distinctById(results.flatMap((result) => result.evidence.sources));
  const realSourceCount = sources.filter(isRealSource).length;
  const groundedLevels = results
    .filter((result) => result.evidence.sources.some(isRealSource))
    .map((result) => result.evidence.level);
  const level = weakestLevel(groundedLevels) ?? 'low';

  return {
    level,
    realSourceCount,
    syntheticSourceCount: sources.filter((source) => source.isSynthetic).length,
    isSyntheticOnly: realSourceCount === 0,
    isWeak: level === 'low' || realSourceCount < MIN_REAL_SOURCES,
  };
}
