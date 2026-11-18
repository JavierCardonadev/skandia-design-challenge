import styles from './ChoiceChips.module.css';

export interface ChoiceChipsProps {
  /** Names the group for assistive tech, e.g. the question being answered. */
  label: string;
  options: readonly string[];
  selected?: string | null;
  onSelect: (option: string) => void;
}

/**
 * Design system extension: a single-choice group of chips.
 * The kit has no selectable element (sk-tag is decorative and sk-card is not clickable),
 * and short closed answers read better as chips than as a text field.
 */
export function ChoiceChips({ label, options, selected = null, onSelect }: ChoiceChipsProps) {
  return (
    <div role="group" aria-label={label} className={styles.group}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={styles.chip}
          aria-pressed={option === selected}
          onClick={() => {
            onSelect(option);
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
