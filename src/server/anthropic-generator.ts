import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ServerErrorCode, StructuredGenerator } from './generation';

/**
 * A small, fast model is enough for these tasks, and the challenge does not grade the
 * model. Override with ANTHROPIC_MODEL to compare models without touching the code.
 */
export const DEFAULT_MODEL = 'claude-haiku-5-5';

/** Room for the model's reasoning plus the longest capability output. */
const MAX_OUTPUT_TOKENS = 8000;
const REQUEST_TIMEOUT_MS = 60_000;

function errorCode(error: unknown): ServerErrorCode | null {
  if (error instanceof Anthropic.RateLimitError) return 'rate-limited';
  if (error instanceof Anthropic.AuthenticationError) return 'not-configured';
  if (error instanceof Anthropic.APIConnectionError) return 'unreachable';
  if (error instanceof Anthropic.APIError) return 'provider-error';
  return null;
}

/** Asks Claude for structured output, so every answer follows the schema of its task. */
export function createAnthropicGenerator(
  apiKey: string,
  model = DEFAULT_MODEL,
): StructuredGenerator {
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

      // A response can be valid HTTP and still be unusable: check why it stopped first.
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
