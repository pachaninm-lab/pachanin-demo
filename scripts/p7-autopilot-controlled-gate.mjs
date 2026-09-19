#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CRITICAL_FORBIDDEN_ZONES,
  DEFAULT_QUEUE_PATH,
  DEFAULT_STATE_PATH,
  scopeMatches,
  validateAutopilotState,
} from './p7-autopilot-state-validate.mjs';

function parseArgs(argv) {
  const options = {
    statePath: DEFAULT_STATE_PATH,
    queuePath: DEFAULT_QUEUE_PATH,
    taskPath: null,
    taskJson: null,
    outputPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--state') options.statePath = argv[++index];
    else if (arg === '--queue') options.queuePath = argv[++index];
    else if (arg === '--task-file') options.taskPath = argv[++index];
    else if (arg === '--task') options.taskJson = argv[++index];
    else if (arg === '--output') options.outputPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readJson(filePath, fallback = null) {
  if (!filePath) return fallback;
  return JSON.parse(await readFile(path.resolve(filePath), 'utf8'));
}

async function readText(filePath) {
  return readFile(path.resolve(filePath), 'utf8');
}

function normalizePath(input) {
  return String(input ?? '').trim().replace(/\\/g, '/').replace(/\/+$/g, '');
}

function asArray(value) {
  if (Array.isArray(value)) return value.map(normalizePath).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [normalizePath(value)];
  return [];
}

function forbidden(file, zones) {
  return zones.some((zone) => scopeMatches(zone, file) || scopeMatches(file, zone));
}

function allowed(file, scopes) {
  return scopes.some((scope) => scopeMatches(scope, file));
}

async function readTask(options, state) {
  if (options.taskJson) return JSON.parse(options.taskJson);
  if (options.taskPath) return readJson(options.taskPath);
  return {
    title: state.current,
    layer: state.current,
    requestedFiles: ['scripts/p7-autopilot-controlled-gate.mjs'],
    safeIntakePassed: true,
    mergeGateRequired: true,
  };
}

export async function evaluateControlledGate(options = {}) {
  const statePath = options.statePath ?? DEFAULT_STATE_PATH;
  const queuePath = options.queuePath ?? DEFAULT_QUEUE_PATH;
  const [state, queueText] = await Promise.all([readJson(statePath), readText(queuePath)]);
  const task = await readTask(options, state);
  const validation = validateAutopilotState(state, queueText);
  const stopReasons = [];

  if (!validation.valid) stopReasons.push(`state_invalid:${validation.errors.join(';')}`);
  if (state.currentStatus !== 'ready') stopReasons.push(`current_not_ready:${state.currentStatus}`);
  if (task.layer && task.layer !== state.current) stopReasons.push(`task_layer_mismatch:${task.layer}`);

  const controlled = state.controlledActions ?? { enabled: false };
  if (controlled.enabled !== true) stopReasons.push('controlled_mode_disabled');
  if (task.safeIntakePassed !== true) stopReasons.push('safe_intake_required');
  if (task.mergeGateRequired !== true) stopReasons.push('merge_gate_required');

  const zones = state.forbiddenZones ?? CRITICAL_FORBIDDEN_ZONES;
  const scopes = state.allowedCurrentScope ?? [];
  for (const file of asArray(task.requestedFiles ?? task.files)) {
    if (forbidden(file, zones)) stopReasons.push(`task_file_forbidden:${file}`);
    if (!allowed(file, scopes)) stopReasons.push(`task_file_outside_scope:${file}`);
  }

  const uniqueStopReasons = Array.from(new Set(stopReasons));
  return {
    generatedAt: new Date().toISOString(),
    decision: uniqueStopReasons.length === 0 ? 'allowed' : 'blocked',
    stopReason: uniqueStopReasons.length > 0 ? uniqueStopReasons.join(';') : null,
    controlledModeEnabled: controlled.enabled === true,
    safeIntakePassed: task.safeIntakePassed === true,
    mergeGateRequired: task.mergeGateRequired === true,
    requestedFiles: asArray(task.requestedFiles ?? task.files),
  };
}

async function cli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await evaluateControlledGate(options);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (options.outputPath) await writeFile(path.resolve(options.outputPath), output, 'utf8');
  else process.stdout.write(output);
  if (result.decision !== 'allowed') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
