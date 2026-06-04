#!/usr/bin/env node
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyzeCheckFailures } from './p7-autopilot-check-analyzer.mjs';
import { runIssueExecutorDryRun } from './p7-autopilot-issue-executor-dry-run.mjs';
import { planIssueExecutorPrWiring } from './p7-autopilot-issue-executor-pr-wiring.mjs';
import { evaluateMergeGate } from './p7-autopilot-merge-gate.mjs';
import { selectNextLayer } from './p7-autopilot-next-layer.mjs';
import { decideSafeFix } from './p7-autopilot-safe-fix.mjs';
import { intakeSafeTask } from './p7-autopilot-safe-task-intake.mjs';
import { updateAutopilotStateAfterMerge } from './p7-autopilot-state-update.mjs';
import {
  DEFAULT_QUEUE_PATH,
  DEFAULT_STATE_PATH,
  scopeMatches,
  validateAutopilotState,
} from './p7-autopilot-state-validate.mjs';

function parseArgs(argv) {
  const options = {
    statePath: DEFAULT_STATE_PATH,
    queuePath: DEFAULT_QUEUE_PATH,
    outputPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--state') options.statePath = argv[++index];
    else if (arg === '--queue') options.queuePath = argv[++index];
    else if (arg === '--output') options.outputPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), 'utf8'));
}

async function readText(filePath) {
  return readFile(path.resolve(filePath), 'utf8');
}

async function writeJson(filePath, value) {
  await writeFile(path.resolve(filePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function safeTask(state) {
  return {
    title: state.current,
    layer: state.current,
    allowedFiles: state.allowedCurrentScope,
    requestedFiles: [
      'scripts/p7-autopilot-e2e-report.mjs',
      'docs/platform-v7/autopilot/autopilot-state.json',
      'docs/platform-v7/execution-queue.md',
      '.github/workflows/platform-v7-autopilot-e2e-report.yml',
    ],
    successCriteria: [
      'selector is checked',
      'safe intake is checked',
      'executor plan is checked',
      'merge gate is checked',
      'state update is checked',
    ],
  };
}

function unsafeTask(state) {
  return {
    ...safeTask(state),
    requestedFiles: ['apps/landing/bad.tsx'],
  };
}

function touchesForbidden(file, forbiddenZones) {
  return forbiddenZones.some((zone) => scopeMatches(zone, file) || scopeMatches(file, zone));
}

async function writeGateInputs(tmpDir, files) {
  const prPath = path.join(tmpDir, 'pr.json');
  const statusesPath = path.join(tmpDir, 'statuses.json');
  const workflowsPath = path.join(tmpDir, 'workflows.json');
  const changedFilesPath = path.join(tmpDir, 'changed-files.json');
  await writeJson(prPath, { number: 0, draft: false, mergeable: true, head_sha: 'dry-run' });
  await writeJson(statusesPath, { statuses: [{ context: 'dry-run', state: 'success' }] });
  await writeJson(workflowsPath, { workflow_runs: [{ name: 'dry-run', status: 'completed', conclusion: 'success' }] });
  await writeJson(changedFilesPath, files);
  return { prPath, statusesPath, workflowsPath, changedFilesPath };
}

async function writeSafeFixInputs(tmpDir) {
  const reportPath = path.join(tmpDir, 'safe-fix-report.json');
  const attemptsPath = path.join(tmpDir, 'safe-fix-attempts.json');
  await writeJson(reportPath, {
    failures: [
      {
        workflowName: 'Node CI',
        jobName: 'ci',
        failedStep: 'Run pnpm run typecheck',
        suspectedCategory: 'typecheck_failure',
        conclusion: 'failure',
      },
    ],
  });
  await writeJson(attemptsPath, { autoFixCommits: 0, rerunsByWorkflow: {}, failureFingerprints: [] });
  return { reportPath, attemptsPath };
}

export async function runE2eReport(options = {}) {
  const statePath = options.statePath ?? DEFAULT_STATE_PATH;
  const queuePath = options.queuePath ?? DEFAULT_QUEUE_PATH;
  const [state, queueText] = await Promise.all([readJson(statePath), readText(queuePath)]);
  const validation = validateAutopilotState(state, queueText);
  const task = safeTask(state);
  const blockedTask = unsafeTask(state);
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'p7-e2e-report-'));

  const selector = await selectNextLayer({ statePath, queuePath, issueBody: state.current, noGitBranches: true });
  const intakeSafe = await intakeSafeTask({ statePath, queuePath, taskJson: JSON.stringify(task) });
  const intakeBlocked = await intakeSafeTask({ statePath, queuePath, taskJson: JSON.stringify(blockedTask) });
  const executor = await runIssueExecutorDryRun({ statePath, queuePath, taskJson: JSON.stringify(task) });
  const wiring = await planIssueExecutorPrWiring({ statePath, queuePath, taskJson: JSON.stringify(task) });
  const analyzer = await analyzeCheckFailures();

  const safeFixInputs = await writeSafeFixInputs(tmpDir);
  const safeFix = await decideSafeFix({
    statePath,
    ...safeFixInputs,
    candidateFiles: ['scripts/p7-autopilot-e2e-report.mjs'],
  });

  const gateInputs = await writeGateInputs(tmpDir, task.requestedFiles);
  const mergeGate = await evaluateMergeGate({ statePath, queuePath, ...gateInputs, dryRun: true });

  const tmpStatePath = path.join(tmpDir, 'state.json');
  const tmpQueuePath = path.join(tmpDir, 'queue.md');
  await writeJson(tmpStatePath, state);
  await writeFile(tmpQueuePath, queueText, 'utf8');
  const stateUpdate = await updateAutopilotStateAfterMerge({
    statePath: tmpStatePath,
    queuePath: tmpQueuePath,
    dryRun: true,
    sourcePr: 0,
    sourceSha: 'dry-run',
    mergedLayer: state.current,
  });

  const noForbiddenFiles = task.requestedFiles.every((file) => !touchesForbidden(file, state.forbiddenZones ?? []));
  const checks = {
    stateValid: validation.valid,
    selectorAllowed: selector.stopReason === null,
    safeIntakeAllowed: intakeSafe.decision === 'allowed',
    unsafeIntakeBlocked: intakeBlocked.decision === 'blocked',
    executorPlanned: executor.decision === 'planned',
    wiringPlanned: wiring.decision === 'planned',
    analyzerNoFailures: analyzer.summary.totalFailures === 0,
    safeFixAllowed: safeFix.decision === 'safe_fix_allowed',
    mergeGateAllowed: mergeGate.decision === 'allowed',
    stateUpdateSelectedNext: Boolean(stateUpdate.auditRecord.nextLayer),
    noForbiddenFiles,
  };
  const passed = Object.values(checks).every(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    current: state.current,
    nextLayer: stateUpdate.auditRecord.nextLayer,
    passed,
    checks,
    reports: {
      selector: { layerName: selector.layerName, stopReason: selector.stopReason },
      intakeSafe: { decision: intakeSafe.decision, stopReason: intakeSafe.stopReason },
      intakeBlocked: { decision: intakeBlocked.decision, stopReason: intakeBlocked.stopReason },
      executor: { decision: executor.decision, stopReason: executor.stopReason },
      wiring: { decision: wiring.decision, stopReason: wiring.stopReason },
      analyzer: analyzer.summary,
      safeFix: { decision: safeFix.decision, stopReason: safeFix.stopReason },
      mergeGate: { decision: mergeGate.decision, stopReason: mergeGate.stopReason },
      stateUpdate: {
        nextLayer: stateUpdate.auditRecord.nextLayer,
        stopReason: stateUpdate.auditRecord.stopReason,
      },
    },
  };
}

async function cli() {
  const options = parseArgs(process.argv.slice(2));
  const report = await runE2eReport(options);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.outputPath) await writeFile(path.resolve(options.outputPath), output, 'utf8');
  else process.stdout.write(output);
  if (!report.passed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
