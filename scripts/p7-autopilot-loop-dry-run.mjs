#!/usr/bin/env node
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_QUEUE_PATH, DEFAULT_STATE_PATH } from './p7-autopilot-state-validate.mjs';
import { updateAutopilotStateAfterMerge } from './p7-autopilot-state-update.mjs';
import { selectNextLayer } from './p7-autopilot-next-layer.mjs';
import { evaluateMergeGate } from './p7-autopilot-merge-gate.mjs';

const DEFAULT_AUDIT_DIR = 'docs/platform-v7/autopilot/audit';

function parseArgs(argv) {
  const options = {
    statePath: DEFAULT_STATE_PATH,
    queuePath: DEFAULT_QUEUE_PATH,
    sourcePr: 1491,
    sourceSha: null,
    outputPath: null,
    auditDir: DEFAULT_AUDIT_DIR,
    writeAudit: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--state') options.statePath = argv[++index];
    else if (arg === '--queue') options.queuePath = argv[++index];
    else if (arg === '--source-pr') options.sourcePr = Number(argv[++index]);
    else if (arg === '--source-sha') options.sourceSha = argv[++index];
    else if (arg === '--output') options.outputPath = argv[++index];
    else if (arg === '--audit-dir') options.auditDir = argv[++index];
    else if (arg === '--write-audit') options.writeAudit = true;
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

function rewriteQueueForState(queueText, state) {
  const lines = queueText.split(/\r?\n/);
  const output = [];
  let skippingCurrentAllowed = false;

  for (const line of lines) {
    if (line.startsWith('CURRENT:')) {
      output.push(`CURRENT: ${state.current}`);
      continue;
    }
    if (line.trim() === 'CURRENT ALLOWED:') {
      output.push(line);
      for (const file of state.allowedCurrentScope ?? []) output.push(`- ${file}`);
      skippingCurrentAllowed = true;
      continue;
    }
    if (skippingCurrentAllowed) {
      if (/^[A-Z][A-Z\s]+:\s*$/.test(line.trim())) {
        skippingCurrentAllowed = false;
        output.push(line);
      }
      continue;
    }
    output.push(line);
  }

  return output.join('\n');
}

async function writeGateInputs(tmpDir, state) {
  const prPath = path.join(tmpDir, 'pr.json');
  const statusesPath = path.join(tmpDir, 'statuses.json');
  const workflowsPath = path.join(tmpDir, 'workflows.json');
  const changedFilesPath = path.join(tmpDir, 'changed-files.json');
  await writeJson(prPath, {
    number: 0,
    draft: false,
    mergeable: true,
    head_sha: 'dry-run',
  });
  await writeJson(statusesPath, {
    statuses: [{ context: 'dry-run', state: 'success' }],
  });
  await writeJson(workflowsPath, {
    workflow_runs: [{ name: 'dry-run', status: 'completed', conclusion: 'success' }],
  });
  await writeJson(changedFilesPath, state.allowedCurrentScope ?? []);
  return { prPath, statusesPath, workflowsPath, changedFilesPath };
}

export async function runLoopDryRun(options = {}) {
  const state = await readJson(options.statePath ?? DEFAULT_STATE_PATH);
  const queueText = await readText(options.queuePath ?? DEFAULT_QUEUE_PATH);
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'p7-loop-dry-run-'));
  const tmpStatePath = path.join(tmpDir, 'autopilot-state.json');
  const tmpQueuePath = path.join(tmpDir, 'execution-queue.md');
  await writeJson(tmpStatePath, state);
  await writeFile(tmpQueuePath, queueText, 'utf8');

  const updateResult = await updateAutopilotStateAfterMerge({
    statePath: tmpStatePath,
    queuePath: tmpQueuePath,
    dryRun: true,
    sourcePr: options.sourcePr ?? 1491,
    sourceSha: options.sourceSha ?? 'dry-run-sha',
    mergedLayer: state.current,
  });

  await writeJson(tmpStatePath, updateResult.nextState);
  await writeFile(tmpQueuePath, rewriteQueueForState(queueText, updateResult.nextState), 'utf8');

  const selectorResult = await selectNextLayer({
    statePath: tmpStatePath,
    queuePath: tmpQueuePath,
    issueBody: `Dry-run continuation for ${updateResult.nextState.current}`,
    noGitBranches: true,
  });

  const gateInputs = await writeGateInputs(tmpDir, updateResult.nextState);
  const gateResult = await evaluateMergeGate({
    statePath: tmpStatePath,
    queuePath: tmpQueuePath,
    ...gateInputs,
    dryRun: true,
  });

  const result = {
    sourcePr: options.sourcePr ?? 1491,
    mergedSha: options.sourceSha ?? 'dry-run-sha',
    stateUpdated: updateResult.nextState.current !== state.current,
    nextLayerSelected: selectorResult.stopReason === null,
    allowedFiles: selectorResult.allowedFiles ?? [],
    mergeGate: 'not_applicable_dry_run',
    mergeGateDecision: gateResult.decision,
    stopReason: selectorResult.stopReason ?? gateResult.stopReason,
  };

  if (options.writeAudit) {
    await mkdir(path.resolve(options.auditDir ?? DEFAULT_AUDIT_DIR), { recursive: true });
    const timestamp = new Date().toISOString();
    const safeTimestamp = timestamp.replace(/[:.]/g, '-');
    await writeJson(path.join(options.auditDir ?? DEFAULT_AUDIT_DIR, `${safeTimestamp}-pr-${result.sourcePr}-loop-dry-run.json`), {
      timestamp,
      sourcePr: result.sourcePr,
      sourceSha: result.mergedSha,
      layerClosed: state.current,
      nextLayer: updateResult.nextState.current,
      allowedFiles: result.allowedFiles,
      checksSummary: {
        success: ['dry-run'],
        failed: [],
        skipped: [],
      },
      autoFixAttempts: 0,
      mergeDecision: 'dry_run',
      stopReason: result.stopReason,
    });
  }

  return result;
}

async function cli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runLoopDryRun(options);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (options.outputPath) {
    await writeFile(path.resolve(options.outputPath), output, 'utf8');
  } else {
    process.stdout.write(output);
  }
  if (result.stopReason) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
