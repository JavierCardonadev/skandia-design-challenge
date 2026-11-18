import { ChoiceChips } from '../../design-system/extensions/ChoiceChips';
import { SCENARIOS, type ScenarioId } from './scenarios';
import styles from './DemoScenarioPicker.module.css';

export interface DemoScenarioPickerProps {
  scenario: ScenarioId;
  onChange: (scenario: ScenarioId) => void;
}

/** Lets a reviewer choose what happens when the plan runs. Clearly set apart from the product. */
export function DemoScenarioPicker({ scenario, onChange }: DemoScenarioPickerProps) {
  const selected = SCENARIOS.find((candidate) => candidate.id === scenario);

  return (
    <aside className={styles.picker} aria-label="Modo demostración">
      <p className={styles.title}>Modo demostración</p>
      <p className={styles.description}>
        Esta versión usa respuestas de ejemplo. Elige qué quieres ver cuando el plan se ejecute.
      </p>
      <ChoiceChips
        label="Escenario de la demostración"
        options={SCENARIOS.map((candidate) => candidate.label)}
        selected={selected?.label ?? null}
        onSelect={(label) => {
          const picked = SCENARIOS.find((candidate) => candidate.label === label);
          if (picked) onChange(picked.id);
        }}
      />
    </aside>
  );
}
