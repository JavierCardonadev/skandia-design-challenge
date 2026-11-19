import { kitCatalog } from '../domain/capabilities/kit-catalog';
import { createAnthropicGenerator } from './anthropic-generator';
import { frameNeed } from './frame-need';
import type { ServerTask, StructuredGenerator } from './generation';
import { runCapability } from './run-capability';
import { writeVerdict } from './write-verdict';

export interface ServerEnvironment {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
}

/** Everything the server asks the model to do, by the name of its endpoint under /api. */
export const TASKS = {
  frame: frameNeed,
  capability: runCapability,
  verdict: writeVerdict,
} satisfies Record<string, ServerTask>;

export type TaskName = keyof typeof TASKS;

export function isTaskName(name: string): name is TaskName {
  return Object.hasOwn(TASKS, name);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

type GeneratorFactory = (apiKey: string, model?: string) => StructuredGenerator;

/**
 * HTTP entry point of every model task, shared by the deployed functions and the local
 * dev server. The API key is read from the server environment only.
 */
export async function handleTaskRequest(
  task: TaskName,
  request: Request,
  env: ServerEnvironment,
  createGenerator: GeneratorFactory = createAnthropicGenerator,
): Promise<Response> {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  const model = env.ANTHROPIC_MODEL?.trim();
  // An empty variable means "not set": the generator then uses its own default model.
  const generator = apiKey ? createGenerator(apiKey, model === '' ? undefined : model) : null;

  const { status, body } = await TASKS[task](await readJson(request), generator, kitCatalog);
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function handleFrameRequest(
  request: Request,
  env: ServerEnvironment,
  createGenerator?: GeneratorFactory,
): Promise<Response> {
  return handleTaskRequest('frame', request, env, createGenerator);
}
