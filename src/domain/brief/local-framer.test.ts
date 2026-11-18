import { describe, expect, it, vi } from 'vitest';
import sampleBriefs from '../../data/kit/encargos-de-ejemplo.json';
import { kitCatalog } from '../capabilities/kit-catalog';
import { scanSensitiveData } from '../sensitive-data/sensitive-data';
import { frameBrief, type FramedBrief } from './framing';
import { createLocalFramer, LOCAL_FRAMING_DELAY_MS } from './local-framer';

const instant = () => Promise.resolve();

/** Frames a kit sample the way the app does: redacted first, validated after. */
async function frameSample(id: string, answers: Record<string, string> = {}): Promise<FramedBrief> {
  const sample = sampleBriefs.encargos.find((candidate) => candidate.id === id);
  if (!sample) throw new Error(`Sample brief ${id} is not in the kit`);

  const outcome = await frameBrief(createLocalFramer(kitCatalog, instant), kitCatalog, {
    text: scanSensitiveData(sample.texto).redactedText,
    answers,
  });
  if (!outcome.ok) throw new Error(outcome.issues.join('; '));
  return outcome.brief;
}

function stepIds(brief: FramedBrief): string[] {
  return brief.steps.map((step) => step.capabilityId);
}

describe('local framer on the kit sample briefs', () => {
  it('proposes the full plan for a clear need without asking anything (E1)', async () => {
    const brief = await frameSample('E1');

    expect(brief.questions).toEqual([]);
    expect(brief.summary).toBe(
      'Quieres saber si vale la pena un simulador de aportes. Producto: Fondo Voluntario de Pensiones.',
    );
    expect(brief.facts).toEqual([
      { label: 'Lo que tienes en mente', value: 'un simulador de aportes', isAssumption: false },
      { label: 'Producto', value: 'Fondo Voluntario de Pensiones', isAssumption: false },
      { label: 'Grupo de clientes', value: 'ahorradores digitales', isAssumption: true },
      { label: 'Canal', value: 'App', isAssumption: false },
      { label: 'Para qué', value: 'la gente sepa cuánto aportar', isAssumption: false },
    ]);
    expect(stepIds(brief)).toEqual([
      'investigacion',
      'contenido',
      'estrategia',
      'prototipado',
      'validacion',
    ]);
  });

  it('asks for precision instead of guessing when the need is vague (E2)', async () => {
    const brief = await frameSample('E2');

    expect(brief.questions.map((question) => question.id)).toEqual(['idea', 'product']);
    expect(brief.questions[0]?.options).toHaveLength(3);
    expect(brief.steps).toEqual([]);
    expect(brief.facts).toContainEqual({
      label: 'Para qué',
      value: 'la gente ahorre más',
      isAssumption: false,
    });
  });

  it('proposes a plan once the questions are answered (E2)', async () => {
    const brief = await frameSample('E2', {
      idea: 'Una herramienta nueva',
      product: 'Fondo Voluntario',
    });

    expect(brief.questions).toEqual([]);
    expect(brief.summary).toBe(
      'Quieres saber si vale la pena una herramienta nueva. Producto: Fondo Voluntario.',
    );
    expect(stepIds(brief)).toHaveLength(5);
  });

  it.each(['E3', 'E4'])('frames a redacted need without leaking placeholders (%s)', async (id) => {
    const brief = await frameSample(id);

    expect(brief.questions.map((question) => question.id)).toEqual(id === 'E3' ? ['product'] : []);
    expect(JSON.stringify(brief)).not.toContain('oculto');
  });

  it('asks the commercial executive only for the product and offers a message plan (E5)', async () => {
    const pending = await frameSample('E5');
    const framed = await frameSample('E5', { product: 'Renta Plus' });

    expect(pending.questions.map((question) => question.id)).toEqual(['product']);
    expect(pending.facts).toEqual([
      { label: 'Grupo de clientes', value: 'personas cerca de pensionarse', isAssumption: false },
    ]);
    expect(framed.summary).toBe(
      'Quieres un mensaje claro para personas cerca de pensionarse. Producto: Renta Plus.',
    );
    expect(stepIds(framed)).toEqual(['investigacion', 'contenido', 'validacion']);
  });

  it('offers the compliance analyst a plan that ends in the risk review (E6)', async () => {
    const brief = await frameSample('E6');

    expect(brief.summary).toBe(
      'Quieres revisar que se comuniquen bien los riesgos antes de salir. Producto: Flujo de retiro.',
    );
    expect(stepIds(brief)).toEqual(['investigacion', 'contenido', 'estrategia']);
  });
});

describe('local framer questions', () => {
  it('offers the segments of the catalog when it has to ask for the audience', async () => {
    const outcome = await frameBrief(createLocalFramer(kitCatalog, instant), kitCatalog, {
      text: 'Necesito explicar el fondo voluntario por correo.',
      answers: {},
    });

    expect(outcome.ok && outcome.brief.questions).toEqual([
      {
        id: 'audience',
        question: '¿Para qué grupo de clientes es?',
        options: [
          'ahorradores digitales',
          'profesionales con patrimonio en crecimiento',
          'personas cerca de pensionarse',
        ],
      },
    ]);
    // The audience is being asked, so it is not also shown as an assumption.
    expect(outcome.ok && outcome.brief.facts.some((fact) => fact.isAssumption)).toBe(false);
  });
});

describe('local framer timing', () => {
  it('waits a moment before answering and can be cancelled', async () => {
    const wait = vi.fn(instant);
    const { signal } = new AbortController();

    await createLocalFramer(kitCatalog, wait).frame({ text: 'Simulador', answers: {}, signal });

    expect(wait).toHaveBeenCalledWith(LOCAL_FRAMING_DELAY_MS, signal);
  });
});
