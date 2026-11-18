import { describe, expect, it } from 'vitest';
import { buildContentSchema, parseContentShape } from './content-shape';

describe('parseContentShape', () => {
  it('reads text, number and closed choices from string descriptors', () => {
    expect(parseContentShape('texto')).toEqual({ kind: 'text' });
    expect(parseContentShape('texto en orden de lectura')).toEqual({ kind: 'text' });
    expect(parseContentShape('número')).toEqual({ kind: 'number' });
    expect(parseContentShape('alta | media | baja')).toEqual({
      kind: 'choice',
      options: ['alta', 'media', 'baja'],
    });
  });

  it('reads lists and nested groups', () => {
    const shape = parseContentShape({
      hallazgos: [{ id: 'H1', confianza: 'alta | baja' }],
      preguntas: ['texto'],
    });

    expect(shape).toEqual({
      kind: 'group',
      fields: {
        hallazgos: {
          kind: 'list',
          item: {
            kind: 'group',
            fields: {
              id: { kind: 'text' },
              confianza: { kind: 'choice', options: ['alta', 'baja'] },
            },
          },
        },
        preguntas: { kind: 'list', item: { kind: 'text' } },
      },
    });
  });

  it('treats an empty list descriptor as a list of text', () => {
    expect(parseContentShape([])).toEqual({ kind: 'list', item: { kind: 'text' } });
  });

  it('rejects descriptors it cannot interpret', () => {
    expect(() => parseContentShape(42)).toThrow('Unsupported content descriptor of type "number"');
    expect(() => parseContentShape(null)).toThrow('Unsupported content descriptor');
  });
});

describe('buildContentSchema', () => {
  const schema = buildContentSchema(
    parseContentShape({
      titulo: 'texto',
      duracion: 'número',
      nivel: 'alta | baja',
      pasos: [{ nombre: 'texto' }],
    }),
  );

  it('accepts content that follows the shape', () => {
    const content = { titulo: 'Plan', duracion: 3, nivel: 'alta', pasos: [{ nombre: 'Uno' }] };

    expect(schema.safeParse(content).success).toBe(true);
  });

  it.each([
    ['a missing field', { titulo: 'Plan', duracion: 3, nivel: 'alta' }],
    ['a value outside the choice', { titulo: 'Plan', duracion: 3, nivel: 'media', pasos: [] }],
    ['a wrong primitive', { titulo: 'Plan', duracion: 'tres', nivel: 'alta', pasos: [] }],
    ['a malformed list item', { titulo: 'Plan', duracion: 3, nivel: 'alta', pasos: ['Uno'] }],
  ])('rejects %s', (_case, content) => {
    expect(schema.safeParse(content).success).toBe(false);
  });
});
