import * as esbuild from 'esbuild';
import { execSync } from 'child_process';
import { existsSync, rmSync, readdirSync, statSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';

if (existsSync('dist')) {
  rmSync('dist', { recursive: true, force: true });
}

console.log('Building TypeScript types...');
execSync('npx tsc --emitDeclarationOnly', { stdio: 'inherit' });

// Copy LICENSE directly to dist
copyFileSync('LICENSE', 'dist/LICENSE');

// Generate CommonJS-compatible declaration files (.d.cts) for node16 consumers
function generateDctsFiles(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      generateDctsFiles(fullPath);
    } else if (entry.endsWith('.d.ts')) {
      const targetCts = fullPath.slice(0, -5) + '.d.cts';
      let content = readFileSync(fullPath, 'utf8');
      content = content.replace(/(from\s+['"]\.[^'"]+)\.js(['"])/g, '$1.cjs$2');
      content = content.replace(/(import\(['"]\.[^'"]+)\.js(['"]\))/g, '$1.cjs$2');
      writeFileSync(targetCts, content);
    }
  }
}
generateDctsFiles('dist');

console.log('Bundling JavaScript distributions...');

const rawLicense = readFileSync('LICENSE', 'utf8').trim();
const licenseCommentBody = rawLicense
  .split('\n')
  .map((line) => (line.length > 0 ? ` * ${line}` : ' *'))
  .join('\n');

const BANNER = {
  js: `/*!\n * @slow-bloom/runner-tools\n * https://github.com/slow-bloom/runner-tools\n *\n${licenseCommentBody}\n */`,
};

// 1. ESM bundle
await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  format: 'esm',
  banner: BANNER,
  sourcemap: true,
  target: 'es2022',
});

// 2. CJS bundle
await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.cjs',
  bundle: true,
  format: 'cjs',
  banner: BANNER,
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
  banner: BANNER,
  legalComments: 'inline',
  sourcemap: true,
  minify: true,
  target: 'es2020',
});

console.log('Build complete! Artifacts in dist/:');
console.log('  - dist/index.js (ESM)');
console.log('  - dist/index.cjs (CJS)');
console.log('  - dist/runner-tools.global.js (Browser IIFE, window.RunnerTools, MIT banner preserved)');
console.log('  - dist/**/*.d.ts (ESM Type definitions)');
console.log('  - dist/**/*.d.cts (CJS Type definitions for node16 compatibility)');
