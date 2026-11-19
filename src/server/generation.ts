import type { z } from 'zod';
import type { CapabilityCatalog } from '../domain/capabilities/types';
import { scanSensitiveData } from '../domain/sensitive-data/sensitive-data';

export type ServerErrorCode =
  | 'invalid-request'
  /** No API key on the server: the deployment runs in simulated mode. */
  | 'not-configured'
  | 'refused'
  /** The answer was cut off before it was complete. */
  | 'truncated'
  | 'unparseable'
  | 'rate-limited'
  | 'unreachable'
  | 'provider-error';

export type GenerationResult = { ok: true; output: unknown } | { ok: false; code: ServerErrorCode };

export interface GenerationRequest {
  system: string;
  user: string;
  /** The shape the model must fill. Enforced by the provider's structured outputs. */
  schema: z.ZodType;
}

/** Asks a model for structured output. Implemented by the Anthropic adapter; faked in tests. */
export type StructuredGenerator = (request: GenerationRequest) => Promise<GenerationResult>;

export interface TaskResponse {
  status: number;
  body: Record<string, unknown>;
}

/** One thing the server asks the model to do: frame a need, run a capability, write a verdict. */
export type ServerTask = (
  rawBody: unknown,
  generate: StructuredGenerator | null,
  catalog: CapabilityCatalog,
) => Promise<TaskResponse>;

const STATUS_BY_ERROR: Record<ServerErrorCode, number> = {
  'invalid-request': 400,
  'not-configured': 503,
  'rate-limited': 429,
  refused: 502,
  truncated: 502,
  unparseable: 502,
  unreachable: 502,
  'provider-error': 502,
};

export function failure(code: ServerErrorCode): TaskResponse {
  return { status: STATUS_BY_ERROR[code], body: { error: code } };
}

/**
 * The browser already redacts client data. Every task redacts again on the server so
 * nothing sensitive reaches the model even if a caller skips the interface.
 */
export function redact(text: string): string {
  return scanSensitiveData(text).redactedText;
}

export const MAX_NEED_LENGTH = 4000;
export const MAX_NOTE_LENGTH = 500;
