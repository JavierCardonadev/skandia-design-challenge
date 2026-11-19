import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleTaskRequest, type ServerEnvironment, type TaskName } from './http';

/** Far above a need plus the outputs of every step; stops oversized bodies early. */
const MAX_BODY_BYTES = 256 * 1024;

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
 * Bridges Node's request and response objects to a model task. The deployed functions
 * and the local dev server both go through here, so they behave the same.
 */
export async function handleNodeRequest(
  task: TaskName,
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

  const answer = await handleTaskRequest(
    task,
    new Request(`http://localhost/api/${task}`, { method: 'POST', body }),
    env,
  );
  response.statusCode = answer.status;
  answer.headers.forEach((value, name) => {
    response.setHeader(name, value);
  });
  response.end(await answer.text());
}

export function handleNodeFrameRequest(
  request: IncomingMessage,
  response: ServerResponse,
  env: ServerEnvironment,
): Promise<void> {
  return handleNodeRequest('frame', request, response, env);
}
