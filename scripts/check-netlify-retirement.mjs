#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const forbiddenPaths = [
  'netlify.toml',
  '.netlify',
  'apps/web/netlify.toml',
  'apps/web/.netlify',
];

// The controls that enforce the retirement have to quote what they forbid: a
// rule against "Netlify deploy" cannot be written without the phrase in it.
// Scanning them with the same grep makes the prohibition read as the violation,
// which is why this file already skipped itself. It is not the only such file.
const RETIREMENT_CONTROLS = new Set([
  'scripts/check-netlify-retirement.mjs',
  'scripts/check-production-hosting-authority.mjs',
]);

// Exempting a whole file would let a real reference hide inside a control, so
// the exemption is narrow: a control may name Netlify in a rule, but never
// carry something only a live integration needs.
const LIVE_INTEGRATION = /NETLIFY_[A-Z0-9_]+|api\.netlify\.com|app\.netlify\.com|netlify (?:cli|token|auth|hook)/i;

const violations = [];
for (const path of forbiddenPaths) {
  if (existsSync(path)) violations.push(`${path}: forbidden Netlify configuration/state path exists`);
}

for (const path of RETIREMENT_CONTROLS) {
  if (!existsSync(path)) continue;
  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (LIVE_INTEGRATION.test(line)) {
      violations.push(`${path}:${index + 1}: retirement control carries a live Netlify integration reference`);
    }
  });
}

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((path) =>
    path === 'package.json' ||
    path.startsWith('.github/workflows/') ||
    path.startsWith('apps/') ||
    path.startsWith('infra/') ||
    path.startsWith('scripts/')
  )
  .filter((path) => !RETIREMENT_CONTROLS.has(path));

if (tracked.length > 0) {
  let output = '';
  try {
    output = execFileSync('git', ['grep', '-nEi',
      'netlify(\\.app| deploy| build| cli| hook| site| project| token| auth| api)|NETLIFY_[A-Z0-9_]+|api\\.netlify\\.com|app\\.netlify\\.com',
      '--', ...tracked], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  for (const line of output.split('\n').filter(Boolean)) violations.push(line);
}

if (violations.length > 0) {
  console.error('Netlify retirement authority failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Netlify retirement authority passed: no active Netlify path, workflow, runtime, token, hook or deployment reference remains.');
