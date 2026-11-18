import { describe, expect, it } from 'vitest';
import { kitCatalog } from '../capabilities/kit-catalog';
import { frameBrief, type BriefFramer, type FramingRequest } from './framing';

const request: FramingRequest = { text: 'Quiero un simulador', answers: {} };

function framerAnswering(answer: unknown): BriefFramer {
  return { frame: () => Promise.resolve(answer) };
}

function validAnswer(overrides: Record<string, unknown> = {}) {
  return {
    summary: 'Quieres saber si vale la pena un simulador.',
    facts: [{ label: 'Producto', value: 'Fondo Voluntario', isAssumption: false }],
    questions: [],
    steps: [{ capabilityId: 'investigacion', reason: 'Para saber qué dicen los clientes.' }],
    ...overrides,
  };
}

async function issuesFor(answer: unknown): Promise<string[]> {
  const outcome = await frameBrief(framerAnswering(answer), kitCatalog, request);
  if (outcome.ok) throw new Error('Expected the brief to be rejected');
  return outcome.issues;
}

describe('frameBrief', () => {
  it('returns the validated brief of a well formed answer', async () => {
    const outcome = await frameBrief(framerAnswering(validAnswer()), kitCatalog, request);

    expect(outcome).toEqual({ ok: true, brief: validAnswer() });
  });

  it('drops invented capabilities and adds the dependencies the plan needs', async () => {
    const outcome = await frameBrief(
      framerAnswering(
        validAnswer({
          steps: [
            { capabilityId: 'traduccion', reason: 'No existe' },
            { capabilityId: 'contenido', reason: 'Define los mensajes.' },
          ],
        }),
      ),
      kitCatalog,
      request,
    );

    expect(outcome.ok && outcome.brief.steps).toEqual([
      { capabilityId: 'investigacion', reason: '' },
      { capabilityId: 'contenido', reason: 'Define los mensajes.' },
    ]);
  });

  it('accepts a brief that only asks questions', async () => {
    const questions = [{ id: 'product', question: '¿Sobre qué producto es?', options: [] }];

    const outcome = await frameBrief(
      framerAnswering(validAnswer({ questions, steps: [] })),
      kitCatalog,
      request,
    );

    expect(outcome.ok && outcome.brief.questions).toEqual(questions);
  });

  it('rejects an answer that does not follow the schema', async () => {
    expect(await issuesFor('Claro, este es tu plan…')).toHaveLength(1);
    expect((await issuesFor(validAnswer({ summary: '   ' })))[0]).toMatch(/^summary: /);
  });

  it('rejects a brief that asks more than three questions', async () => {
    const questions = ['a', 'b', 'c', 'd'].map((id) => ({ id, question: '¿Qué?', options: [] }));

    expect((await issuesFor(validAnswer({ questions })))[0]).toMatch(/^questions: /);
  });

  it('rejects a brief with nothing to ask and nothing to run', async () => {
    const answer = validAnswer({ steps: [{ capabilityId: 'traduccion', reason: '' }] });

    expect(await issuesFor(answer)).toEqual(['The brief has no questions and no runnable steps']);
  });

  it('turns a framer that throws into a failed outcome', async () => {
    const failing: BriefFramer = { frame: () => Promise.reject(new Error('quota exceeded')) };
    const odd: BriefFramer = {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- third-party code can reject with anything
      frame: () => Promise.reject('boom'),
    };

    expect(await frameBrief(failing, kitCatalog, request)).toEqual({
      ok: false,
      issues: ['quota exceeded'],
    });
    expect(await frameBrief(odd, kitCatalog, request)).toEqual({
      ok: false,
      issues: ['Unknown error'],
    });
  });
});
