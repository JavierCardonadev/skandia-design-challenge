import { useState } from 'react';
import { SkButton, SkCard, SkInputText } from '../../design-system';
import { ChoiceChips } from '../../design-system/extensions/ChoiceChips';
import type { BriefQuestion } from '../../domain/brief/framing';
import styles from './BriefView.module.css';

export interface QuestionListProps {
  questions: readonly BriefQuestion[];
  isBusy: boolean;
  onAnswer: (answers: Record<string, string>) => void;
}

/** Asks only what is missing. Closed questions are chips; open ones a single text field. */
export function QuestionList({ questions, isBusy, onAnswer }: QuestionListProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showMissing, setShowMissing] = useState(false);

  const setAnswer = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
  };
  const isAnswered = (question: BriefQuestion) => (answers[question.id] ?? '').trim() !== '';

  const submit = () => {
    if (!questions.every(isAnswered)) {
      setShowMissing(true);
      return;
    }
    onAnswer(answers);
  };

  return (
    <SkCard>
      <div className={styles.stack}>
        <h2>Ayúdanos con un poco más de contexto</h2>
        <p>Con esto podemos proponerte un plan que sí responda a lo que necesitas.</p>
        {questions.map((question) => (
          <div key={question.id} className={styles.question}>
            {question.options.length > 0 ? (
              <>
                <h3>{question.question}</h3>
                <ChoiceChips
                  label={question.question}
                  options={question.options}
                  selected={answers[question.id] ?? null}
                  onSelect={(option) => {
                    setAnswer(question.id, option);
                  }}
                />
              </>
            ) : (
              <SkInputText
                label={question.question}
                value={answers[question.id] ?? ''}
                onValueChange={(value) => {
                  setAnswer(question.id, value);
                }}
              />
            )}
            {showMissing && !isAnswered(question) && (
              <p className={styles.hint} role="alert">
                Nos falta esta respuesta para continuar.
              </p>
            )}
          </div>
        ))}
        <SkButton label="Continuar" loading={isBusy} onClick={submit} />
      </div>
    </SkCard>
  );
}
