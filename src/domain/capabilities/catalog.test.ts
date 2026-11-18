import { describe, expect, it } from 'vitest';
import { rawCapability, rawCompleted } from '../../test/fixtures';
import { CatalogError, findCapability, parseCatalog, requireCapability } from './catalog';
import { kitCatalog } from './kit-catalog';

function catalogIssues(raw: unknown): string[] {
  try {
    parseCatalog(raw);
  } catch (error) {
    if (error instanceof CatalogError) return error.issues;
    throw error;
  }
  throw new Error('Expected the catalog to be rejected');
}

describe('kit catalog', () => {
  it('loads the five capabilities with every simulated response valid', () => {
    expect(kitCatalog.capabilities.map((capability) => capability.id)).toEqual([
      'investigacion',
      'contenido',
      'estrategia',
      'prototipado',
      'validacion',
    ]);
  });

  it('maps the contract of a capability to the domain model', () => {
    const strategy = requireCapability(kitCatalog, 'estrategia');
    const validation = requireCapability(kitCatalog, 'validacion');

    expect(strategy).toMatchObject({
      name: 'Estrategia',
      agentName: 'Harvey',
      requiresHumanReview: true,
      dependsOn: ['investigacion', 'contenido'],
      typicalDuration: { minSeconds: 90, maxSeconds: 240 },
      availableSegments: [],
    });
    expect(strategy.inputs[0]).toEqual({
      field: 'hallazgos',
      type: 'salida de investigacion',
      required: true,
      description: 'Hallazgos aprobados',
    });
    expect(validation.agentName).toBeNull();
    expect(validation.availableSegments).toContain('personas cerca de pensionarse');
  });
});

describe('parseCatalog', () => {
  it('accepts a new capability described only with data', () => {
    const catalog = parseCatalog({
      capacidades: [rawCapability('base'), rawCapability('nueva', { dependeDe: ['base'] })],
    });

    expect(findCapability(catalog, 'nueva')?.dependsOn).toEqual(['base']);
  });

  it('rejects a catalog that does not follow the contract', () => {
    expect(catalogIssues({ capacidades: [] })).toHaveLength(1);
    expect(catalogIssues({ capacidades: [rawCapability('demo', { nombre: 5 })] })[0]).toContain(
      'capacidades.0.nombre',
    );
  });

  it('rejects duplicated ids and unknown dependencies', () => {
    const issues = catalogIssues({
      capacidades: [
        rawCapability('demo'),
        rawCapability('demo'),
        rawCapability('otra', { dependeDe: ['fantasma'] }),
      ],
    });

    expect(issues).toEqual([
      'Duplicated capability id "demo"',
      '"otra" depends on unknown capability "fantasma"',
    ]);
  });

  it('rejects an output descriptor it cannot interpret', () => {
    const issues = catalogIssues({
      capacidades: [rawCapability('demo', { salida: { tipo: 'x', esquema: { total: 42 } } })],
    });

    expect(issues).toEqual(['Unsupported content descriptor of type "number"']);
  });

  it('rejects a simulated response that breaks its own capability contract', () => {
    const issues = catalogIssues({
      capacidades: [
        rawCapability('demo', {
          respuestasSimuladas: {
            normal: rawCompleted('demo', { contenido: {} }),
            evidenciaDebil: rawCompleted('demo'),
            error: 'boom',
          },
        }),
      ],
    });

    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatch(/^"demo" normal response: contenido\.resumen: /);
    expect(issues[1]).toMatch(/^"demo" error response: /);
  });

  it('reports every issue in the error message', () => {
    expect(() => parseCatalog({ capacidades: [rawCapability('a'), rawCapability('a')] })).toThrow(
      'Invalid capability catalog:\n- Duplicated capability id "a"',
    );
  });
});

describe('capability lookup', () => {
  it('returns undefined or throws for an unknown id', () => {
    expect(findCapability(kitCatalog, 'fantasma')).toBeUndefined();
    expect(() => requireCapability(kitCatalog, 'fantasma')).toThrow(
      'Unknown capability "fantasma"',
    );
  });
});
