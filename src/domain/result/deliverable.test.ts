import { describe, expect, it } from 'vitest';
import { kitCatalog } from '../capabilities/kit-catalog';
import type { SimulatedOutcome } from '../capabilities/types';
import { createRun, runReducer, type Run, type RunEvent } from '../run/run';
import { kitResult, timeoutFailure } from '../../test/fixtures';
import { buildDeliverable } from './deliverable';

const FULL_PLAN = ['investigacion', 'contenido', 'estrategia', 'prototipado', 'validacion'];

function finish(id: string, outcome: SimulatedOutcome): RunEvent[] {
  return [
    { type: 'step-started', capabilityId: id },
    { type: 'step-completed', capabilityId: id, result: kitResult(id, outcome) },
    { type: 'step-approved', capabilityId: id },
  ];
}

function finishedRun(stepIds: string[], outcome: SimulatedOutcome = 'normal'): Run {
  return stepIds
    .flatMap((id) => finish(id, outcome))
    .reduce(runReducer, createRun(kitCatalog, stepIds));
}

function deliverableOf(run: Run) {
  const deliverable = buildDeliverable(run);
  if (!deliverable) throw new Error('Expected a deliverable');
  return deliverable;
}

describe('buildDeliverable', () => {
  it('returns null when no step was completed', () => {
    expect(buildDeliverable(createRun(kitCatalog, FULL_PLAN))).toBeNull();
  });

  it('consolidates a complete, well grounded run as ready to share', () => {
    const deliverable = deliverableOf(finishedRun(FULL_PLAN));

    expect(deliverable.verdict).toBe('ready-to-share');
    expect(deliverable.evidence).toMatchObject({ level: 'medium', realSourceCount: 5 });
    expect(deliverable.sections.map((section) => section.capabilityId)).toEqual(FULL_PLAN);
    expect(deliverable.sections.map((section) => section.wasReviewed)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(deliverable.skippedStepIds).toEqual([]);
    expect(deliverable.suggestedStepIds).toEqual([]);
  });

  it('traces every source to the steps that rely on it', () => {
    const { sources } = deliverableOf(finishedRun(FULL_PLAN));
    const usedBy = Object.fromEntries(sources.map(({ source, usedBy }) => [source.id, usedBy]));

    expect(sources.map(({ source }) => source.id)).toEqual([
      'F1',
      'F2',
      'F3',
      'F4',
      'H1-H4',
      'GV',
      'C1',
      'PRD',
      'F5',
    ]);
    expect(usedBy.F4).toEqual(['investigacion', 'estrategia']);
    expect(usedBy['H1-H4']).toEqual(['contenido', 'estrategia']);
    expect(usedBy.F5).toEqual(['validacion']);
  });

  it('gathers the warnings of every step with their origin', () => {
    const { warnings } = deliverableOf(finishedRun(FULL_PLAN));

    expect(warnings).toEqual([
      {
        capabilityId: 'estrategia',
        text: 'El Design System no tiene un campo de moneda: P1 usa un campo de texto provisional.',
      },
      {
        capabilityId: 'validacion',
        text: 'Usuarios simulados: orientan, no reemplazan una prueba con personas reales.',
      },
    ]);
  });

  it('asks to validate first when the evidence is weak, and passes on what the outputs suggest', () => {
    const deliverable = deliverableOf(finishedRun(FULL_PLAN, 'weakEvidence'));

    expect(deliverable.verdict).toBe('validate-first');
    expect(deliverable.evidence.isWeak).toBe(true);
    // Each weak output points back at itself or at research; only what is not solved is kept.
    expect(deliverable.suggestedStepIds).toEqual(['prototipado', 'validacion']);
  });

  it('suggests a step that was left out of the plan', () => {
    const deliverable = deliverableOf(finishedRun(['investigacion']));

    expect(deliverable.suggestedStepIds).toEqual(['contenido', 'estrategia']);
  });

  it('reports the result as incomplete when planned steps did not run', () => {
    const events: RunEvent[] = [
      { type: 'step-started', capabilityId: 'investigacion' },
      { type: 'step-failed', capabilityId: 'investigacion', failure: timeoutFailure },
      { type: 'step-skipped', capabilityId: 'investigacion' },
      ...finish('validacion', 'normal'),
    ];
    const deliverable = deliverableOf(events.reduce(runReducer, createRun(kitCatalog, FULL_PLAN)));

    expect(deliverable.verdict).toBe('incomplete');
    expect(deliverable.skippedStepIds).toEqual([
      'investigacion',
      'contenido',
      'estrategia',
      'prototipado',
    ]);
    expect(deliverable.sections).toHaveLength(1);
  });
});
