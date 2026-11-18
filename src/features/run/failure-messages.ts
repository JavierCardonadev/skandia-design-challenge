import type { FailureCode } from '../../domain/capabilities/types';

export interface FailureMessage {
  title: string;
  detail: string;
}

/*
 * What the person reads when a step fails. The technical message of a failure is
 * never shown: it is written for engineers and often in another language.
 */
const MESSAGES: Record<FailureCode, FailureMessage> = {
  timeout: {
    title: 'Este paso tardó más de lo esperado',
    detail: 'Lo detuvimos para no dejarte esperando. Lo que ya aprobaste sigue guardado.',
  },
  'source-unavailable': {
    title: 'No pudimos consultar una de las fuentes',
    detail: 'Una fuente de datos no respondió a tiempo. Lo que ya aprobaste sigue guardado.',
  },
  'incomplete-input': {
    title: 'A este paso le faltó información',
    detail: 'No recibió todo lo que necesita del paso anterior para empezar.',
  },
  'dependency-not-approved': {
    title: 'Este paso necesita una aprobación previa',
    detail: 'Depende de un resultado anterior que todavía no está aprobado.',
  },
  'unsupported-segment': {
    title: 'Todavía no podemos simular ese grupo de clientes',
    detail: 'El grupo que elegiste no está entre los disponibles para este paso.',
  },
  'invalid-output': {
    title: 'La respuesta llegó incompleta',
    detail: 'Preferimos no mostrarte un resultado a medias. Puedes pedirlo de nuevo.',
  },
  'provider-error': {
    title: 'No pudimos completar este paso',
    detail: 'Parece que algo no salió bien de nuestro lado. Lo que ya aprobaste sigue guardado.',
  },
  unknown: {
    title: 'No pudimos completar este paso',
    detail: 'Parece que algo no salió bien. Lo que ya aprobaste sigue guardado.',
  },
};

export function describeFailure(code: FailureCode): FailureMessage {
  return MESSAGES[code];
}
