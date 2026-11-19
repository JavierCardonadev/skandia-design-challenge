/*
 * Runs the live capabilities and the verdict once, end to end, without the interface:
 * research comes from the kit, the other steps and the verdict from the real model.
 * Prints whether each answer passes the same checks the interface applies.
 *
 *   ANTHROPIC_API_KEY=... npx tsx scripts/try-run.ts
 */
import { canRunOnModel } from '../src/domain/capabilities/generative';
import { kitCatalog } from '../src/domain/capabilities/kit-catalog';
import type { CompletedResult } from '../src/domain/capabilities/types';
import { executeCapability, type CapabilityProvider } from '../src/domain/providers/provider';
import { createRemoteProvider } from '../src/domain/providers/remote-provider';
import { createSimulatedProvider } from '../src/domain/providers/simulated-provider';
import { buildDeliverable } from '../src/domain/result/deliverable';
import { createRemoteVerdictWriter } from '../src/domain/result/remote-verdict-writer';
import { requestVerdict, toVerdictInput } from '../src/domain/result/verdict';
import { createRun, runReducer } from '../src/domain/run/run';
import { handleTaskRequest, isTaskName } from '../src/server/http';

const need =
  'Quiero saber si vale la pena un simulador de aportes para el fondo voluntario antes de pedirle un sprint a desarrollo. Es para la app.';
const plan = ['investigacion', 'contenido', 'estrategia', 'prototipado', 'validacion'];

/** Calls the server handlers in process, as the deployed functions would. */
const inProcess: typeof fetch = (input, init) => {
  const task = String(input).replace('/api/', '');
  if (!isTaskName(task)) throw new Error(`Unknown task ${task}`);
  return handleTaskRequest(
    task,
    new Request(`http://localhost/api/${task}`, { method: 'POST', body: init?.body as string }),
    process.env,
  );
};

const model = createRemoteProvider({ fetch: inProcess });
const simulated = createSimulatedProvider({ wait: () => Promise.resolve() });
let run = createRun(kitCatalog, plan);
const done: CompletedResult[] = [];

for (const capability of kitCatalog.capabilities) {
  const provider: CapabilityProvider = canRunOnModel(capability) ? model : simulated;
  const startedAt = Date.now();
  const result = await executeCapability(provider, {
    capability,
    need,
    attempt: 1,
    upstream: done,
    adjustmentNote: null,
  });

  console.log(
    `\n=== ${capability.id} · ${canRunOnModel(capability) ? 'model' : 'kit'} · ${Date.now() - startedAt} ms`,
  );
  if (result.status === 'failed') {
    console.log(`FAILED ${result.failure.code}: ${result.failure.technicalMessage}`);
    break;
  }
  console.log(
    JSON.stringify(
      { evidence: result.evidence, warnings: result.warnings, content: result.content },
      null,
      2,
    ),
  );
  done.push(result);
  run = [
    { type: 'step-started', capabilityId: capability.id } as const,
    { type: 'step-completed', capabilityId: capability.id, result } as const,
    { type: 'step-approved', capabilityId: capability.id } as const,
  ].reduce(runReducer, run);
}

const deliverable = buildDeliverable(run);
if (deliverable) {
  const nameOf = (id: string) => kitCatalog.capabilities.find((c) => c.id === id)?.name ?? id;
  const startedAt = Date.now();
  const outcome = await requestVerdict(
    createRemoteVerdictWriter({ fetch: inProcess }),
    deliverable,
    toVerdictInput(deliverable, need, nameOf),
  );
  console.log(`\n=== verdict · rules say ${deliverable.verdict} · ${Date.now() - startedAt} ms`);
  console.log(JSON.stringify(outcome, null, 2));
}
