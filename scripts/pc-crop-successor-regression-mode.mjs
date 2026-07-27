#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODE_SCHEMA = 'pc-crop.successor-regression-mode.v1';
const EXACT_SCOPE = 'EXACT_SCOPE';
const SUCCESSOR_REGRESSION = 'SUCCESSOR_REGRESSION';

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&');
}

export function globMatches(pattern, candidate) {
  const normalizedPattern = pattern.replaceAll('\\', '/');
  const normalizedCandidate = candidate.replaceAll('\\', '/');
  const placeholder = '\u0000';
  const regex = escapeRegex(normalizedPattern)
    .replaceAll('**', placeholder)
    .replaceAll('*', '[^/]*')
    .replaceAll(placeholder, '.*');
  return new RegExp(`^${regex}$`, 'u').test(normalizedCandidate);
}

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(directory, entry.name));
}

function readLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateScope(scope, filePath) {
  if (
    scope?.schemaVersion !== 'platform-v7.concurrent-scope.v1'
    || typeof scope.branch !== 'string'
    || scope.branch.length < 3
    || scope.status !== 'active'
    || !Number.isInteger(scope.issue)
    || !Array.isArray(scope.allowedPaths)
    || scope.allowedPaths.length === 0
    || scope.operationalStatus !== 'NOT_ATTESTED'
    || scope.productionHosting !== 'REG_RU_VPS_ONLY'
  ) {
    throw new Error(`invalid active successor scope: ${filePath}`);
  }
}

export function determineAcceptanceMode({
  slice,
  eventName,
  headBranch,
  ownScope,
  changedFiles,
  outOfScopeFiles,
  successorScopes,
}) {
  if (!slice || !eventName || !headBranch) {
    throw new Error('slice, eventName and headBranch are required');
  }
  if (outOfScopeFiles.length === 0) {
    return {
      schemaVersion: MODE_SCHEMA,
      slice,
      mode: EXACT_SCOPE,
      eventName,
      headBranch,
      ownScopeBranch: ownScope.branch,
      successorScopeFile: null,
      successorIssue: null,
      changedFileCount: changedFiles.length,
      outOfScopeCount: 0,
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
    };
  }

  if (headBranch === ownScope.branch) {
    throw new Error(
      `${slice} exact slice branch contains out-of-scope files: ${outOfScopeFiles.join(', ')}`,
    );
  }

  if (eventName === 'push' && headBranch === 'main') {
    return {
      schemaVersion: MODE_SCHEMA,
      slice,
      mode: SUCCESSOR_REGRESSION,
      eventName,
      headBranch,
      ownScopeBranch: ownScope.branch,
      successorScopeFile: null,
      successorIssue: null,
      changedFileCount: changedFiles.length,
      outOfScopeCount: outOfScopeFiles.length,
      operationalStatus: 'NOT_ATTESTED',
      productionHosting: 'REG_RU_VPS_ONLY',
    };
  }

  const matching = successorScopes.filter(({ scope }) => scope.branch === headBranch);
  if (matching.length !== 1) {
    throw new Error(
      `expected exactly one active source-controlled successor scope for ${headBranch}; found ${matching.length}`,
    );
  }
  const [{ scope, filePath }] = matching;
  const uncovered = changedFiles.filter((file) =>
    !scope.allowedPaths.some((pattern) => globMatches(pattern, file)));
  if (uncovered.length > 0) {
    throw new Error(
      `successor scope ${filePath} does not cover changed files: ${uncovered.join(', ')}`,
    );
  }

  return {
    schemaVersion: MODE_SCHEMA,
    slice,
    mode: SUCCESSOR_REGRESSION,
    eventName,
    headBranch,
    ownScopeBranch: ownScope.branch,
    successorScopeFile: filePath.replaceAll('\\', '/'),
    successorIssue: scope.issue,
    changedFileCount: changedFiles.length,
    outOfScopeCount: outOfScopeFiles.length,
    operationalStatus: 'NOT_ATTESTED',
    productionHosting: 'REG_RU_VPS_ONLY',
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`invalid argument sequence near ${String(key)}`);
    }
    args[key.slice(2)] = value;
  }
  return args;
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const required = [
    'slice',
    'event-name',
    'head-branch',
    'slice-scope',
    'changed-files',
    'out-of-scope',
    'evidence-dir',
  ];
  for (const key of required) {
    if (!args[key]) throw new Error(`missing --${key}`);
  }

  const ownScope = readJson(args['slice-scope']);
  validateScope(ownScope, args['slice-scope']);
  const scopesDirectory = args['scopes-directory'] || 'docs/platform-v7/autopilot/scopes';
  const successorScopes = listJsonFiles(scopesDirectory).map((filePath) => {
    const scope = readJson(filePath);
    if (scope?.status === 'active' && scope?.schemaVersion === 'platform-v7.concurrent-scope.v1') {
      validateScope(scope, filePath);
    }
    return { filePath, scope };
  }).filter(({ scope }) => scope?.status === 'active');

  const result = determineAcceptanceMode({
    slice: args.slice,
    eventName: args['event-name'],
    headBranch: args['head-branch'],
    ownScope,
    changedFiles: readLines(args['changed-files']),
    outOfScopeFiles: readLines(args['out-of-scope']),
    successorScopes,
  });

  fs.mkdirSync(args['evidence-dir'], { recursive: true });
  fs.writeFileSync(
    path.join(args['evidence-dir'], 'acceptance-mode.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(args['evidence-dir'], 'acceptance-mode.txt'),
    `${result.mode}\n`,
    'utf8',
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

export const ACCEPTANCE_MODES = Object.freeze({ EXACT_SCOPE, SUCCESSOR_REGRESSION });
