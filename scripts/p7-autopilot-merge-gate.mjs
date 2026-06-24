#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CRITICAL_FORBIDDEN_ZONES,
  DEFAULT_QUEUE_PATH,
  DEFAULT_STATE_PATH,
  scopeMatches,
  validateAutopilotState,
} from './p7-autopilot-state-validate.mjs';

const DEFAULT_AUDIT_DIR = 'docs/platform-v7/autopilot/audit';
const FORBIDDEN_CLAIMS = [
  'production-ready',
  'fully live',
  'fully integrated',
  'platform guarantees payment',
  'платформа гарантирует оплату',
  'платформа сама выпускает деньги',
  'банк подключён',
  'ФГИС подключён',
  'ЭДО подключён',
];

function parseArgs(argv) {
  const options = {
    statePath: DEFAULT_STATE_PATH,
    queuePath: DEFAULT_QUEUE_PATH,
    prPath: null,
    statusesPath: null,
    workflowsPath: null,
    changedFilesPath: null,
    diffTextPath: null,
    auditDir: DEFAULT_AUDIT_DIR,
    writeAudit: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--state') options.statePath = argv[++index];
    else if (arg === '--queue') options.queuePath = argv[++index];
    else if (arg === '--pr') options.prPath = argv[++index];
    else if (arg === '--statuses') options.statusesPath = argv[++index];
    else if (arg === '--workflows') options.workflowsPath = argv[++index];
    else if (arg === '--changed-files') options.changedFilesPath = argv[++index];
    else if (arg === '--diff-text') options.diffTextPath = argv[++index];
    else if (arg === '--audit-dir') options.auditDir = argv[++index];
    else if (arg === '--write-audit') options.writeAudit = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readJson(filePath, fallback) {
  if (!filePath) return fallback;
  return JSON.parse(await readFile(path.resolve(filePath), 'utf8'));
}

async function readText(filePath, fallback = '') {
  if (!filePath) return fallback;
  return readFile(path.resolve(filePath), 'utf8');
}

function normalizePath(input) {
  return String(input ?? '').trim().replace(/\\/g, '/').replace(/\/+$/g, '');
}

function asArray(input, key) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.[key])) return input[key];
  if (Array.isArray(input?.files)) return input.files;
  return [];
}

function isForbidden(file, forbiddenZones) {
  return forbiddenZones.some((zone) => scopeMatches(zone, file) || scopeMatches(file, zone));
}

function isAllowed(file, state) {
  return (state.allowedCurrentScope ?? []).some((scope) => scopeMatches(scope, file));
}

function statusFailures(statusesInput) {
  return asArray(statusesInput, 'statuses')
    .filter((status) => String(status.state ?? status.conclusion ?? '').toLowerCase() !== 'success')
    .map((status) => `${status.context ?? status.name ?? 'status'}:${status.state ?? status.conclusion ?? 'unknown'}`);
}

function workflowFailures(workflowsInput) {
  return asArray(workflowsInput, 'workflow_runs').flatMap((run) => {
    const status = String(run.status ?? '').toLowerCase();
    const conclusion = String(run.conclusion ?? '').toLowerCase();
    if (status !== 'completed') return [`${run.name ?? 'workflow'}:${status || 'pending'}`];
    if (conclusion === 'success') return [];
    if (conclusion === 'skipped') return [];
    return [`${run.name ?? 'workflow'}:${conclusion || 'unknown'}`];
  });
}

function lineIsClaimDenylistEntry(line, claim) {
  const stripped = line
    .replace(/^\+/, '')
    .trim()
    .replace(/,$/, '')
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase();
  return stripped === claim.toLowerCase();
}

function fakeLiveClaims(diffText) {
  const hits = new Set();
  for (const rawLine of diffText.split(/\r?\n/)) {
    if (!rawLine.startsWith('+') || rawLine.startsWith('+++')) continue;
    const lowered = rawLine.toLowerCase();
    for (const claim of FORBIDDEN_CLAIMS) {
      const normalizedClaim = claim.toLowerCase();
      if (!lowered.includes(normalizedClaim)) continue;
      if (lineIsClaimDenylistEntry(rawLine, claim)) continue;
      if (/(no|not|do not|forbidden|запрещ|без)\s[^.\n]*$/i.test(lowered.slice(0, lowered.indexOf(normalizedClaim)))) continue;
      hits.add(claim);
    }
  }
  return Array.from(hits);
}

function buildAuditRecord({ pr, changedFiles, statusFailuresList, workflowFailuresList, decision, stopReason }) {
  return {
    timestamp: new Date().toISOString(),
    sourcePr: pr.number ?? pr.pr_number ?? null,
    sourceSha: pr.head_sha ?? pr.head?.sha ?? null,
    layerClosed: null,
    nextLayer: null,
    allowedFiles: changedFiles,
    checksSummary: {
      success: [],
      failed: [...statusFailuresList, ...workflowFailuresList],
      skipped: [],
    },
    autoFixAttempts: 0,
    mergeDecision: decision === 'allowed' ? 'allowed' : 'blocked',
    stopReason,
  };
}

export async function evaluateMergeGate(options = {}) {
  const [state, queueText, pr, statusesInput, workflowsInput, changedFilesInput, diffText] = await Promise.all([
    readJson(options.statePath ?? DEFAULT_STATE_PATH),
    readText(options.queuePath ?? DEFAULT_QUEUE_PATH),
    readJson(options.prPath, {}),
    readJson(options.statusesPath, { statuses: [] }),
    readJson(options.workflowsPath, { workflow_runs: [] }),
    readJson(options.changedFilesPath, []),
    readText(options.diffTextPath, ''),
  ]);

  const reasons = [];
  const validation = validateAutopilotState(state, queueText);
  if (!validation.valid) reasons.push(`state_validator_failed:${validation.errors.join(';')}`);

  if (!options.dryRun && !options.statusesPath && !options.workflowsPath) reasons.push('missing_check_inputs');
  if (pr.draft === true) reasons.push('pr_is_draft');
  if (pr.mergeable !== true) reasons.push(`mergeable_not_true:${pr.mergeable}`);

  const changedFiles = asArray(changedFilesInput, 'files')
    .map((file) => normalizePath(typeof file === 'string' ? file : file.filename))
    .filter(Boolean);
  const forbiddenZones = state.forbiddenZones ?? CRITICAL_FORBIDDEN_ZONES;

  for (const file of changedFiles) {
    if (isForbidden(file, forbiddenZones)) reasons.push(`forbidden_file_changed:${file}`);
    if (!isAllowed(file, state)) reasons.push(`file_outside_allowed_scope:${file}`);
  }

  const statusFailuresList = statusFailures(statusesInput);
  if (statusFailuresList.length > 0) reasons.push(`status_not_green:${statusFailuresList.join(',')}`);

  const workflowFailuresList = workflowFailures(workflowsInput);
  if (workflowFailuresList.length > 0) reasons.push(`workflow_not_green:${workflowFailuresList.join(',')}`);

  const claims = fakeLiveClaims(diffText);
  if (claims.length > 0) reasons.push(`forbidden_claims:${claims.join(',')}`);

  const uniqueReasons = Array.from(new Set(reasons));
  const decision = uniqueReasons.length === 0 ? 'allowed' : 'blocked';
  const stopReason = uniqueReasons.length > 0 ? uniqueReasons.join(';') : null;
  const auditRecord = buildAuditRecord({
    pr,
    changedFiles,
    statusFailuresList,
    workflowFailuresList,
    decision,
    stopReason,
  });

  if (options.writeAudit) {
    await mkdir(path.resolve(options.auditDir ?? DEFAULT_AUDIT_DIR), { recursive: true });
    const prPart = auditRecord.sourcePr ? `pr-${auditRecord.sourcePr}` : 'pr-unknown';
    const safeTimestamp = auditRecord.timestamp.replace(/[:.]/g, '-');
    await writeFile(
      path.resolve(options.auditDir ?? DEFAULT_AUDIT_DIR, `${safeTimestamp}-${prPart}-merge-gate.json`),
      `${JSON.stringify(auditRecord, null, 2)}\n`,
      'utf8',
    );
  }

  return {
    decision,
    stopReason,
    changedFiles,
    auditRecord,
  };
}

async function cli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await evaluateMergeGate(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.decision !== 'allowed') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
