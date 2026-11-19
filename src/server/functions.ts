import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TaskName } from './http';
import { handleNodeRequest } from './node-adapter';

type NodeHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

function deployed(task: TaskName): NodeHandler {
  return (request, response) => handleNodeRequest(task, request, response, process.env);
}

/*
 * Entry points of the deployed functions, one per endpoint under /api.
 * scripts/build-vercel.mjs bundles each of them into a single file.
 */
export const frame = deployed('frame');
export const capability = deployed('capability');
export const verdict = deployed('verdict');
