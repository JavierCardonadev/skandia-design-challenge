import type { CapabilityCatalog } from '../capabilities/types';
import { waitFor, type Wait } from '../providers/simulated-provider';
import type { BriefFact, BriefFramer, BriefQuestion, FramedBrief } from './framing';

/*
 * Rule-based framing. It is the demo mode of the public preview and the fallback
 * when the live model fails: predictable, offline and limited to the vocabulary below.
 */

type Intent = 'evaluate-idea' | 'craft-message' | 'review-flow';
type SlotId = 'idea' | 'product' | 'audience';

type Rule<Value> = readonly [pattern: RegExp, value: Value];

const INTENTS: readonly Rule<Intent>[] = [
  [/explicar|comunicarle|mensaje/, 'craft-message'],
  [/revisar|riesgo|cumplimiento/, 'review-flow'],
];
const PRODUCTS: readonly Rule<string>[] = [
  [/fondo voluntario/, 'Fondo Voluntario de Pensiones'],
  [/flujo de retiro/, 'Flujo de retiro'],
];
const IDEAS: readonly Rule<string>[] = [[/simulador/, 'un simulador de aportes']];
const CHANNELS: readonly Rule<string>[] = [
  [/\bapp\b/, 'App'],
  [/\bweb\b/, 'Web'],
  [/correo/, 'Correo'],
  [/whatsapp/, 'WhatsApp'],
];
const AUDIENCES: readonly Rule<string>[] = [
  [/pensionarse/, 'personas cerca de pensionarse'],
  [/ahorrador/, 'ahorradores digitales'],
  [/patrimonio/, 'profesionales con patrimonio en crecimiento'],
];

const REQUIRED_SLOTS: Record<Intent, readonly SlotId[]> = {
  'evaluate-idea': ['idea', 'product'],
  'craft-message': ['product', 'audience'],
  'review-flow': ['product'],
};

const PLANS: Record<Intent, readonly string[]> = {
  'evaluate-idea': ['investigacion', 'contenido', 'estrategia', 'prototipado', 'validacion'],
  'craft-message': ['investigacion', 'contenido', 'validacion'],
  'review-flow': ['investigacion', 'contenido', 'estrategia'],
};

const GOAL_PATTERN = /(?:para que|la idea es que)\s+([^.]+)/i;

export const LOCAL_FRAMING_DELAY_MS = 900;

function withoutAccents(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function firstMatch<Value>(rules: readonly Rule<Value>[], text: string): Value | null {
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function buildQuestion(id: SlotId, segments: readonly string[]): BriefQuestion {
  switch (id) {
    case 'idea':
      return {
        id,
        question: '¿Qué tienes en mente?',
        options: ['Una herramienta nueva', 'Un mensaje o una campaña', 'Un cambio en un proceso'],
      };
    case 'product':
      return { id, question: '¿Sobre qué producto o servicio es?', options: [] };
    case 'audience':
      return { id, question: '¿Para qué grupo de clientes es?', options: [...segments] };
  }
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** A fact only exists when there is something to state. */
function toFacts(label: string, value: string | null, isAssumption = false): BriefFact[] {
  return value === null ? [] : [{ label, value, isAssumption }];
}

function summarize(intent: Intent, slots: Record<SlotId, string | null>): string {
  // Only called once every slot the intent requires is filled.
  const idea = lowerFirst(slots.idea ?? '');
  const product = slots.product ?? '';
  const audience = slots.audience ?? '';
  if (intent === 'craft-message') {
    return `Quieres un mensaje claro para ${audience}. Producto: ${product}.`;
  }
  if (intent === 'review-flow') {
    return `Quieres revisar que se comuniquen bien los riesgos antes de salir. Producto: ${product}.`;
  }
  return `Quieres saber si vale la pena ${idea}. Producto: ${product}.`;
}

function frameLocally(
  text: string,
  answers: Record<string, string>,
  segments: readonly string[],
): FramedBrief {
  const plain = withoutAccents(text);
  const intent = firstMatch(INTENTS, plain) ?? 'evaluate-idea';
  const slots: Record<SlotId, string | null> = {
    idea: answers.idea ?? firstMatch(IDEAS, plain),
    product: answers.product ?? firstMatch(PRODUCTS, plain),
    audience: answers.audience ?? firstMatch(AUDIENCES, plain),
  };
  const channel = firstMatch(CHANNELS, plain);
  const goal = GOAL_PATTERN.exec(text)?.[1]?.trim() ?? null;
  // A segment is needed to simulate clients; without one, the first is assumed and shown as such.
  const assumedAudience = slots.audience === null ? (segments[0] ?? null) : null;

  const facts = [
    ...toFacts('Lo que tienes en mente', slots.idea),
    ...toFacts('Producto', slots.product),
    ...toFacts('Grupo de clientes', slots.audience),
    ...toFacts('Grupo de clientes', assumedAudience, true),
    ...toFacts('Canal', channel),
    ...toFacts('Para qué', goal),
  ];

  const missing = REQUIRED_SLOTS[intent].filter((slot) => slots[slot] === null);
  if (missing.length > 0) {
    return {
      summary: 'Nos falta un poco de contexto para proponerte un plan.',
      // An assumption is not offered while the same thing is being asked.
      facts: facts.filter((fact) => !(fact.isAssumption && missing.includes('audience'))),
      questions: missing.map((slot) => buildQuestion(slot, segments)),
      steps: [],
    };
  }

  return {
    summary: summarize(intent, slots),
    facts,
    questions: [],
    steps: PLANS[intent].map((capabilityId) => ({ capabilityId, reason: '' })),
  };
}

/** A framer that needs no model. Its answer goes through the same validation as a live one. */
export function createLocalFramer(catalog: CapabilityCatalog, wait: Wait = waitFor): BriefFramer {
  const segments = [...new Set(catalog.capabilities.flatMap((c) => c.availableSegments))];

  return {
    async frame({ text, answers, signal }) {
      await wait(LOCAL_FRAMING_DELAY_MS, signal);
      return frameLocally(text, answers, segments);
    },
  };
}
