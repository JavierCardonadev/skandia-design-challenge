import { describe, expect, it } from 'vitest';
import { kitCatalog } from '../capabilities/kit-catalog';
import { kitResult, timeoutFailure } from '../../test/fixtures';
import {
  completedResults,
  createRun,
  getRunPhase,
  nextStepToRun,
  resumeRun,
  runReducer,
  type Run,
  type RunEvent,
} from './run';

const PLAN = ['investigacion', 'contenido', 'estrategia', 'prototipado', 'validacion'];

function play(run: Run, events: RunEvent[]): Run {
  return events.reduce(runReducer, run);
}

function statuses(run: Run): string[] {
  return run.steps.map((step) => step.status);
}

function step(run: Run, id: string) {
  const found = run.steps.find((candidate) => candidate.capabilityId === id);
  if (!found) throw new Error(`Step ${id} is not in the run`);
  return found;
}

/** Runs one step from start to an approved (or auto-accepted) result. */
function finish(id: string): RunEvent[] {
  return [
    { type: 'step-started', capabilityId: id },
    { type: 'step-completed', capabilityId: id, result: kitResult(id) },
    { type: 'step-approved', capabilityId: id },
  ];
}

describe('createRun', () => {
  it('starts every step as pending with the contract snapshot it needs', () => {
    const run = createRun(kitCatalog, PLAN);

    expect(statuses(run)).toEqual(['pending', 'pending', 'pending', 'pending', 'pending']);
    expect(step(run, 'estrategia')).toMatchObject({
      dependsOn: ['investigacion', 'contenido'],
      requiresReview: true,
      attempt: 0,
    });
    expect(getRunPhase(run)).toBe('ready');
  });

  it('refuses a plan with a capability that is not in the catalog', () => {
    expect(() => createRun(kitCatalog, ['fantasma'])).toThrow('Unknown capability "fantasma"');
  });
});

describe('run flow', () => {
  it('walks the whole plan to the end, pausing for every required review', () => {
    let run = createRun(kitCatalog, PLAN);
    const order: string[] = [];

    for (let next = nextStepToRun(run); next; next = nextStepToRun(run)) {
      order.push(next.capabilityId);
      run = play(run, finish(next.capabilityId));
    }

    expect(order).toEqual(PLAN);
    expect(getRunPhase(run)).toBe('finished');
    expect(completedResults(run).map((result) => result.capabilityId)).toEqual(PLAN);
  });

  it('holds the next step until the person approves an output that needs review', () => {
    const run = play(createRun(kitCatalog, PLAN), [
      { type: 'step-started', capabilityId: 'investigacion' },
      { type: 'step-completed', capabilityId: 'investigacion', result: kitResult('investigacion') },
    ]);

    expect(step(run, 'investigacion').status).toBe('awaiting-review');
    expect(getRunPhase(run)).toBe('awaiting-review');
    expect(nextStepToRun(run)).toBeNull();
    expect(completedResults(run)).toEqual([]);
  });

  it('accepts on its own the output of a capability that needs no review', () => {
    const run = play(createRun(kitCatalog, ['validacion']), [
      { type: 'step-started', capabilityId: 'validacion' },
      { type: 'step-completed', capabilityId: 'validacion', result: kitResult('validacion') },
    ]);

    expect(step(run, 'validacion').status).toBe('done');
    expect(getRunPhase(run)).toBe('finished');
  });

  it('does not start anything else while a step is running', () => {
    const run = play(createRun(kitCatalog, PLAN), [
      { type: 'step-started', capabilityId: 'investigacion' },
    ]);

    expect(getRunPhase(run)).toBe('running');
    expect(nextStepToRun(run)).toBeNull();
  });

  it('treats a dependency left out of the plan as already satisfied', () => {
    const run = createRun(kitCatalog, ['contenido']);

    expect(nextStepToRun(run)?.capabilityId).toBe('contenido');
  });
});

describe('adjustments', () => {
  const reviewed = play(createRun(kitCatalog, PLAN), [
    { type: 'step-started', capabilityId: 'investigacion' },
    { type: 'step-completed', capabilityId: 'investigacion', result: kitResult('investigacion') },
  ]);

  it('sends a rejected output back with the note and runs it again', () => {
    const run = runReducer(reviewed, {
      type: 'step-revision-requested',
      capabilityId: 'investigacion',
      note: 'Incluye el canal web',
    });

    expect(step(run, 'investigacion')).toMatchObject({
      status: 'pending',
      result: null,
      adjustmentNote: 'Incluye el canal web',
    });
    expect(nextStepToRun(run)?.capabilityId).toBe('investigacion');

    const restarted = runReducer(run, { type: 'step-started', capabilityId: 'investigacion' });
    expect(step(restarted, 'investigacion').attempt).toBe(2);
  });

  it('redoes a step without a note', () => {
    const run = runReducer(reviewed, {
      type: 'step-revision-requested',
      capabilityId: 'investigacion',
      note: null,
    });

    expect(step(run, 'investigacion')).toMatchObject({ status: 'pending', adjustmentNote: null });
  });
});

describe('failures and delays', () => {
  const running = play(createRun(kitCatalog, PLAN), [
    ...finish('investigacion'),
    ...finish('contenido'),
    { type: 'step-started', capabilityId: 'estrategia' },
  ]);
  const failed = runReducer(running, {
    type: 'step-failed',
    capabilityId: 'estrategia',
    failure: timeoutFailure,
  });

  it('flags a step that takes longer than expected and clears the flag when it ends', () => {
    const delayed = runReducer(running, { type: 'step-delayed', capabilityId: 'estrategia' });
    const completed = runReducer(delayed, {
      type: 'step-completed',
      capabilityId: 'estrategia',
      result: kitResult('estrategia'),
    });

    expect(step(delayed, 'estrategia').isDelayed).toBe(true);
    expect(getRunPhase(delayed)).toBe('running');
    expect(step(completed, 'estrategia').isDelayed).toBe(false);
  });

  it('stops the run and asks for attention when a step fails', () => {
    expect(step(failed, 'estrategia')).toMatchObject({ status: 'failed', failure: timeoutFailure });
    expect(getRunPhase(failed)).toBe('needs-attention');
    expect(nextStepToRun(failed)).toBeNull();
  });

  it('retries a failed step as a new attempt without the old failure', () => {
    const retried = play(failed, [
      { type: 'step-retried', capabilityId: 'estrategia' },
      { type: 'step-started', capabilityId: 'estrategia' },
    ]);

    expect(step(retried, 'estrategia')).toMatchObject({
      status: 'running',
      attempt: 2,
      failure: null,
    });
  });

  it('skips a failed step with everything that depends on it and carries on', () => {
    const skipped = runReducer(failed, { type: 'step-skipped', capabilityId: 'estrategia' });

    expect(statuses(skipped)).toEqual(['done', 'done', 'skipped', 'skipped', 'pending']);
    expect(nextStepToRun(skipped)?.capabilityId).toBe('validacion');

    const finished = play(skipped, finish('validacion'));
    expect(getRunPhase(finished)).toBe('finished');
    expect(completedResults(finished).map((result) => result.capabilityId)).toEqual([
      'investigacion',
      'contenido',
      'validacion',
    ]);
  });
});

describe('events that do not apply', () => {
  const run = createRun(kitCatalog, PLAN);

  it.each<RunEvent>([
    { type: 'step-started', capabilityId: 'fantasma' },
    { type: 'step-delayed', capabilityId: 'investigacion' },
    { type: 'step-completed', capabilityId: 'investigacion', result: kitResult('investigacion') },
    { type: 'step-failed', capabilityId: 'investigacion', failure: timeoutFailure },
    { type: 'step-approved', capabilityId: 'investigacion' },
    { type: 'step-revision-requested', capabilityId: 'investigacion', note: null },
    { type: 'step-retried', capabilityId: 'investigacion' },
    { type: 'step-skipped', capabilityId: 'investigacion' },
  ])('ignores $type on a step that is not in the expected status', (event) => {
    expect(runReducer(run, event)).toBe(run);
  });
});

describe('resumeRun', () => {
  it('sends a step that was running back to wait, and keeps every decision made', () => {
    const interrupted = play(createRun(kitCatalog, PLAN), [
      ...finish('investigacion'),
      { type: 'step-started', capabilityId: 'contenido' },
      { type: 'step-delayed', capabilityId: 'contenido' },
    ]);

    const resumed = resumeRun(interrupted);

    expect(statuses(resumed)).toEqual(['done', 'pending', 'pending', 'pending', 'pending']);
    expect(step(resumed, 'contenido')).toMatchObject({ isDelayed: false, attempt: 1 });
    expect(step(resumed, 'investigacion').result).not.toBeNull();
    expect(nextStepToRun(resumed)?.capabilityId).toBe('contenido');
  });

  it('leaves a run waiting for a review exactly as it was', () => {
    const waiting = play(createRun(kitCatalog, PLAN), [
      { type: 'step-started', capabilityId: 'investigacion' },
      { type: 'step-completed', capabilityId: 'investigacion', result: kitResult('investigacion') },
    ]);

    expect(resumeRun(waiting)).toEqual(waiting);
  });
});
