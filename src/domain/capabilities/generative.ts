import { parseCapabilityResult } from './result';
import type { Capability, SourceKind } from './types';

/** Kinds of source that only exist if someone went and gathered them outside the platform. */
const GATHERED_KINDS: readonly SourceKind[] = ['qualitative', 'quantitative', 'benchmark'];

/**
 * True when a capability's value is the evidence it brings from the outside world:
 * interviews, usage data, a review of other companies. A language model cannot produce
 * that, only invent it, so such a capability is never handed to the model.
 * The catalog decides: it is read from the sources of the capability's reference response.
 */
export function gathersRealEvidence(capability: Capability): boolean {
  const reference = parseCapabilityResult(capability, capability.simulatedResponses.normal);
  if (!reference.ok || reference.result.status !== 'completed') return false;

  return reference.result.evidence.sources.some((source) => GATHERED_KINDS.includes(source.kind));
}

/** A capability that plays the part of clients: whatever it returns is simulated by definition. */
export function simulatesClients(capability: Capability): boolean {
  return capability.availableSegments.length > 0;
}

/** A capability a language model can run honestly: it works from what earlier steps produced. */
export function canRunOnModel(capability: Capability): boolean {
  return !gathersRealEvidence(capability);
}
