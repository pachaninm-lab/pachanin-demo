#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_QUEUE_PATH,
  DEFAULT_STATE_PATH,
  FORBIDDEN_ALLOWED_SCOPE,
  REQUIRED_MATURITY_LANGUAGE,
  scopeMatches,
  validateAutopilotState,
} from './p7-autopilot-state-validate.mjs';

const DEFAULT_AUDIT_DIR = 'docs/platform-v7/autopilot/audit';

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.resolve(relativePath), 'utf8'));
}

async function readText(relativePath) {
  return readFile(path.resolve(relativePath), 'utf8');
}

async function writeJson(relativePath, value) {
  await writeFile(path.resolve(relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const options = {
    statePath: DEFAULT_STATE_PATH,
    queuePath: DEFAULT_QUEUE_PATH,
    auditDir: DEFAULT_AUDIT_DIR,
    dryRun: true,
    sourcePr: null,
    sourceSha: null,
    mergedLayer: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--state') options.statePath = argv[++index];
    else if (arg === '--queue') options.queuePath = argv[++index];
    else if (arg === '--audit-dir') options.auditDir = argv[++index];
    else if (arg === '--source-pr') options.sourcePr = Number(argv[++index]);
    else if (arg === '--source-sha') options.sourceSha = argv[++index];
    else if (arg === '--merged-layer') options.mergedLayer = argv[++index];
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--write') options.dryRun = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readGitHubEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return {};

  try {
    const payload = JSON.parse(await readFile(eventPath, 'utf8'));
    return {
      sourcePr: payload.pull_request?.number ?? payload.number ?? null,
      sourceSha: payload.pull_request?.merge_commit_sha ?? payload.pull_request?.head?.sha ?? payload.after ?? null,
      mergedLayer: layerFromPullRequest(payload.pull_request),
    };
  } catch {
    return {};
  }
}

function layerFromPullRequest(pullRequest) {
  const title = pullRequest?.title;
  if (!title) return null;
  const explicit = title.match(/\b(?:layer|current|task):\s*(.+)$/i)?.[1]?.trim();
  if (explicit) return explicit;
  const bracketed = title.match(/\[platform-v7\]\s*(.+)$/i)?.[1]?.trim();
  return bracketed ?? null;
}

function assertNextScopeSafe(nextAllowedFiles) {
  const unsafe = [];
  for (const file of nextAllowedFiles) {
    for (const forbidden of FORBIDDEN_ALLOWED_SCOPE) {
      if (scopeMatches(forbidden, file) || scopeMatches(file, forbidden)) {
        unsafe.push(file);
      }
    }
  }
  return unsafe;
}

function auditFileName(timestamp, sourcePr) {
  const safeTimestamp = timestamp.replace(/[:.]/g, '-');
  const prPart = sourcePr ? `pr-${sourcePr}` : 'pr-unknown';
  return `${safeTimestamp}-${prPart}.json`;
}

export async function updateAutopilotStateAfterMerge(options = {}) {
  const {
    statePath = DEFAULT_STATE_PATH,
    queuePath = DEFAULT_QUEUE_PATH,
    auditDir = DEFAULT_AUDIT_DIR,
    dryRun = true,
  } = options;

  const [state, queueText, eventDefaults] = await Promise.all([
    readJson(statePath),
    readText(queuePath),
    readGitHubEvent(),
  ]);

  const sourcePr = options.sourcePr ?? eventDefaults.sourcePr ?? (Number(process.env.PR_NUMBER) || null);
  const sourceSha = options.sourceSha ?? eventDefaults.sourceSha ?? process.env.GITHUB_SHA ?? null;
  const layerClosed = options.mergedLayer ?? eventDefaults.mergedLayer ?? state.current;
  const validation = validateAutopilotState(state, queueText);

  if (!validation.valid) {
    throw new Error(`Refusing to update invalid state: ${validation.errors.join('; ')}`);
  }

  if (layerClosed !== state.current) {
    throw new Error(`Merged layer mismatch: detected=${layerClosed} state.current=${state.current}`);
  }

  const nextAllowedFiles = validation.queue.next.allowedFiles;
  const unsafeNextScope = assertNextScopeSafe(nextAllowedFiles);
  let stopReason = null;
  if (!validation.queue.next.layer) {
    stopReason = 'queue_missing_next_layer';
  } else if (nextAllowedFiles.length === 0) {
    stopReason = 'queue_missing_next_allowed_scope';
  } else if (unsafeNextScope.length > 0) {
    stopReason = `next_layer_requires_forbidden_scope:${unsafeNextScope.join(',')}`;
  }

  const nextState = structuredClone(state);
  nextState.lastClosed = Array.from(new Set([...(state.lastClosed ?? []), state.current]));
  nextState.openPr = null;

  if (stopReason) {
    nextState.currentStatus = 'blocked';
  } else {
    nextState.current = validation.queue.next.layer;
    nextState.currentStatus = 'ready';
    nextState.allowedCurrentScope = nextAllowedFiles;
  }

  if (validation.queue.next.readiness) {
    nextState.readiness = validation.queue.next.readiness;
  }

  nextState.maturityLanguage = REQUIRED_MATURITY_LANGUAGE;

  const timestamp = new Date().toISOString();
  const auditRecord = {
    timestamp,
    sourcePr,
    sourceSha,
    layerClosed,
    nextLayer: stopReason ? null : nextState.current,
    allowedFiles: stopReason ? [] : nextState.allowedCurrentScope,
    checksSummary: {
      success: [],
      failed: [],
      skipped: [],
    },
    autoFixAttempts: 0,
    mergeDecision: dryRun ? 'dry_run' : 'merged',
    stopReason,
  };
  const auditPath = path.join(auditDir, auditFileName(timestamp, sourcePr));

  if (!dryRun) {
    await writeJson(statePath, nextState);
    await mkdir(path.resolve(auditDir), { recursive: true });
    await writeJson(auditPath, auditRecord);
  }

  return {
    dryRun,
    stateUpdated: !dryRun,
    auditPath,
    nextState,
    auditRecord,
  };
}

async function cli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await updateAutopilotStateAfterMerge(options);
  process.stdout.write(`${JSON.stringify({
    sourcePr: result.auditRecord.sourcePr,
    mergedSha: result.auditRecord.sourceSha,
    stateUpdated: result.stateUpdated,
    nextLayerSelected: Boolean(result.auditRecord.nextLayer),
    layerClosed: result.auditRecord.layerClosed,
    nextLayer: result.auditRecord.nextLayer,
    allowedFiles: result.auditRecord.allowedFiles,
    mergeGate: options.dryRun ? 'not_applicable_dry_run' : 'not_evaluated',
    auditPath: result.auditPath,
    stopReason: result.auditRecord.stopReason,
    nextState: result.nextState,
  }, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
