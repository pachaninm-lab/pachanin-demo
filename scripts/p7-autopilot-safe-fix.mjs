#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CRITICAL_FORBIDDEN_ZONES,
  DEFAULT_STATE_PATH,
  scopeMatches,
} from './p7-autopilot-state-validate.mjs';

const MAX_AUTO_FIX_COMMITS = 2;
const MAX_RERUNS_PER_WORKFLOW = 1;
const STOP_CATEGORIES = new Set([
  'forbidden_path_failure',
  'maturity_copy_failure',
  'unknown_failure',
]);

const SAFE_CATEGORIES = new Set([
  'scope_failure',
  'typecheck_failure',
  'test_failure',
  'build_failure',
]);

function parseArgs(argv) {
  const options = {
    statePath: DEFAULT_STATE_PATH,
    reportPath: null,
    attemptsPath: null,
    candidateFiles: [],
    outputPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--state') options.statePath = argv[++index];
    else if (arg === '--report') options.reportPath = argv[++index];
    else if (arg === '--attempts') options.attemptsPath = argv[++index];
    else if (arg === '--candidate-file') options.candidateFiles.push(argv[++index]);
    else if (arg === '--output') options.outputPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readJson(filePath, fallback = null) {
  if (!filePath) return fallback;
  return JSON.parse(await readFile(path.resolve(filePath), 'utf8'));
}

function normalizePath(input) {
  return String(input ?? '').trim().replace(/\\/g, '/').replace(/\/+$/g, '');
}

function isAllowedInfra(file) {
  return [
    /^docs\/platform-v7\/autopilot\/.+/,
    /^docs\/platform-v7\/execution-queue\.md$/,
    /^scripts\/p7-autopilot-[a-z0-9-]+\.mjs$/,
    /^scripts\/p7-autopilot-guard\.sh$/,
    /^\.github\/workflows\/platform-v7-autopilot-[a-z0-9-]+\.yml$/,
    /^\.github\/workflows\/platform-v7-generated-pr-cleanup\.yml$/,
  ].some((pattern) => pattern.test(file));
}

function isForbidden(file, forbiddenZones) {
  return forbiddenZones.some((zone) => scopeMatches(zone, file) || scopeMatches(file, zone));
}

function isAllowedByState(file, state) {
  return (state.allowedCurrentScope ?? []).some((entry) => scopeMatches(entry, file));
}

function findRepeatedFailure(report, attempts) {
  const seen = new Set(attempts.failureFingerprints ?? []);
  for (const failure of report.failures ?? []) {
    const fingerprint = [
      failure.workflowName,
      failure.jobName,
      failure.failedStep,
      failure.suspectedCategory,
    ].join('|');
    if (seen.has(fingerprint)) return fingerprint;
  }
  return null;
}

function hasExternalSystemNeed(report) {
  const text = JSON.stringify(report).toLowerCase();
  return /secret|token|permission denied|billing|access denied|external system|credential|unauthorized|forbidden:/.test(text);
}

function touchesTestRemoval(report) {
  const text = JSON.stringify(report).toLowerCase();
  return /remove test|delete test|skip test|\.skip\(|only to make green|weaken guard|disable guard/.test(text);
}

export async function decideSafeFix(options = {}) {
  const [state, report, attempts] = await Promise.all([
    readJson(options.statePath ?? DEFAULT_STATE_PATH),
    readJson(options.reportPath, { failures: [] }),
    readJson(options.attemptsPath, { autoFixCommits: 0, rerunsByWorkflow: {}, failureFingerprints: [] }),
  ]);

  const candidateFiles = (options.candidateFiles ?? []).map(normalizePath).filter(Boolean);
  const forbiddenZones = state.forbiddenZones ?? CRITICAL_FORBIDDEN_ZONES;
  const stopReasons = [];

  if ((attempts.autoFixCommits ?? 0) >= MAX_AUTO_FIX_COMMITS) {
    stopReasons.push('auto_fix_commit_limit_reached');
  }

  for (const [workflow, count] of Object.entries(attempts.rerunsByWorkflow ?? {})) {
    if (count >= MAX_RERUNS_PER_WORKFLOW) {
      stopReasons.push(`rerun_limit_reached:${workflow}`);
    }
  }

  const repeated = findRepeatedFailure(report, attempts);
  if (repeated) stopReasons.push(`same_failure_repeated:${repeated}`);
  if (hasExternalSystemNeed(report)) stopReasons.push('requires_secret_token_access_billing_or_external_system');
  if (touchesTestRemoval(report)) stopReasons.push('would_remove_tests_or_weaken_guard');

  for (const failure of report.failures ?? []) {
    if (STOP_CATEGORIES.has(failure.suspectedCategory)) {
      stopReasons.push(`unsafe_failure_category:${failure.suspectedCategory}`);
    } else if (!SAFE_CATEGORIES.has(failure.suspectedCategory) && failure.suspectedCategory !== 'flaky_infra_failure') {
      stopReasons.push(`unknown_failure_category:${failure.suspectedCategory}`);
    }
  }

  for (const file of candidateFiles) {
    if (isForbidden(file, forbiddenZones)) {
      stopReasons.push(`candidate_file_forbidden:${file}`);
    }
    if (!isAllowedByState(file, state) && !isAllowedInfra(file)) {
      stopReasons.push(`candidate_file_outside_allowed_scope:${file}`);
    }
  }

  const uniqueStopReasons = Array.from(new Set(stopReasons));
  const decision = uniqueStopReasons.length === 0 ? 'safe_fix_allowed' : 'blocked';
  return {
    generatedAt: new Date().toISOString(),
    decision,
    stopReason: uniqueStopReasons.length > 0 ? uniqueStopReasons.join(';') : null,
    maxAutoFixCommits: MAX_AUTO_FIX_COMMITS,
    maxRerunsPerWorkflow: MAX_RERUNS_PER_WORKFLOW,
    candidateFiles,
    allowedCurrentScope: state.allowedCurrentScope ?? [],
  };
}

async function cli() {
  const options = parseArgs(process.argv.slice(2));
  const decision = await decideSafeFix(options);
  const output = `${JSON.stringify(decision, null, 2)}\n`;
  if (options.outputPath) {
    await writeFile(path.resolve(options.outputPath), output, 'utf8');
  } else {
    process.stdout.write(output);
  }
  if (decision.decision !== 'safe_fix_allowed') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
