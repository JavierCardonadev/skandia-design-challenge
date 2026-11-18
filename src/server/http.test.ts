import { describe, expect, it, vi } from 'vitest';
import type { BriefGenerator } from './frame-need';
import { handleFrameRequest } from './http';

const brief = { summary: 'Quieres un simulador.', facts: [], questions: [], steps: [] };

function post(body: string): Request {
  return new Request('http://localhost/api/frame', { method: 'POST', body });
}

function generatorFactory() {
  const generate: BriefGenerator = () => Promise.resolve({ ok: true, output: brief });
  return vi.fn<(apiKey: string, model?: string) => BriefGenerator>(() => generate);
}

const validBody = JSON.stringify({ text: 'Quiero un simulador', answers: {} });

describe('handleFrameRequest', () => {
  it('frames the need with the key and model from the server environment', async () => {
    const createGenerator = generatorFactory();

    const response = await handleFrameRequest(
      post(validBody),
      { ANTHROPIC_API_KEY: ' test-key ', ANTHROPIC_MODEL: 'claude-opus-5-5' },
      createGenerator,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ brief });
    expect(createGenerator).toHaveBeenCalledExactlyOnceWith('test-key', 'claude-opus-5-5');
  });

  it('lets the generator choose its default model when none is configured', async () => {
    const createGenerator = generatorFactory();

    await handleFrameRequest(
      post(validBody),
      { ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_MODEL: '  ' },
      createGenerator,
    );

    expect(createGenerator).toHaveBeenCalledExactlyOnceWith('test-key', undefined);
  });

  it.each([{}, { ANTHROPIC_API_KEY: '' }, { ANTHROPIC_API_KEY: '   ' }])(
    'answers "not configured" without a key (%o)',
    async (env) => {
      const createGenerator = generatorFactory();

      const response = await handleFrameRequest(post(validBody), env, createGenerator);

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'not-configured' });
      expect(createGenerator).not.toHaveBeenCalled();
    },
  );

  it('rejects a body that is not JSON', async () => {
    const response = await handleFrameRequest(
      post('not json'),
      { ANTHROPIC_API_KEY: 'test-key' },
      generatorFactory(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid-request' });
  });
});
