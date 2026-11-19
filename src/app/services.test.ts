import { afterEach, describe, expect, it, vi } from 'vitest';
import { kitCatalog } from '../domain/capabilities/kit-catalog';
import { DEFAULT_SPEED_FACTOR } from '../domain/providers/simulated-provider';
import { kitCapability } from '../test/fixtures';
import { createServices, LIVE_SPEED_FACTOR } from './services';

const normal = () => ({ outcome: 'normal' as const });

function requestFor(capabilityId: string) {
  return {
    capability: kitCapability(capabilityId),
    need: 'Quiero un simulador',
    attempt: 1,
    upstream: [],
    adjustmentNote: null,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createServices in demo mode', () => {
  it('runs everything on the kit and writes no verdict with a model', async () => {
    vi.useFakeTimers();
    const send = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', send);
    const services = createServices(kitCatalog, false);

    const pending = services.createProvider(normal).run(requestFor('contenido'));
    await vi.runAllTimersAsync();

    expect(await pending).toBe(kitCapability('contenido').simulatedResponses.normal);
    expect(send).not.toHaveBeenCalled();
    expect(services).toMatchObject({
      isLive: false,
      verdictWriter: null,
      speedFactor: DEFAULT_SPEED_FACTOR,
    });
    expect(services.framers.fallback).toBeUndefined();
  });
});

describe('createServices in live mode', () => {
  it('hands the model what it can run and keeps real evidence on the kit', async () => {
    vi.useFakeTimers();
    const envelope = { estado: 'completado' };
    const send = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ result: envelope })));
    vi.stubGlobal('fetch', send);
    const provider = createServices(kitCatalog, true).createProvider(normal);

    expect(await provider.run(requestFor('contenido'))).toEqual(envelope);
    expect(send).toHaveBeenCalledTimes(1);

    const research = provider.run(requestFor('investigacion'));
    await vi.runAllTimersAsync();

    expect(await research).toBe(kitCapability('investigacion').simulatedResponses.normal);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('writes verdicts with the model and waits longer before calling a step slow', () => {
    const services = createServices(kitCatalog, true);

    expect(services.isLive).toBe(true);
    expect(services.verdictWriter).not.toBeNull();
    expect(services.speedFactor).toBe(LIVE_SPEED_FACTOR);
    expect(services.framers.fallback).toBeDefined();
  });
});
