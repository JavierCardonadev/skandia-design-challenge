import { parseCapabilityResult } from '../capabilities/result';
import type {
  Capability,
  CapabilityResult,
  CompletedResult,
  FailedResult,
  FailureCode,
} from '../capabilities/types';

export interface CapabilityRequest {
  capability: Capability;
  /** The need as the person wrote it, already redacted, with their answers. */
  need: string;
  /** 1 for the first run of the step; grows with every retry, redo or adjustment. */
  attempt: number;
  /** Approved outputs of earlier steps: the context handed from one capability to the next. */
  upstream: readonly CompletedResult[];
  adjustmentNote: string | null;
  signal?: AbortSignal;
}

/**
 * Anything that can run a capability: the kit simulation or a live model.
 * The answer is untrusted on purpose; `executeCapability` validates it.
 */
export interface CapabilityProvider {
  run(request: CapabilityRequest): Promise<unknown>;
}

function failed(capabilityId: string, code: FailureCode, technicalMessage: string): FailedResult {
  return {
    status: 'failed',
    capabilityId,
    failure: { code, technicalMessage, retryable: true, durationSeconds: 0 },
  };
}

/**
 * Runs a capability and always resolves to a result the interface can render:
 * a thrown provider and an answer that breaks the contract both become failures.
 */
export async function executeCapability(
  provider: CapabilityProvider,
  request: CapabilityRequest,
): Promise<CapabilityResult> {
  const { id } = request.capability;

  let raw: unknown;
  try {
    raw = await provider.run(request);
  } catch (error) {
    return failed(id, 'provider-error', error instanceof Error ? error.message : 'Unknown error');
  }

  const outcome = parseCapabilityResult(request.capability, raw);
  return outcome.ok ? outcome.result : failed(id, 'invalid-output', outcome.issues.join('; '));
}
