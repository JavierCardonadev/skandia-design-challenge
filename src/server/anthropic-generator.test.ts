import { beforeEach, describe, expect, it, vi } from 'vitest';
import { kitCatalog } from '../domain/capabilities/kit-catalog';
import { createAnthropicGenerator, DEFAULT_MODEL } from './anthropic-generator';
import { buildModelBriefSchema } from './framing-prompt';

const sdk = vi.hoisted(() => {
  class APIError extends Error {}
  class RateLimitError extends APIError {}
  class AuthenticationError extends APIError {}
  class APIConnectionError extends APIError {}
  return {
    parse: vi.fn(),
    construct: vi.fn(),
    errors: { APIError, RateLimitError, AuthenticationError, APIConnectionError },
  };
});

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    static APIError = sdk.errors.APIError;
    static RateLimitError = sdk.errors.RateLimitError;
    static AuthenticationError = sdk.errors.AuthenticationError;
    static APIConnectionError = sdk.errors.APIConnectionError;
    messages = { parse: sdk.parse };

    constructor(options: unknown) {
      sdk.construct(options);
    }
  }
  return { default: Anthropic };
});

vi.mock('@anthropic-ai/sdk/helpers/zod', () => ({
  zodOutputFormat: (schema: unknown) => ({ type: 'json_schema', schema }),
}));

const schema = buildModelBriefSchema(kitCatalog);
const request = { system: 'You frame requests.', user: '<need>Simulador</need>', schema };
const brief = { summary: 'Quieres un simulador.', facts: [], questions: [], steps: [] };

beforeEach(() => {
  sdk.parse.mockReset();
  sdk.construct.mockReset();
});

describe('createAnthropicGenerator', () => {
  it('asks the model for a structured brief and returns what it parsed', async () => {
    sdk.parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: brief });

    const result = await createAnthropicGenerator('test-key')(request);

    expect(result).toEqual({ ok: true, output: brief });
    expect(sdk.construct).toHaveBeenCalledWith({
      apiKey: 'test-key',
      maxRetries: 1,
      timeout: 30_000,
    });
    expect(sdk.parse).toHaveBeenCalledExactlyOnceWith({
      model: DEFAULT_MODEL,
      max_tokens: 4000,
      system: request.system,
      messages: [{ role: 'user', content: request.user }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    });
  });

  it('uses the model it is given', async () => {
    sdk.parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: brief });

    await createAnthropicGenerator('test-key', 'claude-opus-5-5')(request);

    expect(sdk.parse.mock.calls[0]?.[0]).toMatchObject({ model: 'claude-opus-5-5' });
  });

  it.each([
    ['refusal', brief, 'refused'],
    ['max_tokens', brief, 'truncated'],
    ['end_turn', null, 'unparseable'],
  ])('reports a response that stopped with %s as a failure', async (stopReason, parsed, code) => {
    sdk.parse.mockResolvedValue({ stop_reason: stopReason, parsed_output: parsed });

    expect(await createAnthropicGenerator('test-key')(request)).toEqual({ ok: false, code });
  });

  it.each([
    [new sdk.errors.RateLimitError('429'), 'rate-limited'],
    [new sdk.errors.AuthenticationError('401'), 'not-configured'],
    [new sdk.errors.APIConnectionError('offline'), 'unreachable'],
    [new sdk.errors.APIError('500'), 'provider-error'],
  ])('turns %o into a typed failure', async (error, code) => {
    sdk.parse.mockRejectedValue(error);

    expect(await createAnthropicGenerator('test-key')(request)).toEqual({ ok: false, code });
  });

  it('does not swallow errors that are not from the API', async () => {
    sdk.parse.mockRejectedValue(new TypeError('bug'));

    await expect(createAnthropicGenerator('test-key')(request)).rejects.toThrow('bug');
  });
});
