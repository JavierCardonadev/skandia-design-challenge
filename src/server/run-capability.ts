import { z } from 'zod';
import { findCapability } from '../domain/capabilities/catalog';
import { buildContentSchema } from '../domain/capabilities/content-shape';
import { canRunOnModel, simulatesClients } from '../domain/capabilities/generative';
import type { Capability, EvidenceLevel } from '../domain/capabilities/types';
import { failure, MAX_NEED_LENGTH, MAX_NOTE_LENGTH, redact, type ServerTask } from './generation';
import { VOICE_RULES } from './voice-rules';

const MAX_UPSTREAM = 8;

const requestSchema = z.object({
  capabilityId: z.string().min(1),
  need: z.string().trim().min(1).max(MAX_NEED_LENGTH),
  upstream: z
    .array(
      z.object({
        capabilityId: z.string().min(1),
        level: z.enum(['high', 'medium', 'low']),
        /** Whether that output rests on at least one real source. */
        isGrounded: z.boolean(),
        content: z.record(z.string(), z.unknown()),
      }),
    )
    .max(MAX_UPSTREAM),
  adjustmentNote: z.string().max(MAX_NOTE_LENGTH).nullable(),
});

type CapabilityRunRequest = z.infer<typeof requestSchema>;

const WIRE_LEVELS: Record<EvidenceLevel, 'alta' | 'media' | 'baja'> = {
  high: 'alta',
  medium: 'media',
  low: 'baja',
};
const LEVELS_FROM_WEAKEST: readonly EvidenceLevel[] = ['low', 'medium', 'high'];

function buildSystemPrompt(capability: Capability): string {
  const inputs = capability.inputs
    .map((input) => `- ${input.description}${input.required ? '' : ' (optional)'}`)
    .join('\n');
  const clientGroups =
    capability.availableSegments.length > 0
      ? `\nYou simulate clients. Pick the group that best fits the need from this list and no other: ${capability.availableSegments.join('; ')}. Every reaction and quote is invented by you: write them as plausible, varied and useful for finding problems, never as proof.`
      : '';

  return `You run one capability of Skandia's internal UX platform, for people who do not work in UX.

Capability: ${capability.name}. ${capability.summary}
In plain words: ${capability.plainDescription}
It works from:
${inputs}
${clientGroups}
You receive the person's need and the outputs of earlier steps that the person already approved. Build on them: do not contradict them and do not redo their work.

Fill the "contenido" object exactly as the schema defines it. Its field names are fixed; write the values.

What you must not do: you have no access to research, client data, usage data or other companies' products. Never invent interviews, surveys, numbers of participants, percentages, dates or sources, and never present something as measured or observed. When a point would need real evidence, phrase it as something still to check. Amounts shown as examples must be clearly examples.

Use "advertencias" for what the person has to know before relying on this output: an input that was thin, a decision you made for them, something that needs checking with real people. Leave it empty when there is nothing of that kind. At most three, one sentence each. They are shown in an interface, not in a conversation: do not write in the first person and do not ask the reader anything.

If an adjustment is requested, the person rejected your previous output: apply what they ask and keep the rest consistent with it.

${VOICE_RULES}`;
}

function buildUserMessage(
  request: CapabilityRunRequest,
  need: string,
  note: string | null,
): string {
  const upstream = request.upstream.map(
    (step) => `<step id="${step.capabilityId}">\n${JSON.stringify(step.content)}\n</step>`,
  );

  return [
    `<need>\n${need}\n</need>`,
    upstream.length > 0 ? `<approved_steps>\n${upstream.join('\n')}\n</approved_steps>` : null,
    note ? `<adjustment_requested>\n${note}\n</adjustment_requested>` : null,
  ]
    .filter((part) => part !== null)
    .join('\n\n');
}

/**
 * The evidence of a model-made output is decided here, never by the model: it cannot
 * grade itself. It is at most "media", it inherits the weakest approved step it builds
 * on, and what plays the part of clients is always "baja" and marked as simulated.
 */
function buildEvidence(
  capability: Capability,
  request: CapabilityRunRequest,
  nameOf: (capabilityId: string) => string,
) {
  if (simulatesClients(capability)) {
    return {
      nivel: WIRE_LEVELS.low,
      resumen:
        'Son reacciones de clientes simulados por IA. Ayudan a detectar problemas, pero no confirman nada.',
      fuentes: [
        {
          id: 'SIM',
          tipo: 'sintetica',
          descripcion: 'Clientes simulados por un modelo de IA en este paso',
          esSintetica: true,
        },
      ],
    };
  }

  const inherited = LEVELS_FROM_WEAKEST.find((level) =>
    request.upstream.some((step) => step.level === level),
  );
  const level: EvidenceLevel = !inherited || inherited === 'low' ? 'low' : 'medium';

  return {
    nivel: WIRE_LEVELS[level],
    resumen:
      request.upstream.length > 0
        ? 'Lo elaboró un modelo de IA a partir de los pasos que aprobaste. No tiene fuentes propias.'
        : 'Lo elaboró un modelo de IA sin pasos anteriores en los que apoyarse.',
    fuentes: request.upstream.map((step) => ({
      id: step.capabilityId,
      tipo: 'generada',
      descripcion: `Resultado aprobado del paso ${nameOf(step.capabilityId)}`,
      esSintetica: !step.isGrounded,
    })),
  };
}

const MODEL_WARNING = 'Lo elaboró un modelo de IA: revísalo antes de usarlo fuera de aquí.';
const SIMULATION_WARNING =
  'Clientes simulados por IA: orientan, no reemplazan una prueba con personas reales.';

/**
 * Runs a capability with the model and answers with the catalog's common envelope, so
 * the client validates it exactly like a simulated response. Capabilities that stand
 * for real evidence are refused: a model could only make that evidence up.
 */
export const runCapability: ServerTask = async (rawBody, generate, catalog) => {
  const request = requestSchema.safeParse(rawBody);
  if (!request.success) return failure('invalid-request');

  const capability = findCapability(catalog, request.data.capabilityId);
  if (!capability || !canRunOnModel(capability)) return failure('invalid-request');
  if (!generate) return failure('not-configured');

  const startedAt = Date.now();
  const note = request.data.adjustmentNote === null ? null : redact(request.data.adjustmentNote);
  const result = await generate({
    system: buildSystemPrompt(capability),
    user: buildUserMessage(request.data, redact(request.data.need), note),
    schema: z.object({
      contenido: buildContentSchema(capability.output.shape),
      advertencias: z.array(z.string()),
    }),
  });
  if (!result.ok) return failure(result.code);

  const output = z
    .object({ contenido: z.unknown(), advertencias: z.array(z.string()) })
    .safeParse(result.output);
  if (!output.success) return failure('unparseable');

  const fixedWarning = simulatesClients(capability) ? SIMULATION_WARNING : MODEL_WARNING;
  return {
    status: 200,
    body: {
      result: {
        estado: 'completado',
        capacidad: capability.id,
        duracionSegundos: Math.round((Date.now() - startedAt) / 1000),
        evidencia: buildEvidence(
          capability,
          request.data,
          (id) => findCapability(catalog, id)?.name ?? id,
        ),
        contenido: output.data.contenido,
        advertencias: [...new Set([...output.data.advertencias, fixedWarning])],
        siguientesCapacidades: [],
      },
    },
  };
};
