import { describe, expect, it } from 'vitest';
import { finishedRun, FULL_PLAN } from '../../test/fixtures';
import { buildDeliverable, type Deliverable } from './deliverable';
import {
  parseModelVerdict,
  requestVerdict,
  toVerdictInput,
  type VerdictInput,
  type VerdictWriter,
} from './verdict';

function deliverableOf(...args: Parameters<typeof finishedRun>): Deliverable {
  const deliverable = buildDeliverable(finishedRun(...args));
  if (!deliverable) throw new Error('Expected a deliverable');
  return deliverable;
}

const grounded = deliverableOf(FULL_PLAN);
const weak = deliverableOf(FULL_PLAN, 'weakEvidence');

function verdict(overrides: Record<string, unknown> = {}) {
  return {
    decision: 'go',
    headline: 'Hay respaldo para construir el simulador de aportes.',
    reasons: [
      {
        text: 'La mayoría no sabe cuánto aportar para llegar a una meta.',
        sourceIds: ['F1', 'F2'],
      },
      { text: 'Un cliente simulado leyó el rango como promesa: es una señal.', sourceIds: ['F5'] },
    ],
    nextStep: 'Puedes llevar este resultado a tu equipo de desarrollo.',
    ...overrides,
  };
}

function issuesOf(deliverable: Deliverable, raw: unknown): string[] {
  const outcome = parseModelVerdict(deliverable, raw);
  if (outcome.ok) throw new Error('Expected the verdict to be rejected');
  return outcome.issues;
}

describe('parseModelVerdict', () => {
  it('accepts a verdict that fits the evidence and cites sources of the result', () => {
    expect(parseModelVerdict(grounded, verdict())).toEqual({ ok: true, verdict: verdict() });
  });

  it('lets the model be more cautious than the evidence', () => {
    expect(parseModelVerdict(grounded, verdict({ decision: 'validate-first' })).ok).toBe(true);
    expect(parseModelVerdict(weak, verdict({ decision: 'no-go' })).ok).toBe(false);
    expect(
      parseModelVerdict(
        weak,
        verdict({ decision: 'validate-first', reasons: [{ text: 'Señal.', sourceIds: ['F5'] }] }),
      ).ok,
    ).toBe(true);
  });

  it('rejects a verdict that claims more than the evidence supports', () => {
    const issues = issuesOf(
      weak,
      verdict({ reasons: [{ text: 'Los clientes lo usarían.', sourceIds: ['F3'] }] }),
    );

    expect(issues).toEqual([
      'decision: "go" claims more than the evidence supports (validate-first)',
    ]);
  });

  it('rejects reasons that cite sources the result does not have, or none at all', () => {
    const issues = issuesOf(
      grounded,
      verdict({
        reasons: [
          { text: 'Lo dice un estudio.', sourceIds: ['F1', 'F99'] },
          { text: 'Es evidente.', sourceIds: [] },
        ],
      }),
    );

    expect(issues).toEqual(['reasons.0: cites unknown sources F99', 'reasons.1: cites no source']);
  });

  it('rejects going ahead on simulated or AI-made sources alone', () => {
    const issues = issuesOf(
      grounded,
      verdict({ reasons: [{ text: 'Los clientes simulados lo aprueban.', sourceIds: ['F5'] }] }),
    );

    expect(issues).toEqual(['decision: "go" is not backed by any real source']);
  });

  it('rejects a headline that stopped being a headline', () => {
    const headline = Array.from({ length: 19 }, () => 'palabra').join(' ');

    expect(issuesOf(grounded, verdict({ headline }))).toEqual(['headline: longer than 18 words']);
  });

  it('rejects an answer that does not follow the schema', () => {
    expect(issuesOf(grounded, 'Yo lo haría.')).toHaveLength(1);
    expect(issuesOf(grounded, verdict({ reasons: [] }))[0]).toMatch(/^reasons: /);
    expect(issuesOf(grounded, verdict({ decision: 'maybe' }))[0]).toMatch(/^decision: /);
  });
});

describe('toVerdictInput', () => {
  const nameOf = (id: string) => id.toUpperCase();

  it('describes the result to the writer: evidence, steps and labelled sources', () => {
    const input = toVerdictInput(grounded, 'Quiero un simulador', nameOf);

    expect(input).toMatchObject({
      need: 'Quiero un simulador',
      ruleVerdict: 'ready-to-share',
      evidence: { level: 'medium', realSourceCount: 5, syntheticSourceCount: 1 },
      skippedSteps: [],
    });
    expect(input.sections.map((section) => section.step)).toEqual(FULL_PLAN.map(nameOf));
    expect(input.sources.map((source) => `${source.id}:${source.origin}`)).toEqual([
      'F1:real',
      'F2:real',
      'F3:real',
      'F4:real',
      'H1-H4:ai-made',
      'GV:real',
      'C1:ai-made',
      'PRD:ai-made',
      'F5:simulated',
    ]);
  });
});

describe('requestVerdict', () => {
  const input: VerdictInput = toVerdictInput(grounded, 'Quiero un simulador', (id) => id);

  it('returns the checked verdict of a writer that answers well', async () => {
    const writer: VerdictWriter = { write: () => Promise.resolve(verdict()) };

    expect(await requestVerdict(writer, grounded, input)).toEqual({ ok: true, verdict: verdict() });
  });

  it('turns a writer that throws into a failed outcome', async () => {
    const failing: VerdictWriter = { write: () => Promise.reject(new Error('quota exceeded')) };
    const odd: VerdictWriter = {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- third-party code can reject with anything
      write: () => Promise.reject('boom'),
    };

    expect(await requestVerdict(failing, grounded, input)).toEqual({
      ok: false,
      issues: ['quota exceeded'],
    });
    expect(await requestVerdict(odd, grounded, input)).toEqual({
      ok: false,
      issues: ['Unknown error'],
    });
  });
});
