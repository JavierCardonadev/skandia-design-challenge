import { SkButton } from '../../design-system';
import { requireCapability } from '../../domain/capabilities/catalog';
import type { CapabilityCatalog } from '../../domain/capabilities/types';
import { dependentsOf } from '../../domain/plan/plan';
import type { CapabilityProvider } from '../../domain/providers/provider';
import type { Run, RunPhase } from '../../domain/run/run';
import { StepCard } from './StepCard';
import { useRunExecution } from './useRunExecution';
import styles from './RunView.module.css';

export interface RunViewProps {
  catalog: CapabilityCatalog;
  stepIds: readonly string[];
  provider: CapabilityProvider;
  speedFactor: number;
  /** Leaves the run to change the plan. Progress is not kept. */
  onBack: () => void;
  onFinish: (run: Run) => void;
}

function phaseMessage(phase: RunPhase, run: Run): string {
  const total = run.steps.length;
  const position = run.steps.findIndex((step) => step.status === 'running') + 1;

  switch (phase) {
    case 'running':
      return `Paso ${position} de ${total} en curso.`;
    case 'awaiting-review':
      return 'Hay un resultado esperando tu revisión.';
    case 'needs-attention':
      return 'Un paso necesita tu atención.';
    case 'finished':
      return 'Todos los pasos terminaron. Ya puedes ver el resultado.';
    case 'ready':
      return 'Preparando el siguiente paso.';
  }
}

/**
 * Second view: the plan as a vertical line of steps. Each one runs in turn, opens in
 * place when it needs a review or fails, and nothing moves on without the person.
 */
export function RunView({
  catalog,
  stepIds,
  provider,
  speedFactor,
  onBack,
  onFinish,
}: RunViewProps) {
  const { run, phase, approve, requestRevision, retry, skip } = useRunExecution({
    catalog,
    stepIds,
    provider,
    speedFactor,
  });
  const isFinished = phase === 'finished';

  return (
    <div className={styles.view}>
      <header className={styles.stack}>
        <h1>{isFinished ? 'Tu plan terminó' : 'Tu plan está en marcha'}</h1>
        <p role="status">{phaseMessage(phase, run)}</p>
      </header>

      <ol className={styles.steps}>
        {run.steps.map((step, index) => {
          const id = step.capabilityId;
          const blocked = dependentsOf(catalog, stepIds, id)
            .filter((dependent) =>
              run.steps.some((s) => s.capabilityId === dependent && s.status === 'pending'),
            )
            .map((dependent) => requireCapability(catalog, dependent).name);
          return (
            <StepCard
              key={id}
              position={index + 1}
              capability={requireCapability(catalog, id)}
              step={step}
              blockedStepNames={blocked}
              onApprove={() => {
                approve(id);
              }}
              onRevise={(note) => {
                requestRevision(id, note);
              }}
              onRetry={() => {
                retry(id);
              }}
              onSkip={() => {
                skip(id);
              }}
            />
          );
        })}
      </ol>

      <div className={styles.actions}>
        <SkButton label="Cambiar el plan" variant="tertiary" onClick={onBack} />
        {isFinished && (
          <SkButton
            label="Ver el resultado"
            icon="pi pi-arrow-right"
            iconPosition="right"
            onClick={() => {
              onFinish(run);
            }}
          />
        )}
      </div>
    </div>
  );
}
