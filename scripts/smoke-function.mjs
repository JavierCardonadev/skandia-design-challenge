/*
 * Loads the bundled function exactly as it will be deployed and calls it once without
 * an API key. It must answer "not configured"; anything else fails the build.
 */
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const handler = createRequire(import.meta.url)(
  '../.vercel/output/functions/api/frame.func/index.js',
);

delete process.env.ANTHROPIC_API_KEY;
const request = Object.assign(
  Readable.from([Buffer.from(JSON.stringify({ text: 'Quiero un simulador', answers: {} }))]),
  { method: 'POST' },
);
const response = {
  statusCode: 200,
  setHeader() {},
  end(body) {
    this.body = body;
  },
};

await handler(request, response);

if (response.statusCode !== 503 || response.body !== '{"error":"not-configured"}') {
  console.error(
    `Unexpected answer from the bundled function: ${response.statusCode} ${response.body}`,
  );
  process.exit(1);
}
console.log('Bundled function answers as expected without a key (503 not-configured).');
