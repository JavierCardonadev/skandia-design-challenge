import { requireCapability } from '../domain/capabilities/catalog';
import { kitCatalog } from '../domain/capabilities/kit-catalog';
import { parseCapabilityResult } from '../domain/capabilities/result';
import type {
  Capability,
  CapabilityFailure,
  CompletedResult,
  SimulatedOutcome,
} from '../domain/capabilities/types';
import { createRun, runReducer, type Run, type RunEvent } from '../domain/run/run';

export function kitCapability(id: string): Capability {
  return requireCapability(kitCatalog, id);
}

/** A kit simulated response, parsed the same way the app parses it. */
export function kitResult(id: string, outcome: SimulatedOutcome = 'normal'): CompletedResult {
  const capability = kitCapability(id);
  const parsed = parseCapabilityResult(capability, capability.simulatedResponses[outcome]);
  if (!parsed.ok || parsed.result.status !== 'completed') {
    throw new Error(`Kit response ${id}/${outcome} is not a completed result`);
  }
  return parsed.result;
}

export const timeoutFailure: CapabilityFailure = {
  code: 'timeout',
  technicalMessage: 'render job exceeded 420s',
  retryable: true,
  durationSeconds: 420,
};

/** Wire-format envelopes for a minimal capability whose content is `{ resumen: "texto" }`. */
export function rawCompleted(capabilityId: string, overrides: Record<string, unknown> = {}) {
  return {
    estado: 'completado',
    capacidad: capabilityId,
    duracionSegundos: 10,
    evidencia: { nivel: 'media', resumen: 'Resumen', fuentes: [] },
    contenido: { resumen: 'Texto' },
    advertencias: [],
    siguientesCapacidades: [],
    ...overrides,
  };
}

export function rawFailed(capabilityId: string, codigo = 'TIEMPO_AGOTADO') {
  return {
    estado: 'error',
    capacidad: capabilityId,
    error: { codigo, mensaje: 'technical detail', reintentable: true, duracionSegundos: 3 },
  };
}

export function rawCapability(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    nombre: `Capacidad ${id}`,
    agente: null,
    queHace: 'Hace algo',
    descripcionNoTecnica: 'Hace algo útil',
    entradas: [{ campo: 'pregunta', tipo: 'texto', requerido: true, descripcion: 'La pregunta' }],
    salida: { tipo: 'resumen', esquema: { resumen: 'texto' } },
    duracionTipica: { minSegundos: 60, maxSegundos: 120 },
    requiereRevisionHumana: false,
    dependeDe: [],
    respuestasSimuladas: {
      normal: rawCompleted(id),
      evidenciaDebil: rawCompleted(id),
      error: rawFailed(id),
    },
    ...overrides,
  };
}

/** A run where every step of the plan finished with the given kind of kit response. */
export function finishedRun(stepIds: string[], outcome: SimulatedOutcome = 'normal'): Run {
  const events = stepIds.flatMap((id): RunEvent[] => [
    { type: 'step-started', capabilityId: id },
    { type: 'step-completed', capabilityId: id, result: kitResult(id, outcome) },
    { type: 'step-approved', capabilityId: id },
  ]);
  return events.reduce(runReducer, createRun(kitCatalog, stepIds));
}

export const FULL_PLAN = ['investigacion', 'contenido', 'estrategia', 'prototipado', 'validacion'];
