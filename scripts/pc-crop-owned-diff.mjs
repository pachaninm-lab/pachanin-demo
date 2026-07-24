#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const EXPECTED_SCHEMA = 'pc-crop.predecessor-workflow-ownership.v1';
const DEFAULT_REGISTRY = 'docs/platform-v7/autopilot/pc-crop-workflow-ownership.json';

function fail(message) {
  throw new Error(`PC_CROP_OWNED_DIFF:${message}`);
}

function normalize(value) {
  return String(value ?? '').trim().replace(/\\/gu, '/').replace(/\/+$/gu, '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function globToRegExp(glob) {
  const value = normalize(glob);
  if (!value || value === '..' || value.startsWith('../') || value.includes('/../')) {
    fail(`unsafe ownership pattern ${JSON.stringify(glob)}`);
  }
  let pattern = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (character === '*' && next === '*') {
      pattern += '.*';
      index += 1;
    } else if (character === '*') {
      pattern += '[^/]*';
    } else {
      pattern += escapeRegExp(character);
    }
  }
  return new RegExp(`^${pattern}$`, 'u');
}

export function selectOwnedFiles(changedFiles, triggerPaths) {
  const matchers = triggerPaths.map(globToRegExp);
  return changedFiles.filter((file) => matchers.some((matcher) => matcher.test(normalize(file))));
}

export function validateRegistry(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('registry must be an object');
  }
  if (value.schemaVersion !== EXPECTED_SCHEMA) {
    fail(`unsupported registry schema ${String(value.schemaVersion)}`);
  }
  if (value.workflows === null || typeof value.workflows !== 'object' || Array.isArray(value.workflows)) {
    fail('registry workflows must be an object');
  }
  const entries = Object.entries(value.workflows);
  if (entries.length === 0) fail('registry contains no workflows');
  for (const [id, workflow] of entries) {
    if (workflow === null || typeof workflow !== 'object' || Array.isArray(workflow)) {
      fail(`workflow ${id} must be an object`);
    }
    if (typeof workflow.workflowPath !== 'string' || !workflow.workflowPath.trim()) {
      fail(`workflow ${id} has no workflowPath`);
    }
    if (typeof workflow.scopeStepName !== 'string' || !workflow.scopeStepName.trim()) {
      fail(`workflow ${id} has no scopeStepName`);
    }
    if (!Array.isArray(workflow.triggerPaths) || workflow.triggerPaths.length === 0) {
      fail(`workflow ${id} has no triggerPaths`);
    }
    const normalized = workflow.triggerPaths.map((entry) => {
      if (typeof entry !== 'string') fail(`workflow ${id} has non-string trigger path`);
      const pattern = normalize(entry);
      globToRegExp(pattern);
      return pattern;
    });
    if (new Set(normalized).size !== normalized.length) {
      fail(`workflow ${id} has duplicate triggerPaths`);
    }
    if (!normalized.includes(normalize(workflow.workflowPath))) {
      fail(`workflow ${id} does not own its workflow file`);
    }
    workflow.triggerPaths = [...normalized].sort((left, right) => left.localeCompare(right, 'en'));
    workflow.workflowPath = normalize(workflow.workflowPath);
  }
  return value;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) fail(`unexpected argument ${token}`);
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`missing value for --${name}`);
    result[name] = value;
    index += 1;
  }
  for (const required of ['workflow', 'base-ref', 'head-ref', 'evidence-dir']) {
    if (!result[required]) fail(`missing --${required}`);
  }
  return result;
}

function readChangedFiles(baseRef, headRef) {
  const result = spawnSync('git', ['diff', '--name-only', `${baseRef}...${headRef}`], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(`git diff failed: ${result.stderr.trim()}`);
  }
  return result.stdout
    .split(/\r?\n/u)
    .map(normalize)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'en'));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const registryPath = args.registry || DEFAULT_REGISTRY;
  let registry;
  try {
    registry = validateRegistry(JSON.parse(fs.readFileSync(registryPath, 'utf8')));
  } catch (error) {
    if (error instanceof SyntaxError) fail(`malformed registry JSON: ${error.message}`);
    throw error;
  }
  const workflow = registry.workflows[args.workflow];
  if (!workflow) fail(`unknown workflow ${args.workflow}`);
  const changedFiles = readChangedFiles(args['base-ref'], args['head-ref']);
  const ownedChangedFiles = selectOwnedFiles(changedFiles, workflow.triggerPaths);
  if (ownedChangedFiles.length === 0) {
    fail(`workflow ${args.workflow} was invoked without an owned changed file`);
  }
  const ownedSet = new Set(ownedChangedFiles);
  const ignoredChangedFiles = changedFiles.filter((file) => !ownedSet.has(file));
  const evidenceDir = args['evidence-dir'];
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'changed-files.txt'), `${changedFiles.join('\n')}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'owned-changed-files.txt'), `${ownedChangedFiles.join('\n')}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'ignored-successor-files.txt'), `${ignoredChangedFiles.join('\n')}\n`);
  const report = {
    schemaVersion: 'pc-crop.predecessor-owned-diff-evidence.v1',
    workflow: args.workflow,
    workflowPath: workflow.workflowPath,
    baseRef: args['base-ref'],
    headRef: args['head-ref'],
    changedFileCount: changedFiles.length,
    ownedChangedFileCount: ownedChangedFiles.length,
    ignoredSuccessorFileCount: ignoredChangedFiles.length,
    ownedChangedFiles,
    ignoredSuccessorFiles: ignoredChangedFiles,
    wholePullRequestGovernedByCentralGuard: true,
    status: 'PASS',
  };
  fs.writeFileSync(
    path.join(evidenceDir, 'owned-diff-evidence.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entry) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
