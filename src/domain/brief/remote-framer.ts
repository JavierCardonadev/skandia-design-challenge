import type { BriefFramer } from './framing';

export const FRAMING_ENDPOINT = '/api/frame';

export interface RemoteFramerOptions {
  endpoint?: string;
  fetch?: typeof fetch;
}

function readError(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    return typeof body.error === 'string' ? body.error : 'unknown';
  }
  return 'unknown';
}

/**
 * Frames needs through the server function, where the model and its API key live.
 * Only the redacted need and answers are sent. Any failure is thrown and handled by
 * the caller, which validates successful answers too.
 */
export function createRemoteFramer(options: RemoteFramerOptions = {}): BriefFramer {
  const { endpoint = FRAMING_ENDPOINT, fetch: send = fetch } = options;

  return {
    async frame({ text, answers, signal }) {
      const response = await send(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, answers }),
        signal,
      });

      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`Framing service answered ${response.status} (${readError(body)})`);
      }
      return typeof body === 'object' && body !== null && 'brief' in body ? body.brief : null;
    },
  };
}
