import { SkTag } from '../../design-system';
import type { Evidence } from '../../domain/capabilities/types';
import { EVIDENCE_LEVELS, SOURCE_KINDS, sourceOrigin } from './evidence-labels';
import styles from './shared.module.css';

export interface EvidencePanelProps {
  evidence: Evidence;
}

/**
 * How much an output can be trusted and where it comes from. The level is always
 * written out, never colour alone, and every source says whether it is real or simulated.
 */
export function EvidencePanel({ evidence }: EvidencePanelProps) {
  const level = EVIDENCE_LEVELS[evidence.level];

  return (
    <section className={styles.evidence} aria-label="Qué tan confiable es">
      <p className={styles.evidenceHeadline}>
        <SkTag tone={level.tone} size="large">
          {level.label}
        </SkTag>
        <span>{evidence.summary}</span>
      </p>
      <ul className={styles.sources}>
        {evidence.sources.map((source) => {
          const origin = sourceOrigin(source);
          return (
            <li key={source.id} className={styles.source}>
              <span className={styles.sourceId}>{source.id}</span>
              <span>
                {source.description}
                <span className={styles.muted}> · {SOURCE_KINDS[source.kind]}</span>
              </span>
              <SkTag tone={origin.tone}>{origin.label}</SkTag>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
