import type { SimulatedOutcome } from '../capabilities/types';
import type { CapabilityProvider } from './provider';

export interface SimulationStep {
  outcome: SimulatedOutcome;
  /** Answer later than the capability's typical maximum, to exercise the "delayed" state. */
  isSlow?: boolean;
}

/** Decides how a capability behaves on a given attempt. Lets a demo fail once and then recover. */
export type SimulationScript = (capabilityId: string, attempt: number) => SimulationStep;

export type Wait = (milliseconds: number, signal?: AbortSignal) => Promise<void>;

export interface SimulatedProviderOptions {
  script?: SimulationScript;
  /** Multiplies real durations (minutes) so a demo takes seconds. 1 keeps real time. */
  speedFactor?: number;
  wait?: Wait;
}

/** Real capabilities take 1 to 7 minutes; the demo compresses that to a few seconds. */
export const DEFAULT_SPEED_FACTOR = 0.02;

/** A slow step overruns the typical maximum by this ratio. */
const SLOW_OVERRUN_RATIO = 1.5;

export const waitFor: Wait = (milliseconds, signal) =>
  new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('The simulated capability was cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);

    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });

const alwaysNormal: SimulationScript = () => ({ outcome: 'normal' });

/** Answers with the kit's canned responses after a delay proportional to the real duration. */
export function createSimulatedProvider(
  options: SimulatedProviderOptions = {},
): CapabilityProvider {
  const { script = alwaysNormal, speedFactor = DEFAULT_SPEED_FACTOR, wait = waitFor } = options;

  return {
    async run({ capability, attempt, signal }) {
      const step = script(capability.id, attempt);
      const { minSeconds, maxSeconds } = capability.typicalDuration;
      const seconds = step.isSlow ? maxSeconds * SLOW_OVERRUN_RATIO : (minSeconds + maxSeconds) / 2;

      await wait(seconds * 1000 * speedFactor, signal);
      return capability.simulatedResponses[step.outcome];
    },
  };
}
