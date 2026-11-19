import { describe, expect, it, vi } from 'vitest';
import { kitCatalog } from '../domain/capabilities/kit-catalog';
import { parseCapabilityResult } from '../domain/capabilities/result';
import { kitCapability, kitResult } from '../test/fixtures';
import type { GenerationRequest, StructuredGenerator } from './generation';
import { runCapability } from './run-capability';

const content = kitCapability('contenido');
const contentOutput = kitResult('contenido').content;

function generatorAnswering(output: unknown) {
  return vi.fn<StructuredGenerator>(() => Promise.resolve({ ok: true, output }));
}

function upstream(capabilityId: string, level: 'high' | 'medium' | 'low', isGrounded = true) {
  return { capabilityId, level, isGrounded, content: kitResult(capabilityId).content };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    capabilityId: 'contenido',
    need: 'Quiero un simulador de aportes',
    upstream: [upstream('investigacion', 'high')],
    adjustmentNote: null,
    ...overrides,
  };
}

function sent(generate: ReturnType<typeof generatorAnswering>): GenerationRequest {
  const request = generate.mock.calls[0]?.[0];
  if (!request) throw new Error('The generator was not called');
  return request;
}

function envelopeOf(response: Awaited<ReturnType<typeof runCapability>>) {
  expect(response.status).toBe(200);
  return response.body.result as Record<string, unknown>;
}

describe('runCapability', () => {
  it('answers with the common envelope, valid against the capability contract', async () => {
    const generate = generatorAnswering({ contenido: contentOutput, advertencias: [] });

    const envelope = envelopeOf(await runCapability(body(), generate, kitCatalog));

    expect(parseCapabilityResult(content, envelope)).toMatchObject({
      ok: true,
      result: { status: 'completed', capabilityId: 'contenido', content: contentOutput },
    });
    expect(envelope.duracionSegundos).toEqual(expect.any(Number));
  });

  it('decides the evidence itself: at most medium, with the approved steps as its only sources', async () => {
    const generate = generatorAnswering({ contenido: contentOutput, advertencias: [] });

    const envelope = envelopeOf(await runCapability(body(), generate, kitCatalog));

    expect(envelope.evidencia).toEqual({
      nivel: 'media',
      resumen:
        'Lo elaboró un modelo de IA a partir de los pasos que aprobaste. No tiene fuentes propias.',
      fuentes: [
        {
          id: 'investigacion',
          tipo: 'generada',
          descripcion: 'Resultado aprobado del paso Investigación',
          esSintetica: false,
        },
      ],
    });
  });

  it('inherits weak evidence and flags sources that rest on nothing real', async () => {
    const generate = generatorAnswering({ contenido: contentOutput, advertencias: [] });

    const envelope = envelopeOf(
      await runCapability(
        body({ upstream: [upstream('investigacion', 'low', false)] }),
        generate,
        kitCatalog,
      ),
    );

    expect(envelope.evidencia).toMatchObject({ nivel: 'baja', fuentes: [{ esSintetica: true }] });
  });

  it('reports low evidence when there is nothing to build on', async () => {
    const generate = generatorAnswering({ contenido: contentOutput, advertencias: [] });

    const envelope = envelopeOf(await runCapability(body({ upstream: [] }), generate, kitCatalog));

    expect(envelope.evidencia).toMatchObject({
      nivel: 'baja',
      resumen: 'Lo elaboró un modelo de IA sin pasos anteriores en los que apoyarse.',
      fuentes: [],
    });
  });

  it('marks whatever plays the part of clients as simulated, whatever it builds on', async () => {
    const generate = generatorAnswering({
      contenido: kitResult('validacion').content,
      advertencias: [],
    });

    const envelope = envelopeOf(
      await runCapability(body({ capabilityId: 'validacion' }), generate, kitCatalog),
    );

    expect(envelope.evidencia).toMatchObject({
      nivel: 'baja',
      fuentes: [{ id: 'SIM', tipo: 'sintetica', esSintetica: true }],
    });
    expect(envelope.advertencias).toEqual([
      'Clientes simulados por IA: orientan, no reemplazan una prueba con personas reales.',
    ]);
    expect(sent(generate).system).toContain('personas cerca de pensionarse');
  });

  it("keeps the model's warnings and always adds that a model made the output", async () => {
    const generate = generatorAnswering({
      contenido: contentOutput,
      advertencias: ['Las cifras son de ejemplo.'],
    });

    const envelope = envelopeOf(await runCapability(body(), generate, kitCatalog));

    expect(envelope.advertencias).toEqual([
      'Las cifras son de ejemplo.',
      'Lo elaboró un modelo de IA: revísalo antes de usarlo fuera de aquí.',
    ]);
  });

  it('gives the model the need, the approved steps and the adjustment, all redacted', async () => {
    const generate = generatorAnswering({ contenido: contentOutput, advertencias: [] });

    await runCapability(
      body({
        need: 'Simulador para Mariana Ejemplo, cédula 1.234.567.890',
        adjustmentNote: 'Escríbele a ana@ejemplo.com',
      }),
      generate,
      kitCatalog,
    );

    const { system, user } = sent(generate);
    expect(system).toContain('Capability: Contenido.');
    expect(system).toContain('Never invent interviews');
    expect(user).toContain('<step id="investigacion">');
    expect(user).toContain('[nombre oculto], cédula [cédula oculta]');
    expect(user).toContain('<adjustment_requested>\nEscríbele a [correo oculto]');
    expect(user).not.toMatch(/Mariana|ana@ejemplo/);
  });

  it('refuses to hand the model the capability that stands for real evidence', async () => {
    const generate = generatorAnswering({});

    const response = await runCapability(
      body({ capabilityId: 'investigacion' }),
      generate,
      kitCatalog,
    );

    expect(response).toEqual({ status: 400, body: { error: 'invalid-request' } });
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown capability', body({ capabilityId: 'traduccion' })],
    ['a missing need', body({ need: ' ' })],
    ['a malformed upstream step', body({ upstream: [{ capabilityId: 'investigacion' }] })],
    ['a body that is not an object', 'nope'],
  ])('rejects %s', async (_case, raw) => {
    expect(await runCapability(raw, generatorAnswering({}), kitCatalog)).toEqual({
      status: 400,
      body: { error: 'invalid-request' },
    });
  });

  it('answers "not configured" without a model, and passes on the model\'s failures', async () => {
    const failing: StructuredGenerator = () => Promise.resolve({ ok: false, code: 'rate-limited' });

    expect(await runCapability(body(), null, kitCatalog)).toMatchObject({ status: 503 });
    expect(await runCapability(body(), failing, kitCatalog)).toEqual({
      status: 429,
      body: { error: 'rate-limited' },
    });
  });

  it('does not forward an answer without the expected parts', async () => {
    const response = await runCapability(body(), generatorAnswering({ texto: 'x' }), kitCatalog);

    expect(response).toEqual({ status: 502, body: { error: 'unparseable' } });
  });
});
