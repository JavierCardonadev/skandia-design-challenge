import { SkButton, SkCard, SkTag } from '../../design-system';
import type { PlannedStep } from '../../domain/brief/framing';
import { requireCapability } from '../../domain/capabilities/catalog';
import type { Capability, CapabilityCatalog } from '../../domain/capabilities/types';
import { dependentsOf, resolvePlan } from '../../domain/plan/plan';
import { formatPlanDuration, formatTypicalDuration } from '../shared/format';
import styles from './BriefView.module.css';

export interface PlanEditorProps {
  catalog: CapabilityCatalog;
  stepIds: readonly string[];
  /** The framer's proposal, used for the reason behind each step. */
  proposedSteps: readonly PlannedStep[];
  onRemove: (capabilityId: string) => void;
  onAdd: (capabilityId: string) => void;
}

function names(capabilities: readonly Capability[]): string {
  return capabilities.map((capability) => capability.name).join(', ');
}

/**
 * The proposed plan as an editable list. Order is not editable: it follows what each
 * step needs from the previous ones, so removing or adding a step explains its effect.
 */
export function PlanEditor({ catalog, stepIds, proposedSteps, onRemove, onAdd }: PlanEditorProps) {
  const byId = (id: string) => requireCapability(catalog, id);
  const steps = stepIds.map(byId);
  const available = catalog.capabilities.filter((capability) => !stepIds.includes(capability.id));
  return (
    <SkCard>
      <div className={styles.stack}>
        <h2>Este es el plan que te proponemos</h2>
        {steps.length > 0 ? (
          <p>
            Tarda {formatPlanDuration(steps)}, más el tiempo de tus revisiones. Puedes quitar o
            agregar pasos antes de empezar.
          </p>
        ) : (
          <p role="status">Tu plan está vacío. Agrega al menos un paso para empezar.</p>
        )}

        <ol className={styles.steps}>
          {steps.map((capability, index) => {
            const dependents = dependentsOf(catalog, stepIds, capability.id).map(byId);
            const proposed = proposedSteps.find((step) => step.capabilityId === capability.id);
            const reason = proposed?.reason ?? '';
            return (
              <li key={capability.id} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <div className={styles.stepBody}>
                  <h3>{capability.name}</h3>
                  <p>{capability.plainDescription}</p>
                  {reason && <p className={styles.reason}>{reason}</p>}
                  {proposed?.addedByPlatform && (
                    <p className={styles.hint}>
                      Lo agregamos al plan porque un paso siguiente lo necesita.
                    </p>
                  )}
                  <p className={styles.meta}>
                    Tarda {formatTypicalDuration(capability)}
                    {capability.requiresHumanReview && (
                      <>
                        {' · '}
                        <SkTag>Tú revisas el resultado</SkTag>
                      </>
                    )}
                  </p>
                  {dependents.length > 0 && (
                    <p className={styles.hint}>
                      Si lo quitas, también se quita: {names(dependents)}.
                    </p>
                  )}
                </div>
                <SkButton
                  label="Quitar"
                  ariaLabel={`Quitar ${capability.name}`}
                  variant="tertiary"
                  size="small"
                  fullWidth={false}
                  onClick={() => {
                    onRemove(capability.id);
                  }}
                />
              </li>
            );
          })}
        </ol>

        {available.length > 0 && (
          <div className={styles.stack}>
            <h3>Pasos que puedes agregar</h3>
            <ul className={styles.steps}>
              {available.map((capability) => {
                const required = resolvePlan(catalog, [...stepIds, capability.id])
                  .stepIds.filter((id) => id !== capability.id && !stepIds.includes(id))
                  .map(byId);
                return (
                  <li key={capability.id} className={styles.step}>
                    <div className={styles.stepBody}>
                      <h4>{capability.name}</h4>
                      <p>{capability.plainDescription}</p>
                      {required.length > 0 && (
                        <p className={styles.hint}>Necesita también: {names(required)}.</p>
                      )}
                    </div>
                    <SkButton
                      label="Agregar"
                      ariaLabel={`Agregar ${capability.name}`}
                      variant="tertiary"
                      size="small"
                      fullWidth={false}
                      onClick={() => {
                        onAdd(capability.id);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </SkCard>
  );
}
