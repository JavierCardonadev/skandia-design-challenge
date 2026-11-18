import type { IncomingMessage } from 'node:http';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Serves /api/frame during local development with the same handler the deployed
 * function uses, so the live model can be exercised with `npm run dev` and an API key
 * in the environment. Without a key the handler answers "not configured".
 */
function localFramingApi(): Plugin {
  return {
    name: 'local-framing-api',
    configureServer(server) {
      server.middlewares.use('/api/frame', (request, response) => {
        void (async () => {
          const { handleFrameRequest } = (await server.ssrLoadModule(
            '/src/server/http.ts',
          )) as typeof import('./src/server/http');
          const answer = await handleFrameRequest(
            new Request('http://localhost/api/frame', {
              method: 'POST',
              body: await readBody(request),
            }),
            process.env,
          );
          response.statusCode = answer.status;
          response.setHeader('Content-Type', 'application/json');
          response.end(await answer.text());
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localFramingApi()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      // main.tsx only mounts the app; everything it renders is covered through App.
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.d.ts', 'src/**/*.test.{ts,tsx}'],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
});
