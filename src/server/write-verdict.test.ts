import { describe, expect, it, vi } from 'vitest';
import { kitCatalog } from '../domain/capabilities/kit-catalog';
import { buildDeliverable } from '../domain/result/deliverable';
import { toVerdictInput } from '../domain/result/verdict';
import { finishedRun, FULL_PLAN } from '../test/fixtures';
import type { GenerationRequest, StructuredGenerator } from './generation';
import { writeVerdict } from './write-verdict';

function inputFor(...args: Parameters<typeof finishedRun>) {
  const deliverable = buildDeliverable(finishedRun(...args));
  if (!deliverable) throw new Error('Expected a deliverable');
  return toVerdictInput(
    deliverable,
    'Simulador para Mariana Ejemplo, cédula 1.234.567.890',
    (id) => id,
  );
}

const verdict = { decision: 'go', headline: 'Hay respaldo.', reasons: [], nextStep: 'Compártelo.' };

function generatorAnswering(output: unknown = verdict) {
  return vi.fn<StructuredGenerator>(() => Promise.resolve({ ok: true, output }));
}

function sent(generate: ReturnType<typeof generatorAnswering>): GenerationRequest {
  const request = generate.mock.calls[0]?.[0];
  if (!request) throw new Error('The generator was not called');
  return request;
}

describe('writeVerdict', () => {
  it('asks the model with the result and returns its verdict untouched', async () => {
    const generate = generatorAnswering();

    const response = await writeVerdict(inputFor(FULL_PLAN), generate, kitCatalog);

    expect(response).toEqual({ status: 200, body: { verdict } });
    const { system, user } = sent(generate);
    expect(system).toContain('you may only decide: go, validate-first, no-go.');
    expect(user).toContain('F1 [real] 12 entrevistas');
    expect(user).toContain('F5 [simulated]');
    expect(user).toContain('<step name="validacion">');
    expect(user).toContain('<evidence level="medium" real_sources="5" simulated_sources="1" />');
    expect(user).not.toMatch(/Mariana|1\.234\.567\.890/);
  });

  it('tells the model it cannot go beyond weak evidence', async () => {
    const generate = generatorAnswering();

    await writeVerdict(inputFor(FULL_PLAN, 'weakEvidence'), generate, kitCatalog);

    expect(sent(generate).system).toContain('you may only decide: validate-first, no-go.');
    expect(sent(generate).system).not.toContain('incomplete: say so');
  });

  it('tells the model when planned steps did not run', async () => {
    const generate = generatorAnswering();
    const input = {
      ...inputFor(['validacion']),
      ruleVerdict: 'incomplete',
      skippedSteps: ['Estrategia'],
    };

    await writeVerdict(input, generate, kitCatalog);

    expect(sent(generate).system).toContain('the result is incomplete: say so');
    expect(sent(generate).user).toContain('<steps_not_run>\nEstrategia\n</steps_not_run>');
  });

  it.each([
    ['a body that is not an object', 'nope'],
    ['a result without steps', { ...inputFor(FULL_PLAN), sections: [] }],
    ['an unknown rule verdict', { ...inputFor(FULL_PLAN), ruleVerdict: 'great' }],
  ])('rejects %s without calling the model', async (_case, raw) => {
    const generate = generatorAnswering();

    expect(await writeVerdict(raw, generate, kitCatalog)).toEqual({
      status: 400,
      body: { error: 'invalid-request' },
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('answers "not configured" without a model, and passes on the model\'s failures', async () => {
    const failing: StructuredGenerator = () => Promise.resolve({ ok: false, code: 'refused' });

    expect(await writeVerdict(inputFor(FULL_PLAN), null, kitCatalog)).toMatchObject({
      status: 503,
    });
    expect(await writeVerdict(inputFor(FULL_PLAN), failing, kitCatalog)).toEqual({
      status: 502,
      body: { error: 'refused' },
    });
  });
});
