import { build } from 'esbuild';
import { resolve } from 'path';

await build({
  entryPoints: ['server.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/server.js',
  external: ['express', 'cors', 'dotenv'],
  alias: {
    '@swapkit/helpers': resolve('../../packages/swapkit/helpers/src/index.ts'),
    '@swapkit/core': resolve('../../packages/swapkit/core/src/index.ts'),
    '@swapkit/sdk': resolve('../../packages/swapkit/sdk/src/index.ts'),
  },
  loader: {
    '.ts': 'ts'
  }
});

console.log('Build completed!');
