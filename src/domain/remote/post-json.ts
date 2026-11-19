export interface PostOptions {
  /** Names the service in error messages, e.g. "Framing service". */
  service: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

function readError(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    return typeof body.error === 'string' ? body.error : 'unknown';
  }
  return 'unknown';
}

/**
 * Posts JSON to one of the server's model tasks and returns the parsed body.
 * Any failure is thrown; callers validate successful answers themselves.
 */
export async function postJson(
  endpoint: string,
  payload: unknown,
  options: PostOptions,
): Promise<unknown> {
  const { service, fetch: send = fetch, signal } = options;
  const response = await send(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${service} answered ${response.status} (${readError(body)})`);
  }
  return body;
}

/** Reads one field of a successful answer, or null when the answer does not carry it. */
export function pickField(body: unknown, field: string): unknown {
  if (typeof body !== 'object' || body === null || !(field in body)) return null;
  return (body as Record<string, unknown>)[field];
}
