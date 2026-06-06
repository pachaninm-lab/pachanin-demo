#!/usr/bin/env node
import { readFileSync, appendFileSync } from 'node:fs';

const state = JSON.parse(readFileSync('docs/platform-v7/autopilot/autopilot-state.json', 'utf8'));
const writable = Array.isArray(state.agentWritableScope) ? state.agentWritableScope : [];
if (writable.length !== 1) process.exit(0);

const filePath = writable[0];
if (!filePath.startsWith('apps/web/tests/e2e/') || !filePath.endsWith('.spec.ts')) process.exit(0);

const runId = process.env.GITHUB_RUN_ID || 'local';
appendFileSync(filePath, `\n// platform-v7 fallback run marker: ${runId} ${new Date().toISOString()}\n`, 'utf8');
console.log(`forced writable diff marker: ${filePath}`);
