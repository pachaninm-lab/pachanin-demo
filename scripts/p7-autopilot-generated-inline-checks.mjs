#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ref = process.env.P7_GENERATED_HEAD_REF;
if (!ref) throw new Error('Missing P7_GENERATED_HEAD_REF');

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', env: process.env, ...options });
}

const parent = mkdtempSync(path.join(tmpdir(), 'p7-inline-'));
const worktree = path.join(parent, 'checkout');
try {
  run('git', ['fetch', 'origin', ref]);
  run('git', ['worktree', 'add', '--detach', worktree, `origin/${ref}`]);
  run('corepack', ['enable'], { cwd: worktree });
  run('pnpm', ['install', '--frozen-lockfile'], { cwd: worktree });
  run('bash', ['scripts/p7-autopilot-guard.sh'], { cwd: worktree });
  run('pnpm', ['run', 'typecheck'], { cwd: worktree });
  run('pnpm', ['test'], { cwd: worktree });
  run('pnpm', ['build'], { cwd: worktree });
  console.log(`generated inline checks passed for ${ref}`);
} finally {
  try {
    run('git', ['worktree', 'remove', '--force', worktree]);
  } catch {
    // Ignore cleanup errors.
  }
  rmSync(parent, { recursive: true, force: true });
}
