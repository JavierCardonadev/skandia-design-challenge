import { kitCatalog } from '../domain/capabilities/kit-catalog';
import { createAnthropicGenerator } from './anthropic-generator';
import { frameNeed, type BriefGenerator } from './frame-need';

export interface ServerEnvironment {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * HTTP entry point of the framing capability, shared by the deployed function and the
 * local dev server. The API key is read from the server environment only.
 */
export async function handleFrameRequest(
  request: Request,
  env: ServerEnvironment,
  createGenerator: (apiKey: string, model?: string) => BriefGenerator = createAnthropicGenerator,
): Promise<Response> {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  const model = env.ANTHROPIC_MODEL?.trim();
  // An empty variable means "not set": the generator then uses its own default model.
  const generator = apiKey ? createGenerator(apiKey, model === '' ? undefined : model) : null;

  const { status, body } = await frameNeed(await readJson(request), generator, kitCatalog);
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
