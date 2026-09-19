#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CRITICAL_FORBIDDEN_ZONES,
  DEFAULT_QUEUE_PATH,
  DEFAULT_STATE_PATH,
  parseQueue,
  scopeMatches,
  validateAutopilotState,
} from './p7-autopilot-state-validate.mjs';

const DEFAULT_BRANCH_PREFIX = 'platform-v7';

function normalizePath(input) {
  return String(input ?? '').trim().replace(/\\/g, '/').replace(/\/+$/g, '');
}

function slugify(input) {
  return String(input ?? '')
    .toLowerCase()
    .replace(/—/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.resolve(relativePath), 'utf8'));
}

async function readText(relativePath) {
  return readFile(path.resolve(relativePath), 'utf8');
}

function parseArgs(argv) {
  const options = {
    statePath: DEFAULT_STATE_PATH,
    queuePath: DEFAULT_QUEUE_PATH,
    issueBodyPath: null,
    issueBody: '',
    branchPrefix: DEFAULT_BRANCH_PREFIX,
    noGitBranches: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--state') options.statePath = argv[++index];
    else if (arg === '--queue') options.queuePath = argv[++index];
    else if (arg === '--issue-body-file') options.issueBodyPath = argv[++index];
    else if (arg === '--issue-body') options.issueBody = argv[++index];
    else if (arg === '--branch-prefix') options.branchPrefix = argv[++index];
    else if (arg === '--no-git-branches') options.noGitBranches = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readIssueBody(options) {
  if (options.issueBodyPath) return readText(options.issueBodyPath);
  return options.issueBody;
}

function parseCurrentCriteria(queueText) {
  const queue = parseSection(queueText, 'CURRENT CRITERIA');
  return queue
    .map((line) => line.match(/^-\s+(.+)$/)?.[1]?.trim())
    .filter(Boolean);
}

function parseSection(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${heading}:`);
  if (start === -1) return [];

  const section = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Z][A-Z\s]+:\s*$/.test(line.trim())) break;
    section.push(line);
  }
  return section;
}

function issueMentionsLayer(issueBody, layerName) {
  if (!issueBody.trim()) return true;
  const normalizedIssue = issueBody.toLowerCase();
  const normalizedLayer = layerName.toLowerCase();
  if (normalizedIssue.includes(normalizedLayer)) return true;

  if (normalizedLayer.includes('selector')) {
    return /\bPR\s+B\b/i.test(issueBody) && /selector/i.test(issueBody);
  }
  if (normalizedLayer.includes('analyzer')) {
    return /\bPR\s+C\b/i.test(issueBody) && /analy[sz]er/i.test(issueBody);
  }
  if (normalizedLayer.includes('merge gate')) {
    return /\bPR\s+D\b/i.test(issueBody) && /merge gate/i.test(issueBody);
  }
  if (normalizedLayer.includes('dry-run')) {
    return /\bPR\s+E\b/i.test(issueBody) && /dry-run/i.test(issueBody);
  }

  return false;
}

function collectRiskNotes(issueBody) {
  const notes = ['maturity must remain controlled-pilot / pre-integration'];
  if (/forbidden scope/i.test(issueBody)) {
    notes.push('stop if the selected layer requires forbidden scope');
  }
  if (/red\/dirty\/unmergeable/i.test(issueBody) || /unmergeable/i.test(issueBody)) {
    notes.push('do not merge red, dirty, or unmergeable pull requests');
  }
  if (/fake-live/i.test(issueBody) || /fake live/i.test(issueBody)) {
    notes.push('do not introduce fake-live claims');
  }
  return notes;
}

function unsafeAllowedFiles(allowedFiles, forbiddenZones) {
  const unsafe = [];
  for (const file of allowedFiles) {
    for (const forbidden of forbiddenZones) {
      if (scopeMatches(forbidden, file) || scopeMatches(file, forbidden)) {
        unsafe.push(file);
      }
    }
  }
  return unsafe;
}

function existingBranches() {
  try {
    const output = execFileSync(
      'git',
      ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin'],
      { encoding: 'utf8' },
    );
    return new Set(output.split(/\r?\n/).map((line) => line.replace(/^origin\//, '').trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function deterministicBranchName(layerName, options) {
  const slug = slugify(layerName);
  const base = `${slug || 'layer'}-`;
  const prefix = `${options.branchPrefix}-${base}`;
  const branches = options.noGitBranches ? new Set() : existingBranches();

  for (let index = 1; index <= 999; index += 1) {
    const candidate = `${prefix}${String(index).padStart(3, '0')}`;
    if (!branches.has(candidate)) return candidate;
  }

  return `${prefix}blocked`;
}

function stop(reason, state = {}, queue = null) {
  return {
    layerName: null,
    branchName: null,
    allowedFiles: [],
    forbiddenFiles: Array.isArray(state.forbiddenZones) ? state.forbiddenZones : CRITICAL_FORBIDDEN_ZONES,
    successCriteria: [],
    riskNotes: [],
    stopReason: reason,
    current: state.current ?? queue?.current ?? null,
  };
}

export async function selectNextLayer(options = {}) {
  const statePath = options.statePath ?? DEFAULT_STATE_PATH;
  const queuePath = options.queuePath ?? DEFAULT_QUEUE_PATH;
  const [state, queueText, issueBody] = await Promise.all([
    readJson(statePath),
    readText(queuePath),
    readIssueBody(options),
  ]);
  const queue = parseQueue(queueText);
  const validation = validateAutopilotState(state, queueText);

  if (!validation.valid) {
    const forbiddenScopeErrors = validation.errors
      .map((error) => error.match(/^allowedCurrentScope includes forbidden path:\s*(.+)$/)?.[1])
      .filter(Boolean);
    if (forbiddenScopeErrors.length > 0) {
      return stop(`forbidden_scope_required:${forbiddenScopeErrors.join(',')}`, state, queue);
    }
    return stop(`state_queue_conflict:${validation.errors.join(';')}`, state, queue);
  }
  if (state.status !== 'active') {
    return stop(`state_not_active:${state.status}`, state, queue);
  }
  if (state.currentStatus !== 'ready') {
    return stop(`current_not_ready:${state.currentStatus}`, state, queue);
  }
  if (state.openPr) {
    return stop(`open_pr_exists:${state.openPr}`, state, queue);
  }
  if ((state.lastClosed ?? []).includes(state.current)) {
    return stop(`current_already_closed:${state.current}`, state, queue);
  }
  if (!issueMentionsLayer(issueBody, state.current)) {
    return stop(`issue_body_does_not_authorize_current_layer:${state.current}`, state, queue);
  }

  const allowedFiles = (state.allowedCurrentScope ?? []).map(normalizePath).filter(Boolean);
  if (allowedFiles.length === 0) {
    return stop('no_allowed_current_scope', state, queue);
  }

  const forbiddenFiles = (state.forbiddenZones ?? CRITICAL_FORBIDDEN_ZONES).map(normalizePath).filter(Boolean);
  const unsafe = unsafeAllowedFiles(allowedFiles, forbiddenFiles);
  if (unsafe.length > 0) {
    return {
      ...stop(`forbidden_scope_required:${unsafe.join(',')}`, state, queue),
      forbiddenFiles,
    };
  }

  return {
    layerName: state.current,
    branchName: deterministicBranchName(state.current, options),
    allowedFiles,
    forbiddenFiles,
    successCriteria: parseCurrentCriteria(queueText),
    riskNotes: collectRiskNotes(issueBody),
    stopReason: null,
  };
}

async function cli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await selectNextLayer(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.stopReason) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
