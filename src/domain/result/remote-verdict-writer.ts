import { pickField, postJson } from '../remote/post-json';
import type { VerdictWriter } from './verdict';

export const VERDICT_ENDPOINT = '/api/verdict';

export interface RemoteVerdictWriterOptions {
  endpoint?: string;
  fetch?: typeof fetch;
}

/** Asks the live model, through the server, to write the recommendation of a result. */
export function createRemoteVerdictWriter(options: RemoteVerdictWriterOptions = {}): VerdictWriter {
  const { endpoint = VERDICT_ENDPOINT, fetch } = options;

  return {
    async write(input, signal) {
      const body = await postJson(endpoint, input, { service: 'Verdict service', fetch, signal });
      return pickField(body, 'verdict');
    },
  };
}
