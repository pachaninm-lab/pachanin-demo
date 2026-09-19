#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const writable = Array.isArray(state.agentWritableScope) ? state.agentWritableScope : [];

if (writable.length !== 1) {
  console.log(`force writable diff skipped: expected exactly one agent writable file, got ${writable.length}.`);
  process.exit(0);
}

const filePath = writable[0];
if (!filePath.startsWith('apps/web/tests/e2e/') || !filePath.endsWith('.spec.ts')) {
  console.log(`force writable diff skipped: agent writable file is not a narrow e2e spec: ${filePath}.`);
  process.exit(0);
}

const absolute = path.resolve(filePath);
if (!absolute.startsWith(process.cwd())) {
  throw new Error(`Refusing to write outside repository: ${filePath}`);
}

const runId = process.env.GITHUB_RUN_ID || 'local';
const isoDate = new Date().toISOString();
const marker = `// platform-v7 fallback run marker: ${runId} ${isoDate}\n`;

fs.mkdirSync(path.dirname(absolute), { recursive: true });
const current = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
const next = current.endsWith('\n') || current.length === 0 ? `${current}${marker}` : `${current}\n${marker}`;
fs.writeFileSync(absolute, next, 'utf8');
console.log(`force writable diff marker appended: ${filePath}`);
