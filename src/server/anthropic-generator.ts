import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { BriefGenerator, FramingErrorCode } from './frame-need';

/**
 * A small, fast model is enough to frame a need, and the challenge does not grade the
 * model. Override with ANTHROPIC_MODEL to compare models without touching the code.
 */
export const DEFAULT_MODEL = 'claude-haiku-5-5';

/** Room for the model's reasoning plus a brief of a few hundred tokens. */
const MAX_OUTPUT_TOKENS = 4000;
const REQUEST_TIMEOUT_MS = 30_000;

function errorCode(error: unknown): FramingErrorCode | null {
  if (error instanceof Anthropic.RateLimitError) return 'rate-limited';
  if (error instanceof Anthropic.AuthenticationError) return 'not-configured';
  if (error instanceof Anthropic.APIConnectionError) return 'unreachable';
  if (error instanceof Anthropic.APIError) return 'provider-error';
  return null;
}

/** Frames needs with Claude, using structured outputs so the answer follows the brief schema. */
export function createAnthropicGenerator(apiKey: string, model = DEFAULT_MODEL): BriefGenerator {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: REQUEST_TIMEOUT_MS });

  return async ({ system, user, schema }) => {
    try {
      const response = await client.messages.parse({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { effort: 'low', format: zodOutputFormat(schema) },
      });

      // A response can be valid HTTP and still not be a brief: check why it stopped first.
      if (response.stop_reason === 'refusal') return { ok: false, code: 'refused' };
      if (response.stop_reason === 'max_tokens') return { ok: false, code: 'truncated' };
      if (response.parsed_output === null) return { ok: false, code: 'unparseable' };
      return { ok: true, output: response.parsed_output };
    } catch (error) {
      const code = errorCode(error);
      if (code === null) throw error;
      return { ok: false, code };
    }
  };
}
