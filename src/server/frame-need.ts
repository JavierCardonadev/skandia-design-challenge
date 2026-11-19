import { z } from 'zod';
import {
  failure,
  MAX_NEED_LENGTH,
  MAX_NOTE_LENGTH,
  redact,
  type GenerationRequest as SharedGenerationRequest,
  type ServerErrorCode,
  type StructuredGenerator,
  type TaskResponse,
} from './generation';
import { buildModelBriefSchema, buildSystemPrompt, buildUserMessage } from './framing-prompt';
import type { CapabilityCatalog } from '../domain/capabilities/types';

export type FramingErrorCode = ServerErrorCode;
export type GenerationRequest = SharedGenerationRequest;
export type BriefGenerator = StructuredGenerator;
export type FramingResponse = TaskResponse;

const MAX_ANSWERS = 5;

const requestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_NEED_LENGTH),
  answers: z
    .record(z.string().max(64), z.string().max(MAX_NOTE_LENGTH))
    .refine((answers) => Object.keys(answers).length <= MAX_ANSWERS),
});

/**
 * Server side of the framing capability. The model's answer goes back untrusted:
 * the client validates it.
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
