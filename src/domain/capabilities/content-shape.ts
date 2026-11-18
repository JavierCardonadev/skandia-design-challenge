import { z } from 'zod';

/**
 * Structure of a capability's content, read from the output descriptor in the catalog.
 * The same shape validates responses and drives rendering, so a new capability is
 * described with data instead of new code.
 */
export type ContentShape =
  | { kind: 'text' }
  | { kind: 'number' }
  | { kind: 'choice'; options: string[] }
  | { kind: 'list'; item: ContentShape }
  | { kind: 'group'; fields: Record<string, ContentShape> };

const CHOICE_SEPARATOR = ' | ';
const NUMBER_DESCRIPTOR = 'número';

/**
 * Reads the catalog's descriptor notation:
 * `"texto"` is text, `"a | b"` a closed choice, `[x]` a list of x and `{...}` a group.
 */
export function parseContentShape(descriptor: unknown): ContentShape {
  if (typeof descriptor === 'string') {
    if (descriptor.includes(CHOICE_SEPARATOR)) {
      return { kind: 'choice', options: descriptor.split(CHOICE_SEPARATOR).map((o) => o.trim()) };
    }
    return descriptor === NUMBER_DESCRIPTOR ? { kind: 'number' } : { kind: 'text' };
  }

  if (Array.isArray(descriptor)) {
    const [itemDescriptor] = descriptor as unknown[];
    return { kind: 'list', item: parseContentShape(itemDescriptor ?? 'texto') };
  }

  if (typeof descriptor === 'object' && descriptor !== null) {
    const entries = Object.entries(descriptor as Record<string, unknown>);
    return {
      kind: 'group',
      fields: Object.fromEntries(entries.map(([key, value]) => [key, parseContentShape(value)])),
    };
  }

  throw new Error(`Unsupported content descriptor of type "${typeof descriptor}"`);
}

export function buildContentSchema(shape: ContentShape): z.ZodType {
  switch (shape.kind) {
    case 'text':
      return z.string();
    case 'number':
      return z.number();
    case 'choice':
      return z.enum(shape.options);
    case 'list':
      return z.array(buildContentSchema(shape.item));
    case 'group':
      return z.object(
        Object.fromEntries(
          Object.entries(shape.fields).map(([key, field]) => [key, buildContentSchema(field)]),
        ),
      );
  }
}
