#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_QUEUE_PATH, DEFAULT_STATE_PATH } from './p7-autopilot-state-validate.mjs';
import { runIssueExecutorDryRun } from './p7-autopilot-issue-executor-dry-run.mjs';

function parseArgs(argv) {
  const options = {
    statePath: DEFAULT_STATE_PATH,
    queuePath: DEFAULT_QUEUE_PATH,
    taskPath: null,
    taskJson: null,
    outputPath: null,
    branchPrefix: 'codex',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--state') options.statePath = argv[++index];
    else if (arg === '--queue') options.queuePath = argv[++index];
    else if (arg === '--task-file') options.taskPath = argv[++index];
    else if (arg === '--task') options.taskJson = argv[++index];
    else if (arg === '--output') options.outputPath = argv[++index];
    else if (arg === '--branch-prefix') options.branchPrefix = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), 'utf8'));
}

async function writeText(filePath, value) {
  await writeFile(path.resolve(filePath), value, 'utf8');
}

async function defaultTask(statePath) {
  const state = await readJson(statePath);
  return {
    title: state.current,
    layer: state.current,
    allowedFiles: state.allowedCurrentScope,
    requestedFiles: [
      'scripts/p7-autopilot-issue-executor-pr-wiring.mjs',
      'docs/platform-v7/autopilot/autopilot-state.json',
      'docs/platform-v7/execution-queue.md',
      '.github/workflows/platform-v7-autopilot-issue-executor-pr-wiring.yml',
    ],
    successCriteria: [
      'safe intake passed',
      'branch payload prepared',
      'draft pull request payload prepared',
      'merge gate required',
    ],
  };
}

async function resolveTask(options) {
  if (options.taskJson) return JSON.parse(options.taskJson);
  if (options.taskPath) return readJson(options.taskPath);
  return defaultTask(options.statePath ?? DEFAULT_STATE_PATH);
}

function draftPullRequestPayload(branchPlan, task) {
  return {
    title: task.title ?? branchPlan.branchName,
    head: branchPlan.branchName,
    base: branchPlan.baseRef ?? 'main',
    draft: true,
    body: 'Autopilot-generated draft PR. Merge gate required before merge.',
  };
}

export async function planIssueExecutorPrWiring(options = {}) {
  const task = await resolveTask(options);
  const dryRun = await runIssueExecutorDryRun({
    statePath: options.statePath ?? DEFAULT_STATE_PATH,
    queuePath: options.queuePath ?? DEFAULT_QUEUE_PATH,
    taskJson: JSON.stringify(task),
    branchPrefix: options.branchPrefix ?? 'codex',
  });

  if (dryRun.decision !== 'planned') {
    return {
      mode: 'dry_run',
      decision: 'blocked',
      stopReason: dryRun.stopReason,
      writeActionsPerformed: false,
      mergeGateRequired: true,
      dryRun,
    };
  }

  return {
    mode: 'dry_run',
    decision: 'planned',
    stopReason: null,
    writeActionsPerformed: false,
    branchRequest: {
      branchName: dryRun.branchPlan.branchName,
      baseRef: dryRun.branchPlan.baseRef,
      allowedFiles: dryRun.intake.allowedFiles,
    },
    draftPullRequest: draftPullRequestPayload(dryRun.branchPlan, task),
    nextChecks: ['GitHub Actions green', 'mergeable=true', 'draft=false', 'merge gate allowed'],
    mergeGateRequired: true,
    dryRun,
  };
}

async function cli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await planIssueExecutorPrWiring(options);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (options.outputPath) await writeText(options.outputPath, output);
  else process.stdout.write(output);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
