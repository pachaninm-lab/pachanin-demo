#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const STATE_PATH = 'docs/platform-v7/autopilot/autopilot-state.json';
const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
const allowed = Array.isArray(state.allowedCurrentScope) ? state.allowedCurrentScope : [];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function normalizePath(input) {
  return String(input ?? '').trim().replace(/\\/g, '/').replace(/\/+$/g, '');
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegExp(glob) {
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

function scopeMatches(allowedEntry, candidate) {
  const scope = normalizePath(allowedEntry);
  const filePath = normalizePath(candidate);
  if (!scope || !filePath) return false;
  if (scope === filePath) return true;
  if (scope.includes('*')) return globToRegExp(scope).test(filePath);
  return filePath.startsWith(`${scope}/`);
}

const status = git(['status', '--porcelain'])
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const changedPaths = status.map((line) => line.slice(3));
const outside = changedPaths.filter((filePath) => !allowed.some((scope) => scopeMatches(scope, filePath)));

if (outside.length === 0) {
  console.log('scope cleaner: all changes are inside allowed current scope');
  process.exit(0);
}

console.log('scope cleaner: reverting changes outside allowed current scope');
for (const filePath of outside) {
  console.log(`- ${filePath}`);
  const existsInHead = (() => {
    try {
      execFileSync('git', ['cat-file', '-e', `HEAD:${filePath}`], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

  if (existsInHead) {
    execFileSync('git', ['checkout', '--', filePath], { stdio: 'inherit' });
  } else {
    execFileSync('git', ['rm', '-f', '--ignore-unmatch', filePath], { stdio: 'inherit' });
    execFileSync('rm', ['-f', filePath], { stdio: 'ignore' });
  }
}

const remaining = git(['status', '--porcelain'])
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.slice(3));

const remainingOutside = remaining.filter((filePath) => !allowed.some((scope) => scopeMatches(scope, filePath)));
if (remainingOutside.length > 0) {
  console.error('scope cleaner: remaining outside-scope changes detected');
  for (const filePath of remainingOutside) console.error(`- ${filePath}`);
  process.exit(1);
}

console.log('scope cleaner: outside-scope changes removed');
