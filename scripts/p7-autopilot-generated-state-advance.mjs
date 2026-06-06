#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
const queuePath = 'docs/platform-v7/execution-queue.md';
const progressPath = 'docs/platform-v7/autopilot/progress.json';
const auditDir = 'docs/platform-v7/autopilot/audit';

function nextSliceName(number) {
  return `Autopilot Product Slice ${String(number).padStart(2, '0')}`;
}

function generatedFileForSlice(number) {
  return `apps/web/tests/e2e/platform-v7-agent-generated-smoke-${String(number).padStart(2, '0')}.spec.ts`;
}

const state = JSON.parse(await readFile(statePath, 'utf8'));
const current = String(state.current || '');
const match = current.match(/Autopilot Product Slice\s+(\d+)/i);
if (!match) throw new Error(`Unsupported generated slice current: ${current}`);

const currentNumber = Number(match[1]);
const nextNumber = currentNumber + 1;
const sourcePr = Number(process.env.PR_NUMBER || 0) || null;
const lockPath = sourcePr ? path.join(auditDir, `generated-pr-${sourcePr}-merged.json`) : null;

if (lockPath) {
  try {
    const existingLock = JSON.parse(await readFile(lockPath, 'utf8'));
    if (existingLock.layerClosed && existingLock.layerClosed !== current) {
      console.log(`state advance already applied for generated PR #${sourcePr}: ${existingLock.layerClosed} -> ${existingLock.nextLayer || 'next layer'}`);
      process.exit(0);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

if (nextNumber > 20) {
  state.currentStatus = 'blocked';
  state.blockedReason = 'generated_slice_cap_reached';
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  process.exit(0);
}

const next = nextSliceName(nextNumber);
const filePath = generatedFileForSlice(currentNumber);
const generatedWritableFile = Array.isArray(state.agentWritableScope) && state.agentWritableScope.length === 1
  ? state.agentWritableScope[0]
  : generatedFileForSlice(currentNumber - 1);
state.lastClosed = Array.from(new Set([...(state.lastClosed || []), current]));
state.current = next;
state.currentStatus = 'ready';
state.openPr = null;
state.allowedCurrentScope = [
  filePath,
  'docs/platform-v7/autopilot/**',
  'docs/platform-v7/execution-queue.md',
  'scripts/p7-autopilot-*.mjs',
  '.github/workflows/platform-v7-autopilot-*.yml',
];
state.agentWritableScope = [filePath];

await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

const done = state.lastClosed.map((item) => `- ${item}`).join('\n');
await writeFile(queuePath, `# platform-v7 execution queue\n\nCURRENT: ${next}\n\nCURRENT ALLOWED:\n- ${filePath}\n\nCURRENT CRITERIA:\n- runner generates exactly one allowed code/test file;\n- generated branch is opened as PR by the repo-side runner;\n- generated PR receives platform-v7, agent-generated and automerge labels without manual labeling;\n- restricted areas remain blocked;\n- merge gate remains final authority.\n\nDONE:\n${done}\n\nNEXT:\n- Layer: ${nextSliceName(nextNumber + 1)}\n- Allowed files:\n  - docs/platform-v7/autopilot/**\n  - docs/platform-v7/execution-queue.md\n  - scripts/p7-autopilot-*.mjs\n  - .github/workflows/platform-v7-autopilot-*.yml\n- Success criteria:\n  - source-of-truth advances after generated PR merge;\n  - restricted areas remain blocked;\n  - merge gate remains final authority.\n- Readiness remains ${state.readiness || '72%'}.\n\nRULES:\n- One PR equals one narrow layer.\n- Keep controlled-pilot status.\n- Keep current slice limited to the exact allowed file.\n`);

await writeFile(progressPath, `${JSON.stringify({
  project: 'platform-v7 / Прозрачная Цена',
  fullTzReadinessPercent: Number(String(state.readiness || '72').replace(/[^0-9]/g, '')) || 72,
  currentStep: next,
  lastCompletedStep: current,
  openPr: null,
  blockedBy: [`${next} is not green/closed/mergeable. Dispatcher will not advance to Product Entry / Onboarding.`],
  nextStep: next,
  updatedAt: new Date().toISOString(),
  rules: {
    noAppsLanding: true,
    noFakeLiveClaims: true,
    noAutoMerge: true,
    controlledPilotOnly: true,
  },
}, null, 2)}\n`);

await mkdir(auditDir, { recursive: true });
const timestamp = new Date().toISOString();
if (lockPath) {
  await writeFile(lockPath, `${JSON.stringify({
    timestamp,
    sourcePr,
    sourceSha: process.env.MERGE_SHA || null,
    layerClosed: current,
    nextLayer: next,
    generatedWritableFile,
    nextAgentWritableFile: filePath,
    mergeDecision: 'generated_pr_merged',
  }, null, 2)}\n`);
}

await writeFile(path.join(auditDir, `${timestamp.replace(/[:.]/g, '-')}-pr-${sourcePr || 'unknown'}-state-advance.json`), `${JSON.stringify({
  timestamp,
  sourcePr,
  sourceSha: process.env.MERGE_SHA || null,
  layerClosed: current,
  nextLayer: next,
  allowedFiles: state.allowedCurrentScope,
  mergeDecision: 'state_advanced_pr',
}, null, 2)}\n`);

console.log(`state advanced: ${current} -> ${next}`);
console.log(`agent writable: ${filePath}`);
