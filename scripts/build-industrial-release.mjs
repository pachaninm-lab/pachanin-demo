#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function run(command, label) {
  console.log(`→ ${label}`);
  execSync(command, { stdio: 'inherit', env: process.env });
}

function runIfFileExists(path, command, label) {
  if (!existsSync(path)) {
    console.log(`↷ skip ${label} (${path} not found)`);
    return;
  }
  run(command, label);
}

try {
  run('pnpm install --frozen-lockfile=false', 'install');
  runIfFileExists('tsconfig.shared-verify.json', 'pnpm -s verify:shared', 'shared verify');
  runIfFileExists('packages/domain-core/tsconfig.json', 'pnpm -s typecheck:domain', 'domain typecheck');
  runIfFileExists('apps/api/package.json', 'pnpm --filter @pc/api build', 'api build');
  runIfFileExists('apps/web/package.json', 'pnpm --filter @pc/web build', 'web build');
  console.log('✓ industrial release build complete');
} catch (error) {
  console.error('✗ industrial release build failed');
  throw error;
}
