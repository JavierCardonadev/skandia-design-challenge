import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Serves /api/frame during local development with the same handler the deployed
 * function uses, so the live model can be exercised with an API key in the environment.
 * Without a key the handler answers "not configured".
 */
function localFramingApi(): Plugin {
  return {
    name: 'local-framing-api',
    configureServer(server) {
      server.middlewares.use('/api/frame', (request, response) => {
        void (async () => {
          const { handleNodeFrameRequest } = (await server.ssrLoadModule(
            '/src/server/node-adapter.ts',
          )) as typeof import('./src/server/node-adapter');
          await handleNodeFrameRequest(request, response, process.env);
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
