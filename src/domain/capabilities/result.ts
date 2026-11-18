import { z } from 'zod';
import { buildContentSchema } from './content-shape';
import type {
  Capability,
  CapabilityResult,
  CompletedResult,
  EvidenceLevel,
  FailedResult,
  FailureCode,
  SourceKind,
} from './types';
import { formatIssues } from './zod-issues';

/*
 * Wire format: the common envelope every capability answers with, exactly as the
 * kit defines it (Spanish keys). Nothing outside this module depends on it.
 */

const EVIDENCE_LEVELS: Record<'alta' | 'media' | 'baja', EvidenceLevel> = {
  alta: 'high',
  media: 'medium',
  baja: 'low',
};

const SOURCE_KINDS: Record<
  'cualitativa' | 'cuantitativa' | 'benchmark' | 'lineamiento' | 'sintetica' | 'generada',
  SourceKind
> = {
  cualitativa: 'qualitative',
  cuantitativa: 'quantitative',
  benchmark: 'benchmark',
  lineamiento: 'guideline',
  sintetica: 'synthetic',
  generada: 'generated',
};

const FAILURE_CODES: Partial<Record<string, FailureCode>> = {
  TIEMPO_AGOTADO: 'timeout',
  ENTRADA_INCOMPLETA: 'incomplete-input',
  DEPENDENCIA_NO_APROBADA: 'dependency-not-approved',
  FUENTE_NO_DISPONIBLE: 'source-unavailable',
  SEGMENTO_NO_SOPORTADO: 'unsupported-segment',
};

const completedEnvelopeSchema = z.object({
  estado: z.literal('completado'),
  capacidad: z.string(),
  duracionSegundos: z.number().nonnegative(),
  evidencia: z.object({
    nivel: z.enum(['alta', 'media', 'baja']),
    resumen: z.string(),
    fuentes: z.array(
      z.object({
        id: z.string(),
        tipo: z.enum([
          'cualitativa',
          'cuantitativa',
          'benchmark',
          'lineamiento',
          'sintetica',
          'generada',
        ]),
        descripcion: z.string(),
        esSintetica: z.boolean(),
      }),
    ),
  }),
  contenido: z.record(z.string(), z.unknown()),
  advertencias: z.array(z.string()),
  siguientesCapacidades: z.array(z.string()),
});

const failedEnvelopeSchema = z.object({
  estado: z.literal('error'),
  capacidad: z.string(),
  error: z.object({
    codigo: z.string(),
    mensaje: z.string(),
    reintentable: z.boolean(),
    duracionSegundos: z.number().nonnegative(),
  }),
});

const envelopeSchema = z.discriminatedUnion('estado', [
  completedEnvelopeSchema,
  failedEnvelopeSchema,
]);

type CompletedEnvelope = z.infer<typeof completedEnvelopeSchema>;
type FailedEnvelope = z.infer<typeof failedEnvelopeSchema>;

function toCompletedResult(envelope: CompletedEnvelope): CompletedResult {
  return {
    status: 'completed',
    capabilityId: envelope.capacidad,
    durationSeconds: envelope.duracionSegundos,
    evidence: {
      level: EVIDENCE_LEVELS[envelope.evidencia.nivel],
      summary: envelope.evidencia.resumen,
      sources: envelope.evidencia.fuentes.map((source) => ({
        id: source.id,
        kind: SOURCE_KINDS[source.tipo],
        description: source.descripcion,
        isSynthetic: source.esSintetica,
      })),
    },
    content: envelope.contenido,
    warnings: envelope.advertencias,
    nextCapabilityIds: envelope.siguientesCapacidades,
  };
}

function toFailedResult(envelope: FailedEnvelope): FailedResult {
  return {
    status: 'failed',
    capabilityId: envelope.capacidad,
    failure: {
      // An unknown code is still a failure the person can act on, so it is kept, not rejected.
      code: FAILURE_CODES[envelope.error.codigo] ?? 'unknown',
      technicalMessage: envelope.error.mensaje,
      retryable: envelope.error.reintentable,
      durationSeconds: envelope.error.duracionSegundos,
    },
  };
}

export type ParseOutcome = { ok: true; result: CapabilityResult } | { ok: false; issues: string[] };

/**
 * Validates an untrusted response (simulated or from a live model) against the
 * common envelope and against the content shape of the capability that produced it.
 */
export function parseCapabilityResult(capability: Capability, raw: unknown): ParseOutcome {
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) {
    return { ok: false, issues: formatIssues(envelope.error) };
  }

  if (envelope.data.capacidad !== capability.id) {
    return {
      ok: false,
      issues: [`capacidad: expected "${capability.id}", received "${envelope.data.capacidad}"`],
    };
  }

  if (envelope.data.estado === 'error') {
    return { ok: true, result: toFailedResult(envelope.data) };
  }

  const content = buildContentSchema(capability.output.shape).safeParse(envelope.data.contenido);
  if (!content.success) {
    return { ok: false, issues: formatIssues(content.error).map((issue) => `contenido.${issue}`) };
  }

  return { ok: true, result: toCompletedResult(envelope.data) };
}
