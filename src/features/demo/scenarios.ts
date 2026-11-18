import type { SimulationScript } from '../../domain/providers/simulated-provider';

/*
 * Demo scenarios. The public preview runs on the kit's simulated responses, so these
 * make every required state reachable on purpose instead of waiting for it to happen.
 */

export type ScenarioId = 'normal' | 'weak-evidence' | 'failure' | 'delay';

export interface Scenario {
  id: ScenarioId;
  label: string;
}

export const SCENARIOS: readonly Scenario[] = [
  { id: 'normal', label: 'Todo sale bien' },
  { id: 'weak-evidence', label: 'Hay poca evidencia' },
  { id: 'failure', label: 'Un paso falla' },
  { id: 'delay', label: 'Un paso se demora' },
];

/** Failures and delays hit the first step on its first attempt, so a retry recovers. */
export function buildSimulationScript(
  scenario: ScenarioId,
  stepIds: readonly string[],
): SimulationScript {
  const isFirstTry = (capabilityId: string, attempt: number) =>
    capabilityId === stepIds[0] && attempt === 1;

  switch (scenario) {
    case 'normal':
      return () => ({ outcome: 'normal' });
    case 'weak-evidence':
      return () => ({ outcome: 'weakEvidence' });
    case 'failure':
      return (id, attempt) => ({ outcome: isFirstTry(id, attempt) ? 'error' : 'normal' });
    case 'delay':
      return (id, attempt) => ({ outcome: 'normal', isSlow: isFirstTry(id, attempt) });
  }
}
