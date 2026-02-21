import * as esbuild from 'esbuild';
import { resolve } from 'path';

await esbuild.build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  outfile: 'public/bundle.js',
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  minify: process.env.NODE_ENV === 'production',
  sourcemap: true,
  alias: {
    'auth-sso-kit': resolve('../../src'),
  },
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});

console.log('Client build complete');
