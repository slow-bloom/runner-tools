import * as esbuild from 'esbuild';
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';

if (existsSync('dist')) {
  rmSync('dist', { recursive: true, force: true });
}

console.log('Building TypeScript types...');
execSync('npx tsc --emitDeclarationOnly', { stdio: 'inherit' });

console.log('Bundling JavaScript distributions...');

// 1. ESM bundle
await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  format: 'esm',
  sourcemap: true,
  target: 'es2022',
});

// 2. CJS bundle
await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.cjs',
  bundle: true,
  format: 'cjs',
  sourcemap: true,
  target: 'es2022',
});

// 3. Browser standalone IIFE (attaches to window.RunnerTools)
await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/runner-tools.global.js',
  bundle: true,
  format: 'iife',
  globalName: 'RunnerTools',
  sourcemap: true,
  minify: true,
  target: 'es2020',
});

console.log('Build complete! Artifacts in dist/:');
console.log('  - dist/index.js (ESM)');
console.log('  - dist/index.cjs (CJS)');
console.log('  - dist/runner-tools.global.js (Browser IIFE, window.RunnerTools)');
console.log('  - dist/**/*.d.ts (Type definitions)');
