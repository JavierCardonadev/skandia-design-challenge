import { describe, expect, it, vi } from 'vitest';
import { kitCatalog } from '../domain/capabilities/kit-catalog';
import {
  frameNeed,
  type BriefGenerator,
  type FramingErrorCode,
  type GenerationRequest,
} from './frame-need';
import { buildModelBriefSchema, buildSystemPrompt, buildUserMessage } from './framing-prompt';

const brief = { summary: 'Quieres un simulador.', facts: [], questions: [], steps: [] };

function generatorAnswering(output: unknown = brief) {
  return vi.fn<BriefGenerator>(() => Promise.resolve({ ok: true, output }));
}

function sentTo(generate: ReturnType<typeof generatorAnswering>): GenerationRequest {
  const request = generate.mock.calls[0]?.[0];
  if (!request) throw new Error('The generator was not called');
  return request;
}

describe('frameNeed', () => {
  it('asks the model with the catalog as context and returns its brief', async () => {
    const generate = generatorAnswering();

    const response = await frameNeed(
      { text: 'Quiero un simulador', answers: { product: 'Fondo Voluntario' } },
      generate,
      kitCatalog,
    );

    expect(response).toEqual({ status: 200, body: { brief } });
    expect(sentTo(generate).system).toContain('"id": "investigacion"');
    expect(sentTo(generate).user).toBe(
      '<need>\nQuiero un simulador\n</need>\n\n<previous_answers>\nproduct: Fondo Voluntario\n</previous_answers>',
    );
  });

  it('redacts client data again, in the need and in the answers, before the model sees it', async () => {
    const generate = generatorAnswering();

    await frameNeed(
      {
        text: 'Mariana Ejemplo, cédula 1.234.567.890, tiene un saldo de $48.500.000.',
        answers: { product: 'Escríbele a ana@ejemplo.com' },
      },
      generate,
      kitCatalog,
    );

    const { user } = sentTo(generate);
    expect(user).not.toMatch(/Mariana|1\.234\.567\.890|48\.500\.000|ana@ejemplo\.com/);
    expect(user).toContain('[nombre oculto], cédula [cédula oculta]');
    expect(user).toContain('product: Escríbele a [correo oculto]');
  });

  it.each([
    ['a body that is not an object', 'nope'],
    ['an empty need', { text: '   ', answers: {} }],
    ['a need that is too long', { text: 'a'.repeat(4001), answers: {} }],
    ['missing answers', { text: 'Quiero un simulador' }],
    ['an answer that is too long', { text: 'Simulador', answers: { product: 'a'.repeat(501) } }],
    [
      'too many answers',
      {
        text: 'Simulador',
        answers: Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`q${index}`, 'x'])),
      },
    ],
  ])('rejects %s without calling the model', async (_case, body) => {
    const generate = generatorAnswering();

    expect(await frameNeed(body, generate, kitCatalog)).toEqual({
      status: 400,
      body: { error: 'invalid-request' },
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('answers "not configured" when the server has no model to call', async () => {
    expect(await frameNeed({ text: 'Simulador', answers: {} }, null, kitCatalog)).toEqual({
      status: 503,
      body: { error: 'not-configured' },
    });
  });

  it.each<[FramingErrorCode, number]>([
    ['rate-limited', 429],
    ['refused', 502],
    ['truncated', 502],
    ['unparseable', 502],
    ['unreachable', 502],
    ['provider-error', 502],
  ])('maps a %s failure of the model to HTTP %i', async (code, status) => {
    const generate: BriefGenerator = () => Promise.resolve({ ok: false, code });

    expect(await frameNeed({ text: 'Simulador', answers: {} }, generate, kitCatalog)).toEqual({
      status,
      body: { error: code },
    });
  });
});

describe('framing prompt', () => {
  it('describes every capability by what it does and needs, without internal names', () => {
    const prompt = buildSystemPrompt(kitCatalog);

    for (const capability of kitCatalog.capabilities) {
      expect(prompt).toContain(`"id": "${capability.id}"`);
      expect(prompt).toContain(capability.plainDescription);
    }
    expect(prompt).toContain('personas cerca de pensionarse');
    expect(prompt).not.toMatch(/Mike|Kiki|Harvey|Rachel/);
  });

  it('sends only the need when there are no earlier answers', () => {
    expect(buildUserMessage('Quiero un simulador', {})).toBe(
      '<need>\nQuiero un simulador\n</need>',
    );
  });

  it('only lets the model pick capabilities that exist', () => {
    const schema = buildModelBriefSchema(kitCatalog);
    const withStep = (capabilityId: string) => ({
      ...brief,
      steps: [{ capabilityId, reason: 'Porque sí.' }],
    });

    expect(schema.safeParse(withStep('contenido')).success).toBe(true);
    expect(schema.safeParse(withStep('traduccion')).success).toBe(false);
  });
});
