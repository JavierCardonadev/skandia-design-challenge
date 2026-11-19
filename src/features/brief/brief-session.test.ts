import { describe, expect, it } from 'vitest';
import type { FramedBrief } from '../../domain/brief/framing';
import { scanSensitiveData } from '../../domain/sensitive-data/sensitive-data';
import {
  briefSessionReducer,
  initialBriefSession,
  restoreBriefSession,
  toBriefSnapshot,
} from './brief-session';

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

describe('keeping a brief between page loads', () => {
  const sensitive = scanSensitiveData('Simulador para Mariana Ejemplo, cédula 1.234.567.890');
  const framed = briefSessionReducer(
    briefSessionReducer(initialBriefSession, {
      type: 'framing-started',
      scan: sensitive,
      answers: { product: 'Fondo' },
    }),
    { type: 'framing-succeeded', brief, usedFallback: true },
  );

  it('keeps only the redacted text, never what the person typed', () => {
    const snapshot = toBriefSnapshot(framed);

    expect(snapshot.text).toBe('Simulador para [nombre oculto], cédula [cédula oculta]');
    expect(JSON.stringify(snapshot)).not.toMatch(/Mariana|1\.234\.567\.890/);
  });

  it('restores a framed brief with its plan, answers and origin', () => {
    const restored = restoreBriefSession(toBriefSnapshot(framed));

    expect(restored).toMatchObject({
      status: 'framed',
      brief,
      stepIds: ['investigacion', 'validacion'],
      answers: { product: 'Fondo' },
      usedFallback: true,
    });
    expect(restored.scan).toEqual({ findings: [], redactedText: toBriefSnapshot(framed).text });
  });

  it('does not keep a brief that was still being read or that failed', () => {
    const reading = briefSessionReducer(framed, { type: 'framing-started', scan, answers: {} });

    expect(toBriefSnapshot(reading)).toMatchObject({ brief: null, stepIds: [] });
    expect(restoreBriefSession(toBriefSnapshot(reading))).toBe(initialBriefSession);
  });

  it('starts fresh when nothing was kept', () => {
    expect(restoreBriefSession(null)).toBe(initialBriefSession);
    expect(restoreBriefSession(undefined)).toBe(initialBriefSession);
    expect(toBriefSnapshot(initialBriefSession).text).toBe('');
  });
});
