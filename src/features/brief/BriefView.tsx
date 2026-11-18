import { useState } from 'react';
import { SkAlert, SkButton, SkCard, SkTextarea } from '../../design-system';
import type { BriefFramer, FramedBrief } from '../../domain/brief/framing';
import type { CapabilityCatalog } from '../../domain/capabilities/types';
import { PlanEditor } from './PlanEditor';
import { QuestionList } from './QuestionList';
import { SampleBriefs } from './SampleBriefs';
import { SensitiveDataNotice } from './SensitiveDataNotice';
import { UnderstoodPanel } from './UnderstoodPanel';
import { useBriefFraming } from './useBriefFraming';
import styles from './BriefView.module.css';

export interface ConfirmedBrief {
  brief: FramedBrief;
  stepIds: string[];
}

export interface BriefViewProps {
  catalog: CapabilityCatalog;
  framer: BriefFramer;
  onStart: (confirmed: ConfirmedBrief) => void;
}

/**
 * First view: the person writes a need once, sees what the platform understood,
 * answers only what is missing and edits the proposed plan before anything runs.
 */
export function BriefView({ catalog, framer, onStart }: BriefViewProps) {
  const [text, setText] = useState('');
  const [showEmptyError, setShowEmptyError] = useState(false);
  const { session, submit, answer, retry, removeFromPlan, addToPlan } = useBriefFraming(
    framer,
    catalog,
  );
  const { status, scan, brief, stepIds } = session;
  const isFraming = status === 'framing';

  const changeText = (value: string) => {
    setText(value);
    setShowEmptyError(false);
  };

  const submitNeed = () => {
    if (text.trim() === '') {
      setShowEmptyError(true);
      return;
    }
    submit(text);
  };

  return (
    <div className={styles.view}>
      <header className={styles.stack}>
        <h1>Cuéntanos qué necesitas resolver hoy</h1>
        <p>Escríbelo con tus palabras. Aquí verás qué entendimos y qué pasos puedes seguir.</p>
      </header>

      <SkCard>
        <div className={styles.stack}>
          <SkTextarea
            label="Tu necesidad"
            placeholder="Quiero saber si vale la pena…"
            helpText="No incluyas datos de clientes. Si aparece alguno, lo ocultamos antes de continuar."
            errorMessage={showEmptyError ? 'Escribe tu necesidad para continuar.' : ''}
            value={text}
            onValueChange={changeText}
          />
          <SampleBriefs onPick={changeText} />
          <SkButton label="Continuar" loading={isFraming} onClick={submitNeed} />
        </div>
      </SkCard>

      {scan && <SensitiveDataNotice scan={scan} />}

      {isFraming && (
        <p role="status" className={styles.progress}>
          Estamos leyendo tu necesidad. Tarda solo un momento.
        </p>
      )}

      {status === 'failed' && (
        <div className={styles.stack}>
          <SkAlert
            tone="error"
            title="No pudimos leer tu necesidad esta vez"
            message="Tu texto sigue aquí. Puedes intentarlo de nuevo."
          />
          <SkButton label="Intentar de nuevo" variant="secondary" onClick={retry} />
        </div>
      )}

      {brief && status !== 'failed' && (
        <>
          <UnderstoodPanel brief={brief} />
          {brief.questions.length > 0 ? (
            <QuestionList
              key={brief.questions.map((question) => question.id).join()}
              questions={brief.questions}
              isBusy={isFraming}
              onAnswer={answer}
            />
          ) : (
            <>
              <PlanEditor
                catalog={catalog}
                stepIds={stepIds}
                proposedSteps={brief.steps}
                onRemove={removeFromPlan}
                onAdd={addToPlan}
              />
              {stepIds.length > 0 && (
                <SkButton
                  label="Empezar con este plan"
                  icon="pi pi-arrow-right"
                  iconPosition="right"
                  onClick={() => {
                    onStart({ brief, stepIds });
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
