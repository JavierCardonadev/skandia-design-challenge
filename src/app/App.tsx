import { useCallback, useEffect, useMemo, useState } from 'react';
import { DesignSystemGate } from '../design-system';
import { kitCatalog } from '../domain/capabilities/kit-catalog';
import type { Run } from '../domain/run/run';
import type { BriefSnapshot } from '../features/brief/brief-session';
import { BriefView, type ConfirmedBrief } from '../features/brief/BriefView';
import { DemoScenarioPicker } from '../features/demo/DemoScenarioPicker';
import { buildSimulationScript, type ScenarioId } from '../features/demo/scenarios';
import { HistoryList } from '../features/history/HistoryList';
import { ResultView } from '../features/result/ResultView';
import { RunView } from '../features/run/RunView';
import { AppShell } from './AppShell';
import { createServices } from './services';
import { addToHistory, createSessionStore, type HistoryEntry } from './session-store';
import type { Stage } from './StageNav';
import styles from './App.module.css';

const services = createServices(kitCatalog, import.meta.env.VITE_LIVE_FRAMING === 'true');
const store = createSessionStore();

export function App() {
  // Read once: what the person left before a reload, already validated.
  const [restored] = useState(() => store.load(kitCatalog));

  const [scenario, setScenario] = useState<ScenarioId>(restored.scenario);
  const [brief, setBrief] = useState<BriefSnapshot | null>(restored.brief);
  const [confirmed, setConfirmed] = useState<ConfirmedBrief | null>(restored.confirmed);
  const [run, setRun] = useState<Run | null>(restored.run);
  const [finishedRun, setFinishedRun] = useState<Run | null>(restored.finishedRun);
  const [history, setHistory] = useState<HistoryEntry[]>(restored.history);
  /** A past result opened from the history. It is shown, not resumed. */
  const [opened, setOpened] = useState<HistoryEntry | null>(null);
  // Every start is a fresh run, and every restart a fresh brief.
  const [runNumber, setRunNumber] = useState(0);
  const [briefNumber, setBriefNumber] = useState(0);
  // The run kept from before the reload is only for the run view's first mount.
  const [runToResume, setRunToResume] = useState<Run | null>(restored.run);

  useEffect(() => {
    store.save({ scenario, brief, confirmed, run, finishedRun, history });
  }, [scenario, brief, confirmed, run, finishedRun, history]);

  const provider = useMemo(
    () => services.createProvider(buildSimulationScript(scenario, confirmed?.stepIds ?? [])),
    [scenario, confirmed],
  );

  const start = (confirmedBrief: ConfirmedBrief) => {
    setConfirmed(confirmedBrief);
    setRun(null);
    setRunToResume(null);
    setRunNumber((current) => current + 1);
  };
  const finish = (finished: Run) => {
    setFinishedRun(finished);
    setRun(null);
    if (confirmed) {
      const finishedAt = new Date().toISOString();
      setHistory((current) =>
        addToHistory(current, {
          id: finishedAt,
          finishedAt,
          needSummary: confirmed.brief.summary,
          run: finished,
        }),
      );
    }
  };
  const backToBrief = () => {
    setConfirmed(null);
    setRun(null);
    setFinishedRun(null);
    setOpened(null);
  };
  const restart = () => {
    backToBrief();
    setBrief(null);
    setBriefNumber((current) => current + 1);
  };
  // Stable, so the views can report changes from an effect without looping.
  const keepBrief = useCallback((snapshot: BriefSnapshot) => {
    setBrief(snapshot);
  }, []);
  const keepRun = useCallback((current: Run) => {
    setRun(current);
  }, []);

  let stage: Stage = 'brief';
  if (opened) stage = 'result';
  else if (confirmed) stage = finishedRun ? 'result' : 'run';

  return (
    <DesignSystemGate>
      <AppShell stage={stage}>
        {/* The brief stays mounted so going back to change the plan keeps what was written. */}
        <div key={briefNumber} className={styles.stage} hidden={stage !== 'brief'}>
          <BriefView
            catalog={kitCatalog}
            framers={services.framers}
            initial={briefNumber === 0 ? restored.brief : null}
            onChange={keepBrief}
            onStart={start}
          />
          <HistoryList
            entries={history}
            onOpen={(id) => {
              setOpened(history.find((entry) => entry.id === id) ?? null);
            }}
            onClear={() => {
              setHistory([]);
            }}
          />
          <DemoScenarioPicker
            scenario={scenario}
            isLiveFraming={services.isLive}
            onChange={setScenario}
          />
        </div>

        {!opened && confirmed && !finishedRun && (
          <RunView
            key={runNumber}
            catalog={kitCatalog}
            stepIds={confirmed.stepIds}
            need={confirmed.need}
            provider={provider}
            speedFactor={services.speedFactor}
            initialRun={runToResume}
            onRunChange={keepRun}
            onBack={backToBrief}
            onFinish={finish}
          />
        )}

        {!opened && confirmed && finishedRun && (
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

        {opened && (
          <ResultView
            key={opened.id}
            catalog={kitCatalog}
            run={opened.run}
            needSummary={opened.needSummary}
            onChangePlan={() => {
              setOpened(null);
            }}
            onRestart={restart}
          />
        )}
      </AppShell>
    </DesignSystemGate>
  );
}
