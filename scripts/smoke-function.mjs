/*
 * Loads every bundled function exactly as it will be deployed and calls it once with an
 * empty request. Each must answer "invalid request"; anything else fails the build.
 */
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const require = createRequire(import.meta.url);

for (const endpoint of ['frame', 'capability', 'verdict']) {
  const handler = require(`../.vercel/output/functions/api/${endpoint}.func/index.js`);
  const request = Object.assign(Readable.from([Buffer.from('{}')]), { method: 'POST' });
  const response = {
    statusCode: 200,
    setHeader() {},
    end(body) {
      this.body = body;
    },
  };

  await handler(request, response);

  if (response.statusCode !== 400 || response.body !== '{"error":"invalid-request"}') {
    console.error(
      `Unexpected answer from /api/${endpoint}: ${response.statusCode} ${response.body}`,
    );
    process.exit(1);
  }
  console.log(`/api/${endpoint} loads and answers as expected (400 invalid-request).`);
}
