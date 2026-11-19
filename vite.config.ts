import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Serves /api/* during local development with the same handlers the deployed functions
 * use, so the live model can be exercised with an API key in the environment.
 * Without a key the handlers answer "not configured".
 */
function localModelApi(): Plugin {
  return {
    name: 'local-model-api',
    configureServer(server) {
      server.middlewares.use('/api', (request, response, next) => {
        void (async () => {
          const { isTaskName } = (await server.ssrLoadModule(
            '/src/server/http.ts',
          )) as typeof import('./src/server/http');
          const { handleNodeRequest } = (await server.ssrLoadModule(
            '/src/server/node-adapter.ts',
          )) as typeof import('./src/server/node-adapter');

          const task = (request.url ?? '').replace(/^\//, '').split('?')[0] ?? '';
          if (!isTaskName(task)) {
            next();
            return;
          }
          await handleNodeRequest(task, request, response, process.env);
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localModelApi()],
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
