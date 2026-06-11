#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_QUEUE_PATH, DEFAULT_STATE_PATH } from './p7-autopilot-state-validate.mjs';
import { intakeSafeTask } from './p7-autopilot-safe-task-intake.mjs';

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

async function loadDefaultTask(statePath) {
  const state = await readJson(statePath);
  return {
    title: state.current,
    layer: state.current,
    allowedFiles: state.allowedCurrentScope,
    requestedFiles: [
      'scripts/p7-autopilot-issue-executor-dry-run.mjs',
      'docs/platform-v7/autopilot/autopilot-state.json',
      'docs/platform-v7/execution-queue.md',
      '.github/workflows/platform-v7-autopilot-issue-executor-dry-run.yml',
    ],
    successCriteria: [
      'selected safe task becomes a branch plan',
      'executor dry-run produces intended file actions',
      'blocked scope stops before write actions',
      'merge gate remains required',
    ],
  };
}

async function resolveTask(options) {
  if (options.taskJson) return JSON.parse(options.taskJson);
  if (options.taskPath) return readJson(options.taskPath);
  return loadDefaultTask(options.statePath ?? DEFAULT_STATE_PATH);
}

function plannedFileActions(intakeResult) {
  return (intakeResult.requestedFiles ?? []).map((file) => ({
    path: file,
    action: 'plan_only',
    write: false,
  }));
}

export async function runIssueExecutorDryRun(options = {}) {
  const task = await resolveTask(options);
  const intakeResult = await intakeSafeTask({
    statePath: options.statePath ?? DEFAULT_STATE_PATH,
    queuePath: options.queuePath ?? DEFAULT_QUEUE_PATH,
    taskJson: JSON.stringify(task),
    branchPrefix: options.branchPrefix ?? 'codex',
  });

  if (intakeResult.decision !== 'allowed') {
    return {
      mode: 'dry_run',
      decision: 'blocked',
      stopReason: intakeResult.stopReason,
      branchPlan: null,
      fileActions: [],
      mergeGateRequired: true,
      writeActionsPerformed: false,
      intake: intakeResult,
    };
  }

  return {
    mode: 'dry_run',
    decision: 'planned',
    stopReason: null,
    branchPlan: intakeResult.branchPlan,
    fileActions: plannedFileActions(intakeResult),
    mergeGateRequired: true,
    writeActionsPerformed: false,
    intake: {
      decision: intakeResult.decision,
      layerName: intakeResult.layerName,
      taskTitle: intakeResult.taskTitle,
      allowedFiles: intakeResult.allowedFiles,
      requestedFiles: intakeResult.requestedFiles,
    },
  };
}

async function cli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runIssueExecutorDryRun(options);
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
