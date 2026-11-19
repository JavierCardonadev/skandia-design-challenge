/*
 * Packages the app for Vercel using the Build Output API: the static site built by Vite
 * plus one function per model task, each bundled into a single file. Bundling keeps the source free of
 * runtime-specific import rules; what runs in production is exactly what the tests cover.
 */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const output = '.vercel/output';
const endpoints = ['frame', 'capability', 'verdict'];

await rm(output, { recursive: true, force: true });
await cp('dist', `${output}/static`, { recursive: true });

for (const endpoint of endpoints) {
  const functionDir = `${output}/functions/api/${endpoint}.func`;
  await mkdir(functionDir, { recursive: true });

  await build({
    stdin: {
      contents: `export { ${endpoint} as default } from './src/server/functions';`,
      resolveDir: '.',
      loader: 'ts',
    },
    outfile: `${functionDir}/index.js`,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    // The Node launcher expects the handler itself as the module's export.
    footer: { js: 'module.exports = module.exports.default;' },
    logLevel: 'info',
  });

  await writeFile(
    `${functionDir}/.vc-config.json`,
    JSON.stringify(
      {
        runtime: 'nodejs22.x',
        handler: 'index.js',
        launcherType: 'Nodejs',
        shouldAddHelpers: false,
        // A capability can take the model well over ten seconds.
        maxDuration: 60,
      },
      null,
      2,
    ),
  );
  // The bundle is CommonJS; say so explicitly so it never inherits "type": "module".
  await writeFile(`${functionDir}/package.json`, JSON.stringify({ type: 'commonjs' }, null, 2));
}

await writeFile(`${output}/config.json`, JSON.stringify({ version: 3 }, null, 2));
