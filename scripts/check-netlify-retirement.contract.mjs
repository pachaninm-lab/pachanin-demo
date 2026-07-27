#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanNetlifyRetirement } from './check-netlify-retirement.mjs';

function withRepository(files, callback) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'netlify-retirement-contract-'));
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = path.join(root, relativePath);
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, content, 'utf8');
    }
    return callback(root, Object.keys(files));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function scan(files) {
  return withRepository(files, (root, trackedFiles) =>
    scanNetlifyRetirement({ root, trackedFiles }));
}

function assertViolation(files, pattern) {
  const violations = scan(files);
  assert.ok(
    violations.some((violation) => pattern.test(violation)),
    `expected violation ${pattern}, actual: ${JSON.stringify(violations)}`,
  );
}

const word = ['net', 'lify'].join('');
const envName = ['NET', 'LIFY_AUTH_TOKEN'].join('');

assert.deepEqual(scan({
  'scripts/policy.mjs': [
    `const forbidden = /Green working status: build success + ${word} deploy/i;`,
    `if (text.includes('${word} is retired')) throw new Error('stale policy');`,
  ].join('\n'),
  '.github/workflows/retirement.yml': [
    `name: ${word} Retirement Authority`,
    'on: [pull_request]',
    'jobs:',
    '  check:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - run: node scripts/check-netlify-retirement.mjs',
  ].join('\n'),
  'package.json': JSON.stringify({
    scripts: { 'check:netlify-retirement': 'node scripts/check-netlify-retirement.mjs' },
  }),
}), []);

assertViolation({
  'package.json': JSON.stringify({ dependencies: { '@netlify/functions': '1.0.0' } }),
}, /active Netlify package/u);

assertViolation({
  'package.json': JSON.stringify({ scripts: { deploy: `${word} deploy --prod` } }),
}, /executes Netlify CLI/u);

assertViolation({
  '.github/workflows/deploy.yml': [
    'name: deploy',
    'jobs:',
    '  deploy:',
    '    runs-on: ubuntu-latest',
    '    env:',
    `      ${envName}: secret`,
    '    steps:',
    `      - uses: nwtgck/actions-${word}@v3`,
    '      - run: |',
    `          npx ${word} deploy --prod`,
  ].join('\n'),
}, /Netlify/u);

assertViolation({
  'apps/api/deploy.mjs': `execFileSync('${word}', ['deploy', '--prod']);\n`,
}, /child process/u);

assertViolation({
  'apps/api/config.ts': `const token = process.env.${envName};\n`,
}, /environment configuration/u);

assertViolation({
  'apps/web/runtime.ts': `fetch('https://project.${word}.app/api');\n`,
}, /runtime endpoint/u);

assertViolation({
  'scripts/deploy.sh': `npx ${word} deploy --prod\n`,
}, /executes Netlify CLI/u);

withRepository({
  'netlify.toml': '[build]\n',
}, (root, trackedFiles) => {
  const violations = scanNetlifyRetirement({ root, trackedFiles });
  assert.ok(violations.some((violation) => /forbidden Netlify configuration\/state path/u.test(violation)));
});

assert.deepEqual(scan({
  'package.json': JSON.stringify({ scripts: { deploy: 'bash scripts/production-web-exact-sha.sh' } }),
  '.github/workflows/release.yml': [
    'name: REG.RU exact SHA release',
    'jobs:',
    '  release:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - run: bash scripts/production-web-exact-sha.sh',
  ].join('\n'),
  'apps/web/runtime.ts': `export const productionHost = 'https://процент-агро.рф';\n`,
}), []);

console.log('check-netlify-retirement contract: PASS');
