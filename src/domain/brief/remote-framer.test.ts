import { describe, expect, it, vi } from 'vitest';
import { createRemoteFramer } from './remote-framer';

function fetchAnswering(response: Response) {
  return vi.fn<typeof fetch>(() => Promise.resolve(response));
}

const request = { text: 'Quiero un simulador', answers: { product: 'Fondo Voluntario' } };

describe('createRemoteFramer', () => {
  it('posts the need and the answers, and returns the brief untouched', async () => {
    const brief = { summary: 'Quieres un simulador.' };
    const send = fetchAnswering(Response.json({ brief }));
    const { signal } = new AbortController();

    const answer = await createRemoteFramer({ fetch: send }).frame({ ...request, signal });

    expect(answer).toEqual(brief);
    expect(send).toHaveBeenCalledExactlyOnceWith('/api/frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
  });

  it('uses the endpoint it is given', async () => {
    const send = fetchAnswering(Response.json({ brief: {} }));

    await createRemoteFramer({ endpoint: '/custom', fetch: send }).frame(request);

    expect(send.mock.calls[0]?.[0]).toBe('/custom');
  });

  it('throws with the status and the error code the service reports', async () => {
    const send = fetchAnswering(Response.json({ error: 'rate-limited' }, { status: 429 }));

    await expect(createRemoteFramer({ fetch: send }).frame(request)).rejects.toThrow(
      'Framing service answered 429 (rate-limited)',
    );
  });

  it.each([
    ['a body that is not JSON', new Response('<html>Bad gateway</html>', { status: 502 })],
    ['an error that is not a code', Response.json({ error: { detail: 1 } }, { status: 502 })],
    ['a body without an error', Response.json({ message: 'nope' }, { status: 502 })],
  ])('throws a generic error for %s', async (_case, response) => {
    const send = fetchAnswering(response);

    await expect(createRemoteFramer({ fetch: send }).frame(request)).rejects.toThrow(
      'Framing service answered 502 (unknown)',
    );
  });

  it('returns nothing usable when a successful answer carries no brief', async () => {
    const send = fetchAnswering(Response.json({ unexpected: true }));

    expect(await createRemoteFramer({ fetch: send }).frame(request)).toBeNull();
  });

  it('lets a network failure surface to the caller', async () => {
    const send = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(createRemoteFramer({ fetch: send }).frame(request)).rejects.toThrow(
      'Failed to fetch',
    );
  });
});
