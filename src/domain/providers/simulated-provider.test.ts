import { afterEach, describe, expect, it, vi } from 'vitest';
import { kitCapability } from '../../test/fixtures';
import type { CapabilityRequest } from './provider';
import {
  createSimulatedProvider,
  DEFAULT_SPEED_FACTOR,
  waitFor,
  type Wait,
} from './simulated-provider';

const prototyping = kitCapability('prototipado');

function requestFor(attempt = 1): CapabilityRequest {
  return {
    capability: prototyping,
    need: 'Quiero un simulador',
    attempt,
    upstream: [],
    adjustmentNote: null,
  };
}

/** Records the requested delays and resolves at once. */
function instantWait() {
  const delays: number[] = [];
  const wait: Wait = (milliseconds) => {
    delays.push(milliseconds);
    return Promise.resolve();
  };
  return { delays, wait };
}

describe('createSimulatedProvider', () => {
  it('answers with the normal kit response after a compressed typical duration', async () => {
    const { delays, wait } = instantWait();
    const provider = createSimulatedProvider({ wait });

    const answer = await provider.run(requestFor());

    expect(answer).toBe(prototyping.simulatedResponses.normal);
    // Typical duration is 180 to 420 seconds: the midpoint, scaled down.
    expect(delays).toEqual([300 * 1000 * DEFAULT_SPEED_FACTOR]);
  });

  it('follows the script per capability and attempt', async () => {
    const { wait } = instantWait();
    const provider = createSimulatedProvider({
      wait,
      script: (_id, attempt) => ({ outcome: attempt === 1 ? 'error' : 'weakEvidence' }),
    });

    expect(await provider.run(requestFor(1))).toBe(prototyping.simulatedResponses.error);
    expect(await provider.run(requestFor(2))).toBe(prototyping.simulatedResponses.weakEvidence);
  });

  it('overruns the typical maximum when the script asks for a slow step', async () => {
    const { delays, wait } = instantWait();
    const provider = createSimulatedProvider({
      wait,
      speedFactor: 1,
      script: () => ({ outcome: 'normal', isSlow: true }),
    });

    await provider.run(requestFor());

    expect(delays).toEqual([630_000]);
  });
});

describe('waitFor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves once the time has passed', async () => {
    vi.useFakeTimers();
    const done = vi.fn();

    const waiting = waitFor(1000, new AbortController().signal).then(done);
    await vi.advanceTimersByTimeAsync(999);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await waiting;

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('rejects as soon as it is cancelled', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();

    const waiting = waitFor(1000, controller.signal);
    controller.abort();

    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects at once when it was already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(waitFor(1000, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('works without a signal', async () => {
    vi.useFakeTimers();

    const waiting = waitFor(50);
    await vi.advanceTimersByTimeAsync(50);

    await expect(waiting).resolves.toBeUndefined();
  });
});
