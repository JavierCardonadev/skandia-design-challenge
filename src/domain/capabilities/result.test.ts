import { describe, expect, it } from 'vitest';
import { kitCapability, rawCapability, rawCompleted, rawFailed } from '../../test/fixtures';
import { parseCatalog } from './catalog';
import { parseCapabilityResult } from './result';

const [demo] = parseCatalog({ capacidades: [rawCapability('demo')] }).capabilities;
if (!demo) throw new Error('Fixture catalog is empty');

describe('parseCapabilityResult', () => {
  it('maps a completed kit response to the domain model', () => {
    const research = kitCapability('investigacion');

    const outcome = parseCapabilityResult(research, research.simulatedResponses.normal);

    expect(outcome).toMatchObject({
      ok: true,
      result: {
        status: 'completed',
        capabilityId: 'investigacion',
        durationSeconds: 184,
        evidence: { level: 'high' },
        warnings: [],
        nextCapabilityIds: ['contenido', 'estrategia'],
      },
    });
    expect(
      outcome.ok && outcome.result.status === 'completed' && outcome.result.evidence.sources[0],
    ).toEqual({
      id: 'F1',
      kind: 'qualitative',
      description: '12 entrevistas con personas que ahorran en el fondo voluntario (marzo de 2026)',
      isSynthetic: false,
    });
  });

  it('maps an error response and translates its code', () => {
    const outcome = parseCapabilityResult(demo, rawFailed('demo', 'FUENTE_NO_DISPONIBLE'));

    expect(outcome).toEqual({
      ok: true,
      result: {
        status: 'failed',
        capabilityId: 'demo',
        failure: {
          code: 'source-unavailable',
          technicalMessage: 'technical detail',
          retryable: true,
          durationSeconds: 3,
        },
      },
    });
  });

  it('keeps failures with a code it does not know', () => {
    const outcome = parseCapabilityResult(demo, rawFailed('demo', 'ALGO_NUEVO'));

    expect(outcome).toMatchObject({ ok: true, result: { failure: { code: 'unknown' } } });
  });

  it('rejects a response that does not follow the envelope', () => {
    const outcome = parseCapabilityResult(demo, { estado: 'completado', capacidad: 'demo' });

    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.issues.some((issue) => issue.startsWith('evidencia'))).toBe(true);
  });

  it('rejects plain text, the typical unstructured model answer', () => {
    const outcome = parseCapabilityResult(demo, 'Claro, aquí tienes el resumen…');

    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.issues[0]).toContain('(root)');
  });

  it('rejects a response that belongs to another capability', () => {
    const outcome = parseCapabilityResult(demo, rawCompleted('otra'));

    expect(outcome).toEqual({
      ok: false,
      issues: ['capacidad: expected "demo", received "otra"'],
    });
  });

  it('rejects content that breaks the capability output shape', () => {
    const outcome = parseCapabilityResult(
      demo,
      rawCompleted('demo', { contenido: { resumen: 7 } }),
    );

    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.issues[0]).toMatch(/^contenido\.resumen: /);
  });
});
