import { describe, expect, it, vi } from 'vitest';
import { finishedRun, FULL_PLAN } from '../../test/fixtures';
import { buildDeliverable } from './deliverable';
import { createRemoteVerdictWriter } from './remote-verdict-writer';
import { toVerdictInput } from './verdict';

const deliverable = buildDeliverable(finishedRun(FULL_PLAN));
if (!deliverable) throw new Error('Expected a deliverable');
const input = toVerdictInput(deliverable, 'Quiero un simulador', (id) => id);

describe('createRemoteVerdictWriter', () => {
  it('posts the result and returns the verdict untouched', async () => {
    const verdict = { decision: 'go' };
    const send = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ verdict })));
    const { signal } = new AbortController();

    const answer = await createRemoteVerdictWriter({ fetch: send }).write(input, signal);

    expect(answer).toEqual(verdict);
    const [endpoint, init] = send.mock.calls[0] ?? [];
    expect(endpoint).toBe('/api/verdict');
    expect(init?.signal).toBe(signal);
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it('throws when the service fails', async () => {
    const send = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ error: 'not-configured' }, { status: 503 })),
    );

    await expect(
      createRemoteVerdictWriter({ endpoint: '/custom', fetch: send }).write(input),
    ).rejects.toThrow('Verdict service answered 503 (not-configured)');
  });
});
