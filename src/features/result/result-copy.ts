import { isRealSource } from '../../domain/evidence/evidence';
import type { Deliverable, TracedSource } from '../../domain/result/deliverable';

export interface VerdictCopy {
  title: string;
  lead: string;
  nextStep: string;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export interface SourceCounts {
  real: number;
  simulated: number;
  aiMade: number;
}

/** Splits the sources three ways: backed by something real, simulated, or written by AI. */
export function countSources(sources: readonly TracedSource[]): SourceCounts {
  const real = sources.filter(({ source }) => isRealSource(source)).length;
  const simulated = sources.filter(({ source }) => source.isSynthetic).length;
  return { real, simulated, aiMade: sources.length - real - simulated };
}

/** "5 fuentes reales, 1 simulada y 3 elaboradas por IA", leaving out what is zero. */
export function describeSourceCounts(counts: SourceCounts): string {
  const parts = [
    counts.real > 0 && plural(counts.real, 'fuente real', 'fuentes reales'),
    counts.simulated > 0 && plural(counts.simulated, 'simulada', 'simuladas'),
    counts.aiMade > 0 && plural(counts.aiMade, 'elaborada por IA', 'elaboradas por IA'),
  ].filter((part) => part !== false);

  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} y ${parts.at(-1) ?? ''}`;
}

/**
 * The opening of the result: what the person can do with it, why, and what comes next.
 * It follows the voice guide: context first, no pressure, the decision stays with the person.
 */
export function verdictCopy(deliverable: Deliverable): VerdictCopy {
  const { verdict, evidence, skippedStepIds } = deliverable;

  if (verdict === 'incomplete') {
    return {
      title: 'Tu resultado quedó incompleto',
      lead: `No se ${skippedStepIds.length === 1 ? 'ejecutó' : 'ejecutaron'} ${plural(skippedStepIds.length, 'paso', 'pasos')} del plan. Lo que sí se completó está aquí, con su respaldo.`,
      nextStep: 'Puedes volver al plan para ejecutar lo que faltó o usar lo que ya tienes.',
    };
  }

  if (verdict === 'validate-first') {
    return {
      title: 'Aún falta respaldo para decidir con confianza',
      lead: evidence.isSyntheticOnly
        ? 'Lo que ves aquí viene de clientes simulados o de contenido elaborado por IA. Sirve para orientarte, no para confirmar.'
        : `Detrás de este resultado hay ${plural(evidence.realSourceCount, 'fuente real', 'fuentes reales')} y la evidencia es débil. Sirve para orientarte, no para confirmar.`,
      nextStep:
        'Antes de comprometer tiempo de tu equipo, puedes hablar con personas reales o sumar investigación al plan.',
    };
  }

  return {
    title: 'Tienes respaldo para dar el siguiente paso',
    lead: `Este resultado se apoya en ${plural(evidence.realSourceCount, 'fuente real', 'fuentes reales')}.${
      evidence.syntheticSourceCount > 0
        ? ' Las reacciones de clientes simulados orientan, pero no reemplazan una prueba con personas.'
        : ''
    }`,
    nextStep: 'Puedes guardarlo y llevarlo a tu equipo. Cada afirmación dice de dónde sale.',
  };
}
