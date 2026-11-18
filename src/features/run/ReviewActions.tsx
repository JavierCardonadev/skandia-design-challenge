import { useState } from 'react';
import { SkButton, SkTextarea } from '../../design-system';
import styles from './RunView.module.css';

export interface ReviewActionsProps {
  onApprove: () => void;
  onAdjust: (note: string) => void;
  onRedo: () => void;
}

/**
 * The human checkpoint: approve, ask for a specific change or have the step redone.
 * Asking for a change needs a note, so the capability knows what to change.
 */
export function ReviewActions({ onApprove, onAdjust, onRedo }: ReviewActionsProps) {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [note, setNote] = useState('');
  const [showEmptyError, setShowEmptyError] = useState(false);

  const sendAdjustment = () => {
    if (note.trim() === '') {
      setShowEmptyError(true);
      return;
    }
    onAdjust(note.trim());
  };

  if (isAdjusting) {
    return (
      <div className={styles.stack}>
        <SkTextarea
          label="¿Qué quieres que cambie?"
          helpText="Rehacemos este paso con tu indicación. Los pasos ya aprobados no cambian."
          errorMessage={showEmptyError ? 'Cuéntanos qué cambiar para rehacerlo.' : ''}
          value={note}
          onValueChange={(value) => {
            setNote(value);
            setShowEmptyError(false);
          }}
        />
        <div className={styles.actions}>
          <SkButton
            label="Cancelar"
            variant="secondary"
            onClick={() => {
              setIsAdjusting(false);
            }}
          />
          <SkButton label="Enviar ajuste" onClick={sendAdjustment} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <p className={styles.reviewPrompt}>
        Revisa este resultado antes de seguir. El siguiente paso se construye sobre él.
      </p>
      <div className={styles.actions}>
        <SkButton label="Rehacer desde cero" variant="tertiary" onClick={onRedo} />
        <SkButton
          label="Pedir un ajuste"
          variant="secondary"
          onClick={() => {
            setIsAdjusting(true);
          }}
        />
        <SkButton label="Aprobar y seguir" onClick={onApprove} />
      </div>
    </div>
  );
}
