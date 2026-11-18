import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleFrameRequest, type ServerEnvironment } from './http';

/** Far above any real need plus answers; stops oversized bodies before they are buffered. */
const MAX_BODY_BYTES = 32 * 1024;

async function readBody(request: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Bridges Node's request and response objects to the framing handler. The deployed
 * function and the local dev server both go through here, so they behave the same.
 */
export async function handleNodeFrameRequest(
  request: IncomingMessage,
  response: ServerResponse,
  env: ServerEnvironment,
): Promise<void> {
  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.setHeader('Allow', 'POST');
    response.end();
    return;
  }

  const body = await readBody(request);
  if (body === null) {
    response.statusCode = 413;
    response.end();
    return;
  }

  const answer = await handleFrameRequest(
    new Request('http://localhost/api/frame', { method: 'POST', body }),
    env,
  );
  response.statusCode = answer.status;
  answer.headers.forEach((value, name) => {
    response.setHeader(name, value);
  });
  response.end(await answer.text());
}
