/*
 * Runs the real framing capability against the kit's sample briefs and prints, for each
 * one, what the model answered and whether the client would accept it. Used to observe
 * real model behaviour, including its failures, before trusting it in the interface.
 *
 *   ANTHROPIC_API_KEY=... npx tsx scripts/try-framing.ts [sample ids...]
 */
import sampleBriefs from '../src/data/kit/encargos-de-ejemplo.json';
import { frameBrief } from '../src/domain/brief/framing';
import { kitCatalog } from '../src/domain/capabilities/kit-catalog';
import { scanSensitiveData } from '../src/domain/sensitive-data/sensitive-data';
import { handleFrameRequest } from '../src/server/http';

const wanted = process.argv.slice(2);
const samples = sampleBriefs.encargos.filter(
  (sample) => wanted.length === 0 || wanted.includes(sample.id),
);

for (const sample of samples) {
  const text = scanSensitiveData(sample.texto).redactedText;
  const startedAt = Date.now();
  let raw: unknown = null;

  const outcome = await frameBrief(
    {
      frame: async (request) => {
        const response = await handleFrameRequest(
          new Request('http://localhost/api/frame', {
            method: 'POST',
            body: JSON.stringify({ text: request.text, answers: request.answers }),
          }),
          process.env,
        );
        raw = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(raw));
        return (raw as { brief: unknown }).brief;
      },
    },
    kitCatalog,
    { text, answers: {} },
  );

  console.log(`\n=== ${sample.id} (${sample.casoQuePrueba}) · ${Date.now() - startedAt} ms`);
  console.log(`need: ${text}`);
  console.log(outcome.ok ? 'ACCEPTED' : `REJECTED: ${outcome.issues.join(' | ')}`);
  console.log(JSON.stringify(raw, null, 2));
}
