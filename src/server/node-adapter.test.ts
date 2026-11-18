import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { handleNodeFrameRequest } from './node-adapter';
import frame from './vercel-function';

function nodeRequest(method: string, body = ''): IncomingMessage {
  return Object.assign(Readable.from(body === '' ? [] : [Buffer.from(body)]), {
    method,
  }) as unknown as IncomingMessage;
}

function nodeResponse() {
  const headers: Record<string, string> = {};
  const response = {
    statusCode: 200,
    setHeader: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
    end: vi.fn<(body?: string) => void>(),
  };
  return { response, headers, asNode: response as unknown as ServerResponse };
}

const validBody = JSON.stringify({ text: 'Quiero un simulador', answers: {} });

describe('handleNodeFrameRequest', () => {
  it('answers through the framing handler, with its status, headers and body', async () => {
    const { response, headers, asNode } = nodeResponse();

    await handleNodeFrameRequest(nodeRequest('POST', validBody), asNode, {});

    expect(response.statusCode).toBe(503);
    expect(headers['content-type']).toContain('application/json');
    expect(headers['cache-control']).toBe('no-store');
    expect(response.end).toHaveBeenCalledExactlyOnceWith('{"error":"not-configured"}');
  });

  it('rejects an empty or malformed body as an invalid request', async () => {
    const { response, asNode } = nodeResponse();

    await handleNodeFrameRequest(nodeRequest('POST'), asNode, {});

    expect(response.statusCode).toBe(400);
  });

  it('only accepts POST', async () => {
    const { response, headers, asNode } = nodeResponse();

    await handleNodeFrameRequest(nodeRequest('GET'), asNode, {});

    expect(response.statusCode).toBe(405);
    expect(headers.allow).toBe('POST');
    expect(response.end).toHaveBeenCalledExactlyOnceWith();
  });

  it('refuses a body that is too large without reading it all', async () => {
    const { response, asNode } = nodeResponse();

    await handleNodeFrameRequest(nodeRequest('POST', 'a'.repeat(40_000)), asNode, {});

    expect(response.statusCode).toBe(413);
  });
});

describe('deployed function entry', () => {
  it('serves the same handler with the process environment', async () => {
    const { response, asNode } = nodeResponse();

    await frame(nodeRequest('GET'), asNode);

    expect(response.statusCode).toBe(405);
  });
});
