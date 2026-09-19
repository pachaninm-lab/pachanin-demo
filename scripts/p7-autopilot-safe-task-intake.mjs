#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CRITICAL_FORBIDDEN_ZONES,
  DEFAULT_QUEUE_PATH,
  DEFAULT_STATE_PATH,
  scopeMatches,
  validateAutopilotState,
} from './p7-autopilot-state-validate.mjs';

const DEFAULT_TASK = {
  title: 'Autopilot Safe Task Intake',
  layer: 'Autopilot Safe Task Intake',
  allowedFiles: [
    'docs/platform-v7/autopilot/**',
    'docs/platform-v7/execution-queue.md',
    'scripts/p7-autopilot-*.mjs',
  ],
  requestedFiles: [
    'scripts/p7-autopilot-safe-task-intake.mjs',
    'docs/platform-v7/autopilot/autopilot-state.json',
    'docs/platform-v7/execution-queue.md',
  ],
  successCriteria: [
    'selected task has explicit scope',
    'selected task stays inside state scope',
    'unsafe scope returns blocked state',
  ],
};

function parseArgs(argv) {
  const options = {
    statePath: DEFAULT_STATE_PATH,
    queuePath: DEFAULT_QUEUE_PATH,
    taskPath: null,
    taskJson: null,
    branchPrefix: 'codex',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--state') options.statePath = argv[++index];
    else if (arg === '--queue') options.queuePath = argv[++index];
    else if (arg === '--task-file') options.taskPath = argv[++index];
    else if (arg === '--task') options.taskJson = argv[++index];
    else if (arg === '--branch-prefix') options.branchPrefix = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.resolve(relativePath), 'utf8'));
}

async function readText(relativePath) {
  return readFile(path.resolve(relativePath), 'utf8');
}

async function readTask(options) {
  if (options.taskJson) return JSON.parse(options.taskJson);
  if (options.taskPath) return readJson(options.taskPath);
  return DEFAULT_TASK;
}

function normalizePath(input) {
  return String(input ?? '').trim().replace(/\\/g, '/').replace(/\/+$/g, '');
}

function slugify(input) {
  return String(input ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

function taskAllowedFiles(task) {
  return toArray(task.allowedFiles ?? task.allowedScope).map(normalizePath).filter(Boolean);
}

function taskRequestedFiles(task) {
  return toArray(task.requestedFiles ?? task.files ?? task.changedFiles).map(normalizePath).filter(Boolean);
}

function matchesAny(scopes, file) {
  return scopes.some((scope) => scopeMatches(scope, file));
}

function scopeHitsForbidden(scope, forbiddenZones) {
  return forbiddenZones.some((zone) => scopeMatches(zone, scope) || scopeMatches(scope, zone));
}

function buildStop(reason, state, task, forbiddenFiles) {
  return {
    decision: 'blocked',
    stopReason: reason,
    layerName: state.current ?? null,
    taskTitle: task.title ?? null,
    branchPlan: null,
    allowedFiles: [],
    requestedFiles: taskRequestedFiles(task),
    forbiddenFiles,
  };
}

export async function intakeSafeTask(options = {}) {
  const statePath = options.statePath ?? DEFAULT_STATE_PATH;
  const queuePath = options.queuePath ?? DEFAULT_QUEUE_PATH;
  const [state, queueText, task] = await Promise.all([
    readJson(statePath),
    readText(queuePath),
    readTask(options),
  ]);

  const validation = validateAutopilotState(state, queueText);
  const forbiddenFiles = (state.forbiddenZones ?? CRITICAL_FORBIDDEN_ZONES).map(normalizePath).filter(Boolean);
  if (!validation.valid) return buildStop(`state_invalid:${validation.errors.join(';')}`, state, task, forbiddenFiles);
  if (state.status !== 'active') return buildStop(`state_not_active:${state.status}`, state, task, forbiddenFiles);
  if (state.currentStatus !== 'ready') return buildStop(`current_not_ready:${state.currentStatus}`, state, task, forbiddenFiles);
  if (state.openPr) return buildStop(`open_pr_exists:${state.openPr}`, state, task, forbiddenFiles);

  const taskLayer = String(task.layer ?? task.current ?? task.title ?? '').trim();
  if (taskLayer !== state.current) return buildStop(`task_layer_mismatch:${taskLayer || 'missing'}`, state, task, forbiddenFiles);

  const allowedFiles = taskAllowedFiles(task);
  if (allowedFiles.length === 0) return buildStop('task_missing_allowed_scope', state, task, forbiddenFiles);

  for (const scope of allowedFiles) {
    if (scopeHitsForbidden(scope, forbiddenFiles)) return buildStop(`task_allowed_scope_forbidden:${scope}`, state, task, forbiddenFiles);
    if (!matchesAny(state.allowedCurrentScope ?? [], scope)) return buildStop(`task_allowed_scope_outside_state:${scope}`, state, task, forbiddenFiles);
  }

  const requestedFiles = taskRequestedFiles(task);
  if (requestedFiles.length === 0) return buildStop('task_missing_requested_files', state, task, forbiddenFiles);

  for (const file of requestedFiles) {
    if (scopeHitsForbidden(file, forbiddenFiles)) return buildStop(`task_file_forbidden:${file}`, state, task, forbiddenFiles);
    if (!matchesAny(state.allowedCurrentScope ?? [], file)) return buildStop(`task_file_outside_state:${file}`, state, task, forbiddenFiles);
    if (!matchesAny(allowedFiles, file)) return buildStop(`task_file_outside_task_scope:${file}`, state, task, forbiddenFiles);
  }

  const branchName = `${options.branchPrefix ?? 'codex'}/${slugify(`platform-v7 ${state.current}`)}`;
  return {
    decision: 'allowed',
    stopReason: null,
    layerName: state.current,
    taskTitle: task.title ?? state.current,
    branchPlan: {
      branchName,
      baseRef: 'main',
      files: requestedFiles,
      commitStyle: 'narrow-reviewable-layer',
      mergeGateRequired: true,
    },
    allowedFiles,
    requestedFiles,
    forbiddenFiles,
    successCriteria: toArray(task.successCriteria ?? validation.queue?.next?.successCriteria),
  };
}

async function cli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await intakeSafeTask(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.decision !== 'allowed') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
