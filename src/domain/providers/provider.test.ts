import { describe, expect, it } from 'vitest';
import { kitCapability } from '../../test/fixtures';
import { executeCapability, type CapabilityProvider, type CapabilityRequest } from './provider';

const research = kitCapability('investigacion');
const request: CapabilityRequest = {
  capability: research,
  need: 'Quiero un simulador',
  attempt: 1,
  upstream: [],
  adjustmentNote: null,
};

function providerAnswering(answer: unknown): CapabilityProvider {
  return { run: () => Promise.resolve(answer) };
}

describe('executeCapability', () => {
  it('returns the validated result of a well formed answer', async () => {
    const result = await executeCapability(
      providerAnswering(research.simulatedResponses.normal),
      request,
    );

    expect(result).toMatchObject({ status: 'completed', capabilityId: 'investigacion' });
  });

  it('passes through a failure reported by the capability itself', async () => {
    const result = await executeCapability(
      providerAnswering(research.simulatedResponses.error),
      request,
    );

    expect(result).toMatchObject({
      status: 'failed',
      failure: { code: 'source-unavailable', retryable: true },
    });
  });

  it('turns an answer that breaks the contract into a retryable failure', async () => {
    const result = await executeCapability(
      providerAnswering({ respuesta: 'texto libre' }),
      request,
    );

    expect(result).toMatchObject({
      status: 'failed',
      capabilityId: 'investigacion',
      failure: { code: 'invalid-output', retryable: true },
    });
  });

  it('turns a provider that throws into a failure with its message', async () => {
    const result = await executeCapability(
      { run: () => Promise.reject(new Error('network down')) },
      request,
    );

    expect(result).toMatchObject({
      status: 'failed',
      failure: { code: 'provider-error', technicalMessage: 'network down' },
    });
  });

  it('handles a provider that rejects with something that is not an error', async () => {
    const provider: CapabilityProvider = {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- third-party code can reject with anything
      run: () => Promise.reject('boom'),
    };

    const result = await executeCapability(provider, request);

    expect(result).toMatchObject({ failure: { technicalMessage: 'Unknown error' } });
  });
});
