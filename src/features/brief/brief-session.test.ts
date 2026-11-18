import { describe, expect, it } from 'vitest';
import type { FramedBrief } from '../../domain/brief/framing';
import { scanSensitiveData } from '../../domain/sensitive-data/sensitive-data';
import { briefSessionReducer, initialBriefSession } from './brief-session';

const scan = scanSensitiveData('Quiero un simulador');
const brief: FramedBrief = {
  summary: 'Quieres un simulador.',
  facts: [],
  questions: [],
  steps: [
    { capabilityId: 'investigacion', reason: '', addedByPlatform: false },
    { capabilityId: 'validacion', reason: '', addedByPlatform: false },
  ],
};

describe('briefSessionReducer', () => {
  const framing = briefSessionReducer(initialBriefSession, {
    type: 'framing-started',
    scan,
    answers: { product: 'Fondo' },
  });
  const framed = briefSessionReducer(framing, {
    type: 'framing-succeeded',
    brief,
    usedFallback: false,
  });

  it('records what is being framed', () => {
    expect(framing).toMatchObject({ status: 'framing', scan, answers: { product: 'Fondo' } });
  });

  it('adopts the proposed plan when framing succeeds', () => {
    expect(framed).toMatchObject({
      status: 'framed',
      brief,
      stepIds: ['investigacion', 'validacion'],
    });
  });

  it('keeps the previous brief on screen while framing again or after a failure', () => {
    const again = briefSessionReducer(framed, { type: 'framing-started', scan, answers: {} });
    const failed = briefSessionReducer(again, { type: 'framing-failed' });

    expect(again.brief).toBe(brief);
    expect(failed).toMatchObject({ status: 'failed', brief });
  });

  it('replaces the plan when the person edits it', () => {
    const edited = briefSessionReducer(framed, { type: 'plan-changed', stepIds: ['validacion'] });

    expect(edited.stepIds).toEqual(['validacion']);
    expect(edited.brief).toBe(brief);
  });

  it('remembers whether the brief came from the fallback, and forgets it on the next success', () => {
    const viaFallback = briefSessionReducer(framing, {
      type: 'framing-succeeded',
      brief,
      usedFallback: true,
    });
    const viaModel = briefSessionReducer(viaFallback, {
      type: 'framing-succeeded',
      brief,
      usedFallback: false,
    });

    expect(viaFallback.usedFallback).toBe(true);
    expect(viaModel.usedFallback).toBe(false);
  });
});
