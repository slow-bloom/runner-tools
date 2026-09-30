import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'runner-tools-package-'));

function run(command, args, cwd = root) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

try {
  const packOutput = execFileSync(
    'npm',
    ['pack', '--ignore-scripts', '--json', '--pack-destination', temporaryDirectory],
    { cwd: root, encoding: 'utf8' },
  );
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = join(temporaryDirectory, filename);

  writeFileSync(
    join(temporaryDirectory, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], temporaryDirectory);

  writeFileSync(
    join(temporaryDirectory, 'consumer.mjs'),
    `import assert from 'node:assert/strict';
import { solvePace } from '@slow-bloom/runner-tools';
assert.equal(solvePace({ distance: 10, timeSeconds: 2700, unit: 'km' })?.paceFormatted, "4'30\\"");
`,
  );
  writeFileSync(
    join(temporaryDirectory, 'consumer.cjs'),
    `const assert = require('node:assert/strict');
const { solvePace } = require('@slow-bloom/runner-tools');
assert.equal(solvePace({ distance: 10, timeSeconds: 2700, unit: 'km' })?.paceFormatted, "4'30\\"");
`,
  );
  writeFileSync(
    join(temporaryDirectory, 'consumer.ts'),
    `import { solvePace, type PaceSolverResult } from '@slow-bloom/runner-tools';
const result: PaceSolverResult | null = solvePace({ distance: 10, timeSeconds: 2700, unit: 'km' });
void result;
`,
  );
  writeFileSync(
    join(temporaryDirectory, 'consumer.cts'),
    `import { solvePace, type PaceSolverResult } from '@slow-bloom/runner-tools';
const result: PaceSolverResult | null = solvePace({ distance: 10, timeSeconds: 2700, unit: 'km' });
void result;
`,
  );
  writeFileSync(
    join(temporaryDirectory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        strict: true,
        noEmit: true,
      },
      include: ['consumer.ts', 'consumer.cts'],
    }),
  );

  run(process.execPath, ['consumer.mjs'], temporaryDirectory);
  run(process.execPath, ['consumer.cjs'], temporaryDirectory);
  run(
    process.execPath,
    [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--project', 'tsconfig.json'],
    temporaryDirectory,
  );

  const installedPackage = JSON.parse(
    readFileSync(
      join(temporaryDirectory, 'node_modules', '@slow-bloom', 'runner-tools', 'package.json'),
      'utf8',
    ),
  );
  if (installedPackage.version !== '0.2.0') {
    throw new Error(`Expected package version 0.2.0, received ${installedPackage.version}`);
  }

  console.log('Packed package passed ESM, CommonJS, and TypeScript consumer checks.');
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
