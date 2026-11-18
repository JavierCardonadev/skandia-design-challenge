import { afterEach, describe, expect, it, vi } from 'vitest';
import { frameBriefWithFallback } from '../domain/brief/framing';
import { kitCatalog } from '../domain/capabilities/kit-catalog';
import { createFramers } from './framers';

const request = { text: 'Quiero un simulador de aportes para el fondo voluntario.', answers: {} };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createFramers', () => {
  it('frames with the local rules alone in demo mode', () => {
    const framers = createFramers(kitCatalog, false);

    expect(framers.fallback).toBeUndefined();
  });

  it('asks the server first in live mode and keeps the local rules as a safety net', async () => {
    vi.useFakeTimers();
    const send = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ error: 'not-configured' }, { status: 503 })),
    );
    vi.stubGlobal('fetch', send);

    const pending = frameBriefWithFallback(createFramers(kitCatalog, true), kitCatalog, request);
    await vi.runAllTimersAsync();
    const attempt = await pending;

    expect(send).toHaveBeenCalledTimes(1);
    expect(attempt).toMatchObject({
      outcome: { ok: true },
      usedFallback: true,
      primaryIssues: ['Framing service answered 503 (not-configured)'],
    });
  });
});
