import { handleFrameRequest } from '../src/server/http';

/** Vercel function: POST /api/frame. Everything it does lives in src/server, where it is tested. */
export function POST(request: Request): Promise<Response> {
  return handleFrameRequest(request, process.env);
}
