import { describe, expect, it, vi } from 'vitest';
import { kitCapability, kitResult } from '../../test/fixtures';
import type { CapabilityProvider, CapabilityRequest } from './provider';
import { createRemoteProvider, createRoutingProvider } from './remote-provider';

const content = kitCapability('contenido');

function requestFor(overrides: Partial<CapabilityRequest> = {}): CapabilityRequest {
  return {
    capability: content,
    need: 'Quiero un simulador',
    attempt: 1,
    upstream: [kitResult('investigacion'), kitResult('validacion')],
    adjustmentNote: 'Más corto',
    ...overrides,
  };
}

describe('createRemoteProvider', () => {
  it('sends the need, the approved steps and the adjustment, and returns the envelope', async () => {
    const envelope = { estado: 'completado' };
    const send = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ result: envelope })));
    const { signal } = new AbortController();

    const answer = await createRemoteProvider({ fetch: send }).run(requestFor({ signal }));

    expect(answer).toEqual(envelope);
    const [endpoint, init] = send.mock.calls[0] ?? [];
    expect(endpoint).toBe('/api/capability');
    expect(init?.signal).toBe(signal);
    expect(JSON.parse(init?.body as string)).toEqual({
      capabilityId: 'contenido',
      need: 'Quiero un simulador',
      upstream: [
        {
          capabilityId: 'investigacion',
          level: 'high',
          isGrounded: true,
          content: kitResult('investigacion').content,
        },
        {
          capabilityId: 'validacion',
          level: 'low',
          isGrounded: false,
          content: kitResult('validacion').content,
        },
      ],
      adjustmentNote: 'Más corto',
    });
  });

  it('throws when the service fails, so the step can be retried', async () => {
    const send = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ error: 'truncated' }, { status: 502 })),
    );

    await expect(
      createRemoteProvider({ endpoint: '/custom', fetch: send }).run(requestFor()),
    ).rejects.toThrow('Capability service answered 502 (truncated)');
    expect(send.mock.calls[0]?.[0]).toBe('/custom');
  });

  it('returns nothing usable when the answer carries no result', async () => {
    const send = vi.fn<typeof fetch>(() => Promise.resolve(Response.json('unexpected')));

    expect(await createRemoteProvider({ fetch: send }).run(requestFor())).toBeNull();
  });
});

describe('createRoutingProvider', () => {
  it('sends each capability to the provider chosen for it', async () => {
    const model: CapabilityProvider = { run: () => Promise.resolve('model') };
    const simulated: CapabilityProvider = { run: () => Promise.resolve('simulated') };
    const provider = createRoutingProvider((capability) =>
      capability.id === 'contenido' ? model : simulated,
    );

    expect(await provider.run(requestFor())).toBe('model');
    expect(await provider.run(requestFor({ capability: kitCapability('investigacion') }))).toBe(
      'simulated',
    );
  });
});
