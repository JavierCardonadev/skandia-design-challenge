import type { ContentShape } from './content-shape';

export type EvidenceLevel = 'high' | 'medium' | 'low';

export type SourceKind =
  'qualitative' | 'quantitative' | 'benchmark' | 'guideline' | 'synthetic' | 'generated';

export interface EvidenceSource {
  id: string;
  kind: SourceKind;
  description: string;
  /** True when nothing backs the source in real people: simulated users or unsupported AI output. */
  isSynthetic: boolean;
}

export interface Evidence {
  level: EvidenceLevel;
  summary: string;
  sources: EvidenceSource[];
}

export type FailureCode =
  | 'timeout'
  | 'incomplete-input'
  | 'dependency-not-approved'
  | 'source-unavailable'
  | 'unsupported-segment'
  /** The provider answered, but the answer did not match the capability contract. */
  | 'invalid-output'
  /** The provider could not be reached or threw. */
  | 'provider-error'
  | 'unknown';

export interface CapabilityFailure {
  code: FailureCode;
  /** Written for engineers. Never shown to the person as is. */
  technicalMessage: string;
  retryable: boolean;
  durationSeconds: number;
}

export interface CompletedResult {
  status: 'completed';
  capabilityId: string;
  durationSeconds: number;
  evidence: Evidence;
  /** Shaped by the capability's own output descriptor; keys stay as the catalog declares them. */
  content: Record<string, unknown>;
  warnings: string[];
  nextCapabilityIds: string[];
}

export interface FailedResult {
  status: 'failed';
  capabilityId: string;
  failure: CapabilityFailure;
}

export type CapabilityResult = CompletedResult | FailedResult;

export interface CapabilityInput {
  field: string;
  type: string;
  required: boolean;
  description: string;
}

export type SimulatedOutcome = 'normal' | 'weakEvidence' | 'error';

export interface Capability {
  id: string;
  name: string;
  /** Internal agent behind the capability. Kept for traceability, not for navigation. */
  agentName: string | null;
  summary: string;
  plainDescription: string;
  inputs: CapabilityInput[];
  output: { type: string; shape: ContentShape };
  typicalDuration: { minSeconds: number; maxSeconds: number };
  requiresHumanReview: boolean;
  dependsOn: string[];
  availableSegments: string[];
  /** Raw kit responses. They go through the same validation as a live provider's output. */
  simulatedResponses: Record<SimulatedOutcome, unknown>;
}

export interface CapabilityCatalog {
  capabilities: Capability[];
}
