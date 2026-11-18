import { z } from 'zod';
import type { CapabilityCatalog } from '../domain/capabilities/types';
import { scanSensitiveData } from '../domain/sensitive-data/sensitive-data';
import {
  buildModelBriefSchema,
  buildSystemPrompt,
  buildUserMessage,
  type ModelBriefSchema,
} from './framing-prompt';

export type FramingErrorCode =
  | 'invalid-request'
  /** No API key on the server: the deployment runs in simulated mode. */
  | 'not-configured'
  | 'refused'
  /** The answer was cut off before the brief was complete. */
  | 'truncated'
  | 'unparseable'
  | 'rate-limited'
  | 'unreachable'
  | 'provider-error';

export type GenerationResult =
  { ok: true; output: unknown } | { ok: false; code: FramingErrorCode };

export interface GenerationRequest {
  system: string;
  user: string;
  schema: ModelBriefSchema;
}

/** Asks a model for a brief. Implemented by the Anthropic adapter; faked in tests. */
export type BriefGenerator = (request: GenerationRequest) => Promise<GenerationResult>;

export interface FramingResponse {
  status: number;
  body: { brief: unknown } | { error: FramingErrorCode };
}

const MAX_NEED_LENGTH = 4000;
const MAX_ANSWER_LENGTH = 500;
const MAX_ANSWERS = 5;

const requestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_NEED_LENGTH),
  answers: z
    .record(z.string().max(64), z.string().max(MAX_ANSWER_LENGTH))
    .refine((answers) => Object.keys(answers).length <= MAX_ANSWERS),
});

const STATUS_BY_ERROR: Record<FramingErrorCode, number> = {
  'invalid-request': 400,
  'not-configured': 503,
  'rate-limited': 429,
  refused: 502,
  truncated: 502,
  unparseable: 502,
  unreachable: 502,
  'provider-error': 502,
};

function failure(code: FramingErrorCode): FramingResponse {
  return { status: STATUS_BY_ERROR[code], body: { error: code } };
}

const redact = (text: string) => scanSensitiveData(text).redactedText;

/**
 * Server side of the framing capability. The browser already redacts client data;
 * it is redacted again here so nothing sensitive reaches the model even if a caller
 * skips the interface. The model's answer goes back untrusted: the client validates it.
 */
export async function frameNeed(
  rawBody: unknown,
  generate: BriefGenerator | null,
  catalog: CapabilityCatalog,
): Promise<FramingResponse> {
  const request = requestSchema.safeParse(rawBody);
  if (!request.success) return failure('invalid-request');
  if (!generate) return failure('not-configured');

  const answers = Object.fromEntries(
    Object.entries(request.data.answers).map(([id, answer]) => [id, redact(answer)]),
  );
  const result = await generate({
    system: buildSystemPrompt(catalog),
    user: buildUserMessage(redact(request.data.text), answers),
    schema: buildModelBriefSchema(catalog),
  });

  return result.ok ? { status: 200, body: { brief: result.output } } : failure(result.code);
}
