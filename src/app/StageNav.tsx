import styles from './StageNav.module.css';

export type Stage = 'brief' | 'run' | 'result';

const STAGES: readonly { id: Stage; label: string }[] = [
  { id: 'brief', label: 'Encargo' },
  { id: 'run', label: 'Ejecución' },
  { id: 'result', label: 'Resultado' },
];

export interface StageNavProps {
  current: Stage;
}

/**
 * Design system extension: shows where the person is in the three-stage journey.
 * It is an indicator, not navigation: stages follow one another.
 */
export function StageNav({ current }: StageNavProps) {
  const currentIndex = STAGES.findIndex((stage) => stage.id === current);

  return (
    <nav aria-label="Etapas">
      <ol className={styles.stages}>
        {STAGES.map((stage, index) => (
          <li
            key={stage.id}
            className={styles.stage}
            data-state={index < currentIndex ? 'past' : index === currentIndex ? 'current' : 'next'}
            aria-current={index === currentIndex ? 'step' : undefined}
          >
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            {stage.label}
          </li>
        ))}
      </ol>
    </nav>
  );
}
