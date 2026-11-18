import { useMemo, useState } from 'react';
import { DesignSystemGate, SkAlert } from '../design-system';
import { createLocalFramer } from '../domain/brief/local-framer';
import type { CompletedResult } from '../domain/capabilities/types';
import { kitCatalog } from '../domain/capabilities/kit-catalog';
import {
  createSimulatedProvider,
  DEFAULT_SPEED_FACTOR,
} from '../domain/providers/simulated-provider';
import { BriefView, type ConfirmedBrief } from '../features/brief/BriefView';
import { DemoScenarioPicker } from '../features/demo/DemoScenarioPicker';
import { buildSimulationScript, type ScenarioId } from '../features/demo/scenarios';
import { RunView } from '../features/run/RunView';
import { AppShell } from './AppShell';
import styles from './App.module.css';

const framer = createLocalFramer(kitCatalog);

export function App() {
  const [scenario, setScenario] = useState<ScenarioId>('normal');
  const [confirmed, setConfirmed] = useState<ConfirmedBrief | null>(null);
  const [results, setResults] = useState<CompletedResult[] | null>(null);
  // Every start is a fresh run, even with the same plan.
  const [runNumber, setRunNumber] = useState(0);

  const start = (brief: ConfirmedBrief) => {
    setConfirmed(brief);
    setRunNumber((current) => current + 1);
  };

  const provider = useMemo(
    () =>
      createSimulatedProvider({
        script: buildSimulationScript(scenario, confirmed?.stepIds ?? []),
      }),
    [scenario, confirmed],
  );

  return (
    <DesignSystemGate>
      <AppShell stage={confirmed ? 'run' : 'brief'}>
        {/* The brief stays mounted so going back to change the plan keeps what was written. */}
        <div className={styles.stage} hidden={confirmed !== null}>
          <BriefView catalog={kitCatalog} framer={framer} onStart={start} />
          <DemoScenarioPicker scenario={scenario} onChange={setScenario} />
        </div>

        {confirmed && (
          <RunView
            key={runNumber}
            catalog={kitCatalog}
            stepIds={confirmed.stepIds}
            provider={provider}
            speedFactor={DEFAULT_SPEED_FACTOR}
            onBack={() => {
              setConfirmed(null);
              setResults(null);
            }}
            onFinish={setResults}
          />
        )}

        {results && (
          // Interim confirmation until the result view takes over from here.
          <SkAlert
            tone="success"
            title="Tu resultado está listo"
            message={`Pasos que aportaron al resultado: ${results.length}.`}
          />
        )}
      </AppShell>
    </DesignSystemGate>
  );
}
