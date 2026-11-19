import type { Framers } from '../domain/brief/framing';
import { canRunOnModel } from '../domain/capabilities/generative';
import type { CapabilityCatalog } from '../domain/capabilities/types';
import type { CapabilityProvider } from '../domain/providers/provider';
import { createRemoteProvider, createRoutingProvider } from '../domain/providers/remote-provider';
import {
  createSimulatedProvider,
  DEFAULT_SPEED_FACTOR,
  type SimulationScript,
} from '../domain/providers/simulated-provider';
import { createRemoteVerdictWriter } from '../domain/result/remote-verdict-writer';
import type { VerdictWriter } from '../domain/result/verdict';
import { createFramers } from './framers';

/**
 * A live capability answers in seconds, not in the kit's minutes. This factor sets when
 * a live step counts as "taking longer than usual": 18 to 42 seconds, by capability.
 */
export const LIVE_SPEED_FACTOR = 0.1;

/** Everything the views need from outside: who frames, who runs steps, who writes verdicts. */
export interface Services {
  isLive: boolean;
  framers: Framers;
  verdictWriter: VerdictWriter | null;
  speedFactor: number;
  createProvider: (script: SimulationScript) => CapabilityProvider;
}

/**
 * Demo mode runs entirely on the kit's simulated responses. Live mode hands the model
 * every capability it can run honestly; the one that stands for real evidence keeps
 * using the kit, because a model could only invent that evidence.
 */
export function createServices(catalog: CapabilityCatalog, isLive: boolean): Services {
  const framers = createFramers(catalog, isLive);

  if (!isLive) {
    return {
      isLive,
      framers,
      verdictWriter: null,
      speedFactor: DEFAULT_SPEED_FACTOR,
      createProvider: (script) => createSimulatedProvider({ script }),
    };
  }

  const model = createRemoteProvider();
  return {
    isLive,
    framers,
    verdictWriter: createRemoteVerdictWriter(),
    speedFactor: LIVE_SPEED_FACTOR,
    createProvider: (script) => {
      const simulated = createSimulatedProvider({ script });
      return createRoutingProvider((capability) => (canRunOnModel(capability) ? model : simulated));
    },
  };
}
