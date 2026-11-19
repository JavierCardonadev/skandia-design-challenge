import type { Capability, CompletedResult } from '../capabilities/types';
import { pickField, postJson } from '../remote/post-json';
import type { CapabilityProvider } from './provider';

export const CAPABILITY_ENDPOINT = '/api/capability';

export interface RemoteProviderOptions {
  endpoint?: string;
  fetch?: typeof fetch;
}

/**
 * An output is grounded when something other than simulation stands behind it: a real
 * source of its own, or an earlier step that was itself grounded. Only outputs that rest
 * entirely on simulated clients or unsupported text are passed on as ungrounded.
 */
function isGrounded(result: CompletedResult): boolean {
  return result.evidence.sources.some((source) => !source.isSynthetic);
}

/**
 * Runs a capability with the live model, through the server. It sends the need and the
 * approved outputs of earlier steps; the server decides the evidence of the answer.
 * A failure is thrown: `executeCapability` turns it into a failed step the person can retry.
 */
export function createRemoteProvider(options: RemoteProviderOptions = {}): CapabilityProvider {
  const { endpoint = CAPABILITY_ENDPOINT, fetch } = options;

  return {
    async run({ capability, need, upstream, adjustmentNote, signal }) {
      const body = await postJson(
        endpoint,
        {
          capabilityId: capability.id,
          need,
          upstream: upstream.map((result) => ({
            capabilityId: result.capabilityId,
            level: result.evidence.level,
            isGrounded: isGrounded(result),
            content: result.content,
          })),
          adjustmentNote,
        },
        { service: 'Capability service', fetch, signal },
      );
      return pickField(body, 'result');
    },
  };
}

/** Sends each capability to the provider that should run it, e.g. the model or the simulation. */
export function createRoutingProvider(
  choose: (capability: Capability) => CapabilityProvider,
): CapabilityProvider {
  return { run: (request) => choose(request.capability).run(request) };
}
