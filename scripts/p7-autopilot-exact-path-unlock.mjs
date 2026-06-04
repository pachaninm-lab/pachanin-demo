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
    requestPath: null,
    requestJson: null,
    outputPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--state') options.statePath = argv[++index];
    else if (arg === '--queue') options.queuePath = argv[++index];
    else if (arg === '--request-file') options.requestPath = argv[++index];
    else if (arg === '--request') options.requestJson = argv[++index];
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

function isForbidden(file, zones) {
  return zones.some((zone) => scopeMatches(zone, file) || scopeMatches(file, zone));
}

function isCurrentlyAllowed(file, scopes) {
  return scopes.some((scope) => scopeMatches(scope, file));
}

async function readRequest(options) {
  if (options.requestJson) return JSON.parse(options.requestJson);
  if (options.requestPath) return readJson(options.requestPath);
  return {
    title: 'Autopilot Exact Path Unlock',
    proposedAllowedFiles: [
      'scripts/p7-autopilot-exact-path-unlock.mjs',
      'docs/platform-v7/autopilot/autopilot-state.json',
      'docs/platform-v7/execution-queue.md',
    ],
  };
}

export async function buildExactPathPatch(options = {}) {
  const statePath = options.statePath ?? DEFAULT_STATE_PATH;
  const queuePath = options.queuePath ?? DEFAULT_QUEUE_PATH;
  const [state, queueText, request] = await Promise.all([
    readJson(statePath),
    readText(queuePath),
    readRequest(options),
  ]);
  const validation = validateAutopilotState(state, queueText);
  const proposedAllowedFiles = asArray(request.proposedAllowedFiles ?? request.allowedFiles ?? request.files);
  const forbiddenZones = state.forbiddenZones ?? CRITICAL_FORBIDDEN_ZONES;
  const accepted = [];
  const blocked = [];

  for (const file of proposedAllowedFiles) {
    if (isForbidden(file, forbiddenZones)) {
      blocked.push({ path: file, reason: 'restricted_path' });
    } else if (!isCurrentlyAllowed(file, state.allowedCurrentScope ?? [])) {
      blocked.push({ path: file, reason: 'not_allowed_by_current_scope' });
    } else {
      accepted.push(file);
    }
  }

  const nextStatePatch = {
    allowedCurrentScope: Array.from(new Set([...(state.allowedCurrentScope ?? []), ...accepted])),
  };

  return {
    generatedAt: new Date().toISOString(),
    decision: validation.valid && blocked.length === 0 ? 'patch_proposed' : 'patch_blocked',
    stopReason: validation.valid ? (blocked.length > 0 ? 'proposed_paths_blocked' : null) : `state_invalid:${validation.errors.join(';')}`,
    accepted,
    blocked,
    nextStatePatch,
    mergeGateRequired: true,
  };
}

async function cli() {
  const options = parseArgs(process.argv.slice(2));
  const result = await buildExactPathPatch(options);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (options.outputPath) await writeFile(path.resolve(options.outputPath), output, 'utf8');
  else process.stdout.write(output);
  if (result.decision !== 'patch_proposed') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
