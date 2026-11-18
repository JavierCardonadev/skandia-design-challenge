import { SkButton, SkCard, SkTag } from '../../design-system';
import { requireCapability } from '../../domain/capabilities/catalog';
import type { CapabilityCatalog } from '../../domain/capabilities/types';
import { buildDeliverable } from '../../domain/result/deliverable';
import type { Run } from '../../domain/run/run';
import { StepOutput } from '../run/StepOutput';
import { EVIDENCE_LEVELS, SOURCE_KINDS, sourceOrigin } from '../shared/evidence-labels';
import { countSources, describeSourceCounts, verdictCopy } from './result-copy';
import styles from './ResultView.module.css';

export interface ResultViewProps {
  catalog: CapabilityCatalog;
  run: Run;
  /** The need as the platform understood it, shown as the context of the result. */
  needSummary: string;
  onChangePlan: () => void;
  onRestart: () => void;
  onSave?: () => void;
}

/**
 * Third view: the consolidated deliverable. It opens with what the person can do with
 * the result and how far to trust it, then shows who produced what and from which sources.
 */
export function ResultView({
  catalog,
  run,
  needSummary,
  onChangePlan,
  onRestart,
  onSave = () => {
    window.print();
  },
}: ResultViewProps) {
  const deliverable = buildDeliverable(run);
  const nameOf = (id: string) => requireCapability(catalog, id).name;

  if (!deliverable) {
    return (
      <div className={styles.view}>
        <header className={styles.stack}>
          <h1>Todavía no hay un resultado</h1>
          <p>Ningún paso del plan llegó a completarse. Puedes volver al plan y ejecutarlo.</p>
        </header>
        <SkButton label="Volver al plan" onClick={onChangePlan} />
      </div>
    );
  }

  const copy = verdictCopy(deliverable);
  const level = EVIDENCE_LEVELS[deliverable.evidence.level];
  const counts = describeSourceCounts(countSources(deliverable.sources));

  return (
    <div className={styles.view}>
      <header className={styles.stack}>
        <p className={styles.context}>Tu encargo: {needSummary}</p>
        <h1>{copy.title}</h1>
        <p>{copy.lead}</p>
        <p className={styles.signal}>
          <SkTag tone={level.tone} size="large">
            {level.label}
          </SkTag>
          <span>Se apoya en {counts}.</span>
        </p>
      </header>

      <SkCard>
        <div className={styles.stack}>
          <h2>Qué puedes hacer ahora</h2>
          <p>{copy.nextStep}</p>
          {deliverable.suggestedStepIds.length > 0 && (
            <p>
              Los propios resultados sugieren repetir o sumar:{' '}
              {deliverable.suggestedStepIds.map(nameOf).join(', ')}.
            </p>
          )}
          {deliverable.skippedStepIds.length > 0 && (
            <p>No se ejecutó: {deliverable.skippedStepIds.map(nameOf).join(', ')}.</p>
          )}
          <div className={styles.actions}>
            <SkButton label="Empezar otro encargo" variant="tertiary" onClick={onRestart} />
            <SkButton label="Volver al plan" variant="secondary" onClick={onChangePlan} />
            <SkButton label="Guardar o imprimir" icon="pi pi-print" onClick={onSave} />
          </div>
        </div>
      </SkCard>

      {deliverable.warnings.length > 0 && (
        <section className={styles.warnings} aria-labelledby="result-warnings">
          <h2 id="result-warnings">Ten en cuenta</h2>
          <ul>
            {deliverable.warnings.map((warning) => (
              <li key={`${warning.capabilityId}-${warning.text}`}>
                {warning.text}{' '}
                <span className={styles.muted}>({nameOf(warning.capabilityId)})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.stack} aria-labelledby="result-sections">
        <h2 id="result-sections">Qué produjo cada paso</h2>
        {deliverable.sections.map(({ capabilityId, result, wasReviewed }) => {
          const capability = requireCapability(catalog, capabilityId);
          return (
            <article key={capabilityId} className={styles.section}>
              <header className={styles.sectionHeader}>
                <h3>{capability.name}</h3>
                <p className={styles.muted}>
                  {capability.agentName
                    ? `Lo elaboró el agente ${capability.agentName} con IA.`
                    : 'Lo elaboró un panel de clientes simulados con IA.'}{' '}
                  {wasReviewed
                    ? 'Tú lo revisaste y aprobaste.'
                    : 'No necesitó revisión de una persona.'}
                </p>
              </header>
              <StepOutput capability={capability} result={result} />
            </article>
          );
        })}
      </section>

      <section className={styles.stack} aria-labelledby="result-sources">
        <h2 id="result-sources">De dónde sale cada cosa</h2>
        <p>Todas las fuentes del resultado, con los pasos que se apoyan en cada una.</p>
        <div className={styles.tableWrap}>
          <table className={styles.sources}>
            <thead>
              <tr>
                <th scope="col">Fuente</th>
                <th scope="col">Qué es</th>
                <th scope="col">Origen</th>
                <th scope="col">La usan</th>
              </tr>
            </thead>
            <tbody>
              {deliverable.sources.map(({ source, usedBy }) => {
                const origin = sourceOrigin(source);
                return (
                  <tr key={source.id}>
                    <th scope="row">{source.id}</th>
                    <td>
                      {source.description}
                      <span className={styles.muted}> · {SOURCE_KINDS[source.kind]}</span>
                    </td>
                    <td>
                      <SkTag tone={origin.tone}>{origin.label}</SkTag>
                    </td>
                    <td>{usedBy.map(nameOf).join(', ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
