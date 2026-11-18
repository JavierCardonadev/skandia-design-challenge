import { describe, expect, it, vi } from 'vitest';
import { kitCatalog } from '../capabilities/kit-catalog';
import {
  frameBrief,
  frameBriefWithFallback,
  type BriefFramer,
  type FramingRequest,
} from './framing';

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

    expect(outcome).toEqual({
      ok: true,
      brief: validAnswer({
        steps: [
          {
            capabilityId: 'investigacion',
            reason: 'Para saber qué dicen los clientes.',
            addedByPlatform: false,
          },
        ],
      }),
    });
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
      { capabilityId: 'investigacion', reason: '', addedByPlatform: true },
      { capabilityId: 'contenido', reason: 'Define los mensajes.', addedByPlatform: false },
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

    expect(await issuesFor(answer)).toEqual([
      'The brief has no pending questions and no runnable steps',
    ]);
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

describe('frameBrief with earlier answers', () => {
  const questions = [
    { id: 'product', question: '¿Sobre qué producto es?', options: [] },
    { id: 'audience', question: '¿Para qué grupo de clientes es?', options: [] },
  ];

  it('removes questions the person already answered', async () => {
    const outcome = await frameBrief(framerAnswering(validAnswer({ questions })), kitCatalog, {
      text: 'Quiero un simulador',
      answers: { product: 'Fondo Voluntario' },
    });

    expect(outcome.ok && outcome.brief.questions.map((question) => question.id)).toEqual([
      'audience',
    ]);
  });

  it('rejects a brief that only repeats answered questions and proposes nothing', async () => {
    const outcome = await frameBrief(
      framerAnswering(validAnswer({ questions: questions.slice(0, 1), steps: [] })),
      kitCatalog,
      { text: 'Quiero un simulador', answers: { product: 'Fondo Voluntario' } },
    );

    expect(outcome.ok).toBe(false);
  });
});

describe('frameBriefWithFallback', () => {
  const working = framerAnswering(validAnswer());
  const broken: BriefFramer = { frame: () => Promise.reject(new Error('quota exceeded')) };

  it('uses the primary framer when it answers well', async () => {
    const attempt = await frameBriefWithFallback(
      { primary: working, fallback: broken },
      kitCatalog,
      request,
    );

    expect(attempt).toMatchObject({
      outcome: { ok: true },
      usedFallback: false,
      primaryIssues: [],
    });
  });

  it('falls back when the primary throws, keeping the reason', async () => {
    const attempt = await frameBriefWithFallback(
      { primary: broken, fallback: working },
      kitCatalog,
      request,
    );

    expect(attempt).toMatchObject({
      outcome: { ok: true },
      usedFallback: true,
      primaryIssues: ['quota exceeded'],
    });
  });

  it('falls back when the primary answers out of contract', async () => {
    const attempt = await frameBriefWithFallback(
      { primary: framerAnswering({ summary: '' }), fallback: working },
      kitCatalog,
      request,
    );

    expect(attempt.usedFallback).toBe(true);
    expect(attempt.outcome.ok).toBe(true);
    expect(attempt.primaryIssues.length).toBeGreaterThan(0);
  });

  it('reports the failure when there is no fallback or it fails too', async () => {
    const alone = await frameBriefWithFallback({ primary: broken }, kitCatalog, request);
    const both = await frameBriefWithFallback(
      { primary: broken, fallback: broken },
      kitCatalog,
      request,
    );

    expect(alone).toMatchObject({ outcome: { ok: false }, usedFallback: false });
    expect(both).toMatchObject({ outcome: { ok: false }, usedFallback: true });
  });

  it('does not fall back for a request that was cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const fallback = { frame: vi.fn(() => Promise.resolve(validAnswer())) };

    const attempt = await frameBriefWithFallback({ primary: broken, fallback }, kitCatalog, {
      ...request,
      signal: controller.signal,
    });

    expect(attempt.usedFallback).toBe(false);
    expect(fallback.frame).not.toHaveBeenCalled();
  });
});
