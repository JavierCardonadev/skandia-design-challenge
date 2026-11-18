import { z } from 'zod';
import { parseContentShape } from './content-shape';
import { parseCapabilityResult } from './result';
import type { Capability, CapabilityCatalog, SimulatedOutcome } from './types';
import { formatIssues } from './zod-issues';

const capabilityWireSchema = z.object({
  id: z.string().min(1),
  nombre: z.string(),
  agente: z.string().nullable(),
  queHace: z.string(),
  descripcionNoTecnica: z.string(),
  entradas: z.array(
    z.object({
      campo: z.string(),
      tipo: z.string(),
      requerido: z.boolean(),
      descripcion: z.string(),
    }),
  ),
  salida: z.object({ tipo: z.string(), esquema: z.record(z.string(), z.unknown()) }),
  duracionTipica: z.object({
    minSegundos: z.number().positive(),
    maxSegundos: z.number().positive(),
  }),
  requiereRevisionHumana: z.boolean(),
  dependeDe: z.array(z.string()),
  segmentosDisponibles: z.array(z.string()).optional(),
  respuestasSimuladas: z.object({
    normal: z.unknown(),
    evidenciaDebil: z.unknown(),
    error: z.unknown(),
  }),
});

const catalogWireSchema = z.object({ capacidades: z.array(capabilityWireSchema).min(1) });

type CapabilityWire = z.infer<typeof capabilityWireSchema>;

export class CatalogError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid capability catalog:\n- ${issues.join('\n- ')}`);
    this.name = 'CatalogError';
    this.issues = issues;
  }
}

function toCapability(wire: CapabilityWire): Capability {
  return {
    id: wire.id,
    name: wire.nombre,
    agentName: wire.agente,
    summary: wire.queHace,
    plainDescription: wire.descripcionNoTecnica,
    inputs: wire.entradas.map((input) => ({
      field: input.campo,
      type: input.tipo,
      required: input.requerido,
      description: input.descripcion,
    })),
    output: { type: wire.salida.tipo, shape: parseContentShape(wire.salida.esquema) },
    typicalDuration: {
      minSeconds: wire.duracionTipica.minSegundos,
      maxSeconds: wire.duracionTipica.maxSegundos,
    },
    requiresHumanReview: wire.requiereRevisionHumana,
    dependsOn: wire.dependeDe,
    availableSegments: wire.segmentosDisponibles ?? [],
    simulatedResponses: {
      normal: wire.respuestasSimuladas.normal,
      weakEvidence: wire.respuestasSimuladas.evidenciaDebil,
      error: wire.respuestasSimuladas.error,
    },
  };
}

function findReferenceIssues(capabilities: Capability[]): string[] {
  const ids = capabilities.map((capability) => capability.id);
  const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
  const issues = [...new Set(duplicated)].map((id) => `Duplicated capability id "${id}"`);

  for (const capability of capabilities) {
    for (const dependency of capability.dependsOn) {
      if (!ids.includes(dependency)) {
        issues.push(`"${capability.id}" depends on unknown capability "${dependency}"`);
      }
    }
  }
  return issues;
}

function findSimulatedResponseIssues(capability: Capability): string[] {
  const outcomes = Object.keys(capability.simulatedResponses) as SimulatedOutcome[];
  return outcomes.flatMap((outcome) => {
    const parsed = parseCapabilityResult(capability, capability.simulatedResponses[outcome]);
    return parsed.ok
      ? []
      : parsed.issues.map((issue) => `"${capability.id}" ${outcome} response: ${issue}`);
  });
}

/**
 * Builds the catalog from untrusted JSON and fails loudly when it is inconsistent:
 * a broken contract should stop the app at start-up, not surface mid-run.
 */
export function parseCatalog(raw: unknown): CapabilityCatalog {
  const parsed = catalogWireSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CatalogError(formatIssues(parsed.error));
  }

  let capabilities: Capability[];
  try {
    capabilities = parsed.data.capacidades.map(toCapability);
  } catch (error) {
    throw new CatalogError([error instanceof Error ? error.message : 'Unreadable output shape']);
  }

  const issues = [
    ...findReferenceIssues(capabilities),
    ...capabilities.flatMap(findSimulatedResponseIssues),
  ];
  if (issues.length > 0) {
    throw new CatalogError(issues);
  }

  return { capabilities };
}

export function findCapability(catalog: CapabilityCatalog, id: string): Capability | undefined {
  return catalog.capabilities.find((capability) => capability.id === id);
}

export function requireCapability(catalog: CapabilityCatalog, id: string): Capability {
  const capability = findCapability(catalog, id);
  if (!capability) {
    throw new Error(`Unknown capability "${id}"`);
  }
  return capability;
}
