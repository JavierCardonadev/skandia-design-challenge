import { SkCard, SkTag } from '../../design-system';
import { RevealText } from '../../design-system/extensions/RevealText';
import type { FramedBrief } from '../../domain/brief/framing';
import styles from './BriefView.module.css';

export interface UnderstoodPanelProps {
  brief: FramedBrief;
}

/** Plays the need back so the person can check it before anything runs. */
export function UnderstoodPanel({ brief }: UnderstoodPanelProps) {
  return (
    <SkCard>
      <div className={styles.stack}>
        <h2>Esto fue lo que entendimos</h2>
        <p>
          <RevealText text={brief.summary} />
        </p>
        {brief.facts.length > 0 && (
          <dl className={styles.facts}>
            {brief.facts.map((fact) => (
              <div key={`${fact.label}-${fact.value}`} className={styles.fact}>
                <dt>{fact.label}</dt>
                <dd>
                  {fact.value}
                  {fact.isAssumption && (
                    <>
                      {' '}
                      <SkTag tone="warning">Lo supusimos</SkTag>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </SkCard>
  );
}
