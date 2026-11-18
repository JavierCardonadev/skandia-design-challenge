import { SkButton } from '../../design-system';
import type { Capability } from '../../domain/capabilities/types';
import type { StepRun } from '../../domain/run/run';
import { formatTypicalDuration } from '../shared/format';
import { describeFailure } from './failure-messages';
import { ReviewActions } from './ReviewActions';
import { StepOutput } from './StepOutput';
import styles from './RunView.module.css';

export interface StepCardProps {
  position: number;
  capability: Capability;
  step: StepRun;
  /** Names of the steps that will not run if this one is skipped. */
  blockedStepNames: readonly string[];
  onApprove: () => void;
  onRevise: (note: string | null) => void;
  onRetry: () => void;
  onSkip: () => void;
}

function statusLine(step: StepRun, capability: Capability): string {
  switch (step.status) {
    case 'pending':
      return step.attempt > 0 ? 'En espera para rehacerse' : 'En espera';
    case 'running':
      return step.isDelayed
        ? 'Está tardando más de lo habitual. Seguimos en ello; no necesitas hacer nada.'
        : `En curso. Suele tardar ${formatTypicalDuration(capability)}.`;
    case 'awaiting-review':
      return 'Espera tu revisión';
    case 'done':
      return step.requiresReview ? 'Listo. Lo aprobaste.' : 'Listo';
    case 'failed':
      return 'Necesita tu atención';
    case 'skipped':
      return 'No se ejecutó';
  }
}

/** One step of the run. It opens in place when it needs the person and folds once done. */
export function StepCard(props: StepCardProps) {
  const { position, capability, step, blockedStepNames } = props;
  const failure = step.failure && describeFailure(step.failure.code);

  return (
    <li className={styles.step} data-status={step.status}>
      <span className={styles.marker} aria-hidden="true">
        {step.status === 'done' ? <i className="pi pi-check" /> : position}
      </span>
      <div className={styles.stepBody}>
        <h2 className={styles.stepName}>{capability.name}</h2>
        <p className={styles.status}>{statusLine(step, capability)}</p>

        {step.status === 'running' && <div className={styles.activity} aria-hidden="true" />}

        {step.adjustmentNote && step.status !== 'done' && (
          <p className={styles.note}>Tu indicación: «{step.adjustmentNote}»</p>
        )}

        {step.status === 'awaiting-review' && step.result && (
          <>
            <StepOutput capability={capability} result={step.result} />
            <ReviewActions
              onApprove={props.onApprove}
              onAdjust={props.onRevise}
              onRedo={() => {
                props.onRevise(null);
              }}
            />
          </>
        )}

        {step.status === 'done' && step.result && (
          <details className={styles.delivered}>
            <summary>Ver lo que entregó</summary>
            <StepOutput capability={capability} result={step.result} />
          </details>
        )}

        {step.status === 'failed' && failure && step.failure && (
          <div className={styles.failure} role="alert">
            <p className={styles.failureTitle}>{failure.title}</p>
            <p>{failure.detail}</p>
            {blockedStepNames.length > 0 && (
              <p>Si sigues sin este paso, tampoco se ejecutan: {blockedStepNames.join(', ')}.</p>
            )}
            <div className={styles.actions}>
              <SkButton label="Seguir sin este paso" variant="secondary" onClick={props.onSkip} />
              {step.failure.retryable && (
                <SkButton label="Intentar de nuevo" onClick={props.onRetry} />
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
