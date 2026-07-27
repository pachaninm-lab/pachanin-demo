#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const forbiddenPaths = [
  'netlify.toml',
  '.netlify',
  'apps/web/netlify.toml',
  'apps/web/.netlify',
];

const authorityFiles = new Set([
  'scripts/check-netlify-retirement.mjs',
  '.github/workflows/netlify-retirement-authority.yml',
]);

const violations = [];
for (const path of forbiddenPaths) {
  if (existsSync(path)) violations.push(`${path}: forbidden Netlify configuration/state path exists`);
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
  .filter((path) => !authorityFiles.has(path));

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
