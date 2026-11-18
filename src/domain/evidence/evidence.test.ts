import { describe, expect, it } from 'vitest';
import { kitResult } from '../../test/fixtures';
import type { EvidenceSource } from '../capabilities/types';
import { isRealSource, summarizeEvidence, weakestLevel } from './evidence';

describe('weakestLevel', () => {
  it('returns the lowest level present, or null without levels', () => {
    expect(weakestLevel(['high', 'medium', 'high'])).toBe('medium');
    expect(weakestLevel(['high', 'low', 'medium'])).toBe('low');
    expect(weakestLevel([])).toBeNull();
  });
});

describe('isRealSource', () => {
  it('counts only sources that are neither synthetic nor derived from other outputs', () => {
    const real: EvidenceSource = {
      id: 'F1',
      kind: 'qualitative',
      description: 'Entrevistas',
      isSynthetic: false,
    };

    expect(isRealSource(real)).toBe(true);
    expect(isRealSource({ ...real, kind: 'generated' })).toBe(false);
    expect(isRealSource({ ...real, kind: 'synthetic' })).toBe(false);
    expect(isRealSource({ ...real, isSynthetic: true })).toBe(false);
  });
});

describe('summarizeEvidence', () => {
  it('returns null when there are no results yet', () => {
    expect(summarizeEvidence([])).toBeNull();
  });

  it('does not let a synthetic validation lower well grounded evidence', () => {
    const results = ['investigacion', 'contenido', 'estrategia', 'prototipado', 'validacion'].map(
      (id) => kitResult(id),
    );

    expect(summarizeEvidence(results)).toEqual({
      level: 'medium',
      realSourceCount: 5,
      syntheticSourceCount: 1,
      isSyntheticOnly: false,
      isWeak: false,
    });
  });

  it('reports results that rest only on simulated users as weak and synthetic', () => {
    expect(summarizeEvidence([kitResult('validacion')])).toEqual({
      level: 'low',
      realSourceCount: 0,
      syntheticSourceCount: 1,
      isSyntheticOnly: true,
      isWeak: true,
    });
  });

  it('reports low evidence with a single real source as weak', () => {
    expect(summarizeEvidence([kitResult('investigacion', 'weakEvidence')])).toEqual({
      level: 'low',
      realSourceCount: 1,
      syntheticSourceCount: 1,
      isSyntheticOnly: false,
      isWeak: true,
    });
  });

  it('reports too few real sources as weak even when the level is not low', () => {
    const summary = summarizeEvidence([kitResult('contenido')]);

    expect(summary).toMatchObject({ level: 'medium', realSourceCount: 1, isWeak: true });
  });
});
