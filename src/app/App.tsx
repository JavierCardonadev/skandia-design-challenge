import { useMemo, useState } from 'react';
import { DesignSystemGate } from '../design-system';
import { kitCatalog } from '../domain/capabilities/kit-catalog';
import type { Run } from '../domain/run/run';
import { BriefView, type ConfirmedBrief } from '../features/brief/BriefView';
import { DemoScenarioPicker } from '../features/demo/DemoScenarioPicker';
import { buildSimulationScript, type ScenarioId } from '../features/demo/scenarios';
import { ResultView } from '../features/result/ResultView';
import { RunView } from '../features/run/RunView';
import { AppShell } from './AppShell';
import { createServices } from './services';
import type { Stage } from './StageNav';
import styles from './App.module.css';

const services = createServices(kitCatalog, import.meta.env.VITE_LIVE_FRAMING === 'true');

export function App() {
  const [scenario, setScenario] = useState<ScenarioId>('normal');
  const [confirmed, setConfirmed] = useState<ConfirmedBrief | null>(null);
  const [finishedRun, setFinishedRun] = useState<Run | null>(null);
  // Every start is a fresh run, and every restart a fresh brief.
  const [runNumber, setRunNumber] = useState(0);
  const [briefNumber, setBriefNumber] = useState(0);

  const provider = useMemo(
    () => services.createProvider(buildSimulationScript(scenario, confirmed?.stepIds ?? [])),
    [scenario, confirmed],
  );

  const start = (brief: ConfirmedBrief) => {
    setConfirmed(brief);
    setRunNumber((current) => current + 1);
  };
  const backToBrief = () => {
    setConfirmed(null);
    setFinishedRun(null);
  };
  const restart = () => {
    backToBrief();
    setBriefNumber((current) => current + 1);
  };

  let stage: Stage = 'brief';
  if (confirmed) stage = finishedRun ? 'result' : 'run';

  return (
    <DesignSystemGate>
      <AppShell stage={stage}>
        {/* The brief stays mounted so going back to change the plan keeps what was written. */}
        <div key={briefNumber} className={styles.stage} hidden={stage !== 'brief'}>
          <BriefView catalog={kitCatalog} framers={services.framers} onStart={start} />
          <DemoScenarioPicker
            scenario={scenario}
            isLiveFraming={services.isLive}
            onChange={setScenario}
          />
        </div>

        {confirmed && !finishedRun && (
          <RunView
            key={runNumber}
            catalog={kitCatalog}
            stepIds={confirmed.stepIds}
            need={confirmed.need}
            provider={provider}
            speedFactor={services.speedFactor}
            onBack={backToBrief}
            onFinish={setFinishedRun}
          />
        )}

        {confirmed && finishedRun && (
          <ResultView
            catalog={kitCatalog}
            run={finishedRun}
            needSummary={confirmed.brief.summary}
            need={confirmed.need}
            verdictWriter={services.verdictWriter}
            onChangePlan={backToBrief}
            onRestart={restart}
          />
        )}
      </AppShell>
    </DesignSystemGate>
  );
}
