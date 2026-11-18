import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleNodeFrameRequest } from './node-adapter';

/** Entry point of the deployed function. scripts/build-vercel.mjs bundles it into one file. */
export default function frame(request: IncomingMessage, response: ServerResponse): Promise<void> {
  return handleNodeFrameRequest(request, response, process.env);
}
