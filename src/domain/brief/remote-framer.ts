import { pickField, postJson } from '../remote/post-json';
import type { BriefFramer } from './framing';

export const FRAMING_ENDPOINT = '/api/frame';

export interface RemoteFramerOptions {
  endpoint?: string;
  fetch?: typeof fetch;
}

/**
 * Frames needs through the server function, where the model and its API key live.
 * Only the redacted need and answers are sent. Any failure is thrown and handled by
 * the caller, which validates successful answers too.
 */
export function createRemoteFramer(options: RemoteFramerOptions = {}): BriefFramer {
  const { endpoint = FRAMING_ENDPOINT, fetch } = options;

  return {
    async frame({ text, answers, signal }) {
      const body = await postJson(
        endpoint,
        { text, answers },
        { service: 'Framing service', fetch, signal },
      );
      return pickField(body, 'brief');
    },
  };
}
