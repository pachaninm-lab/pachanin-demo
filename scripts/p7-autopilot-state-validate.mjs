#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_STATE_PATH = 'docs/platform-v7/autopilot/autopilot-state.json';
export const DEFAULT_QUEUE_PATH = 'docs/platform-v7/execution-queue.md';

export const CRITICAL_FORBIDDEN_ZONES = [
  'apps/landing',
  'apps/web/app/platform-v7',
  'apps/web/components/platform-v7',
  'apps/web/components/v7r',
  'apps/web/lib/platform-v7',
  'apps/web/app/api',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
];

export const REQUIRED_MATURITY_LANGUAGE = ['platform-temporarily-without-external-integrations'];
export const FORBIDDEN_ALLOWED_SCOPE = ['apps/landing', 'package.json', 'package-lock.json', 'pnpm-lock.yaml'];
export const REQUIRED_FIELDS = [
  'project',
  'status',
  'current',
  'currentStatus',
  'openPr',
  'lastClosed',
  'allowedCurrentScope',
  'forbiddenZones',
  'maturityLanguage',
  'forbiddenClaims',
];

const VALID_CURRENT_STATUSES = new Set(['ready', 'in_progress', 'blocked', 'merged']);

function normalizePath(input) {
  return String(input ?? '').trim().replace(/\\/g, '/').replace(/\/+$/g, '');
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function globToRegExp(glob) {
  const normalized = normalizePath(glob);
  let pattern = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];
    if (character === '*' && next === '*') {
      pattern += '.*';
      index += 1;
    } else if (character === '*') {
      pattern += '[^/]*';
    } else {
      pattern += escapeRegExp(character);
    }
  }
  return new RegExp(`^${pattern}$`);
}

export function scopeMatches(allowedEntry, candidate) {
  const allowed = normalizePath(allowedEntry);
  const file = normalizePath(candidate);
  if (!allowed || !file) return false;
  if (allowed === file) return true;
  if (allowed.includes('*')) return globToRegExp(allowed).test(file);
  return file.startsWith(`${allowed}/`);
}

export function parseQueue(queueText) {
  const lines = queueText.split(/\r?\n/);
  const current = queueText.match(/^CURRENT:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const sections = new Map();
  let activeSection = null;

  for (const line of lines) {
    const heading = line.match(/^([A-Z][A-Z\s]+):\s*$/);
    if (heading) {
      activeSection = heading[1].trim();
      sections.set(activeSection, []);
      continue;
    }

    if (activeSection) {
      sections.get(activeSection).push(line);
    }
  }

  const done = [];
  for (const line of sections.get('DONE') ?? []) {
    const item = line.match(/^-\s+(.+)$/);
    if (item) done.push(item[1].trim());
  }

  const currentAllowedFiles = [];
  for (const line of sections.get('CURRENT ALLOWED') ?? []) {
    const item = line.match(/^-\s+(.+)$/);
    if (item) currentAllowedFiles.push(item[1].trim());
  }

  const nextLines = sections.get('NEXT') ?? [];
  const nextLayer = nextLines
    .map((line) => line.match(/^-\s+Layer:\s*(.+)$/)?.[1]?.trim())
    .find(Boolean) ?? null;
  const nextAllowedFiles = parseIndentedBulletsAfter(nextLines, /^-\s+Allowed files?:\s*$/i);
  const nextSuccessCriteria = parseIndentedBulletsAfter(nextLines, /^-\s+Success criteria:\s*$/i);
  const readiness = nextLines
    .map((line) => line.match(/Readiness\s+(?:remains|becomes|changes to)\s+(.+?)\.\s*$/i)?.[1]?.trim())
    .find(Boolean) ?? null;

  return {
    current,
    currentAllowedFiles,
    done,
    next: {
      layer: nextLayer,
      allowedFiles: nextAllowedFiles,
      successCriteria: nextSuccessCriteria,
      readiness,
    },
  };
}

function parseIndentedBulletsAfter(lines, marker) {
  const start = lines.findIndex((line) => marker.test(line.trim()));
  if (start === -1) return [];

  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^-\s+\S/.test(line) && !/^\s+-\s+/.test(line)) break;
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item) values.push(item[1].trim());
  }
  return values;
}

async function readJson(relativePath) {
  const text = await readFile(path.resolve(relativePath), 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${relativePath}: invalid JSON (${error.message})`);
  }
}

async function readText(relativePath) {
  return readFile(path.resolve(relativePath), 'utf8');
}

function assertArray(state, field, errors) {
  if (!Array.isArray(state[field])) {
    errors.push(`${field} must be an array`);
  }
}

function hasCriticalForbiddenZone(forbiddenZones, criticalPath) {
  return forbiddenZones.some((zone) => {
    const normalized = normalizePath(zone);
    return normalized === criticalPath || criticalPath.startsWith(`${normalized}/`);
  });
}

function isForbiddenAllowedScope(scopeEntry) {
  const entry = normalizePath(scopeEntry);
  return FORBIDDEN_ALLOWED_SCOPE.some((forbidden) => {
    if (entry === forbidden) return true;
    if (entry.startsWith(`${forbidden}/`)) return true;
    if (entry.includes('*') && scopeMatches(entry, forbidden)) return true;
    return false;
  });
}

export function validateAutopilotState(state, queueText) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(state, field)) errors.push(`missing required field: ${field}`);
  }

  if (state.project !== 'platform-v7') errors.push('project must be platform-v7');
  if (!VALID_CURRENT_STATUSES.has(state.currentStatus)) {
    errors.push('currentStatus must be ready, in_progress, blocked, or merged');
  }

  for (const field of ['lastClosed', 'allowedCurrentScope', 'forbiddenZones', 'maturityLanguage', 'forbiddenClaims']) {
    assertArray(state, field, errors);
  }

  const lastClosed = Array.isArray(state.lastClosed) ? state.lastClosed : [];
  const allowedCurrentScope = Array.isArray(state.allowedCurrentScope) ? state.allowedCurrentScope : [];
  const forbiddenZones = Array.isArray(state.forbiddenZones) ? state.forbiddenZones.map(normalizePath) : [];
  const maturityLanguage = Array.isArray(state.maturityLanguage) ? state.maturityLanguage : [];

  if (state.current && lastClosed.includes(state.current)) {
    errors.push(`current layer is already in lastClosed: ${state.current}`);
  }

  if (state.currentStatus === 'ready' && allowedCurrentScope.length === 0) {
    errors.push('allowedCurrentScope must not be empty when currentStatus=ready');
  }

  for (const criticalPath of CRITICAL_FORBIDDEN_ZONES) {
    if (!hasCriticalForbiddenZone(forbiddenZones, criticalPath)) {
      errors.push(`forbiddenZones missing critical path: ${criticalPath}`);
    }
  }

  for (const required of REQUIRED_MATURITY_LANGUAGE) {
    if (!maturityLanguage.includes(required)) {
      errors.push(`maturityLanguage missing ${required}`);
    }
  }

  for (const scopeEntry of allowedCurrentScope) {
    if (isForbiddenAllowedScope(scopeEntry)) {
      errors.push(`allowedCurrentScope includes forbidden path: ${scopeEntry}`);
    }
  }

  const queue = parseQueue(queueText);
  if (!queue.current) {
    errors.push('queue missing CURRENT');
  } else if (state.current !== queue.current) {
    errors.push(`queue/state current conflict: state=${state.current} queue=${queue.current}`);
  }

  if (queue.done.includes(state.current)) {
    errors.push(`queue DONE contains current layer: ${state.current}`);
  }

  for (const queueAllowedFile of queue.currentAllowedFiles) {
    const matched = allowedCurrentScope.some((scopeEntry) => scopeMatches(scopeEntry, queueAllowedFile));
    if (!matched) {
      errors.push(`queue CURRENT ALLOWED file is outside state allowedCurrentScope: ${queueAllowedFile}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    queue,
  };
}

export async function validateAutopilotStateFiles({
  statePath = DEFAULT_STATE_PATH,
  queuePath = DEFAULT_QUEUE_PATH,
} = {}) {
  const state = await readJson(statePath);
  const queueText = await readText(queuePath);
  return {
    state,
    ...validateAutopilotState(state, queueText),
  };
}

async function cli() {
  const result = await validateAutopilotStateFiles();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
