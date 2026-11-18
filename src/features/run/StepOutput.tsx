import type { Capability, CompletedResult } from '../../domain/capabilities/types';
import { ContentView } from '../shared/ContentView';
import { EvidencePanel } from '../shared/EvidencePanel';
import styles from './RunView.module.css';

export interface StepOutputProps {
  capability: Capability;
  result: CompletedResult;
}

/** What a step delivered: how reliable it is first, then its warnings, then the content. */
export function StepOutput({ capability, result }: StepOutputProps) {
  return (
    <div className={styles.stack}>
      <EvidencePanel evidence={result.evidence} />
      {result.warnings.length > 0 && (
        <div className={styles.warnings}>
          <p className={styles.warningsTitle}>Ten en cuenta</p>
          <ul>
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      <ContentView shape={capability.output.shape} content={result.content} />
    </div>
  );
}
