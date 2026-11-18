import { describe, expect, it } from 'vitest';
import { parseCatalog } from '../capabilities/catalog';
import { kitCatalog } from '../capabilities/kit-catalog';
import { rawCapability } from '../../test/fixtures';
import { dependentsOf, removeStep, resolvePlan } from './plan';

const FULL_PLAN = ['investigacion', 'contenido', 'estrategia', 'prototipado', 'validacion'];

describe('resolvePlan', () => {
  it('keeps a complete, well ordered plan as it is', () => {
    expect(resolvePlan(kitCatalog, FULL_PLAN)).toEqual({
      stepIds: FULL_PLAN,
      addedDependencyIds: [],
      unknownIds: [],
    });
  });

  it('adds missing dependencies before the step that needs them', () => {
    expect(resolvePlan(kitCatalog, ['prototipado'])).toEqual({
      stepIds: ['investigacion', 'contenido', 'estrategia', 'prototipado'],
      addedDependencyIds: ['investigacion', 'contenido', 'estrategia'],
      unknownIds: [],
    });
  });

  it('reorders steps proposed out of order and removes repetitions', () => {
    const plan = resolvePlan(kitCatalog, ['contenido', 'validacion', 'investigacion', 'contenido']);

    expect(plan.stepIds).toEqual(['investigacion', 'contenido', 'validacion']);
    expect(plan.addedDependencyIds).toEqual([]);
  });

  it('drops capabilities that do not exist and reports them', () => {
    const plan = resolvePlan(kitCatalog, ['validacion', 'traduccion', 'traduccion']);

    expect(plan).toEqual({
      stepIds: ['validacion'],
      addedDependencyIds: [],
      unknownIds: ['traduccion'],
    });
  });

  it('terminates on a catalog with circular dependencies', () => {
    const circular = parseCatalog({
      capacidades: [
        rawCapability('a', { dependeDe: ['b'] }),
        rawCapability('b', { dependeDe: ['a'] }),
      ],
    });

    expect(resolvePlan(circular, ['a']).stepIds).toEqual(['b', 'a']);
  });
});

describe('dependentsOf', () => {
  it('finds direct and transitive dependents within the plan', () => {
    expect(dependentsOf(kitCatalog, FULL_PLAN, 'contenido')).toEqual(['estrategia', 'prototipado']);
    expect(dependentsOf(kitCatalog, FULL_PLAN, 'validacion')).toEqual([]);
  });
});

describe('removeStep', () => {
  it('removes the step together with the steps that depend on it', () => {
    expect(removeStep(kitCatalog, FULL_PLAN, 'estrategia')).toEqual({
      stepIds: ['investigacion', 'contenido', 'validacion'],
      removedIds: ['estrategia', 'prototipado'],
    });
  });

  it('leaves the plan untouched when the step is not part of it', () => {
    expect(removeStep(kitCatalog, ['validacion'], 'contenido')).toEqual({
      stepIds: ['validacion'],
      removedIds: [],
    });
  });
});
