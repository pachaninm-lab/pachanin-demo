#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  automatic: '.github/workflows/tai-automatic-reg-ru-preflight.yml',
  activation: '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml',
  docker: '.github/workflows/docker-publish.yml',
  checker: 'scripts/check-tai-automatic-release-chain.mjs',
  activationChecker: 'scripts/check-tai-owner-activation-command.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/tai-automatic-exact-release-chain-20260806.json',
  activationScope: 'docs/platform-v7/autopilot/scopes/tai-owner-activation-command-20260803.json',
};
const automatic = readFileSync(paths.automatic, 'utf8');
const activation = readFileSync(paths.activation, 'utf8');
const docker = readFileSync(paths.docker, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const violations = [];
const requireFragment = (source, path, fragment) => {
  if (!source.includes(fragment)) violations.push(`${path}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, path, pattern, message) => {
  if (pattern.test(source)) violations.push(`${path}: ${message}`);
};

for (const fragment of [
  'name: TAI Automatic REG.RU Preflight',
  'workflow_run:',
  'workflows: ["Build & Publish Canonical Docker Images"]',
  "github.event.workflow_run.head_branch == 'main'",
  'UPSTREAM_REPOSITORY: ${{ github.event.workflow_run.head_repository.full_name }}',
  'UPSTREAM_CONCLUSION: ${{ github.event.workflow_run.conclusion }}',
  'UPSTREAM_SHA: ${{ github.event.workflow_run.head_sha }}',
  '[[ "$UPSTREAM_REPOSITORY" == "$GITHUB_REPOSITORY" ]]',
  '[[ "$UPSTREAM_BRANCH" == main ]]',
  '[[ "$UPSTREAM_SHA" == "$current_sha" ]]',
  "'Build API image'",
  "'Build web image'",
  "'Build TAI image'",
  "'Build migration image'",
  "'Validate Helm chart'",
  'name: Require successful canonical image build',
  'name: Least-privilege preflight contract',
  'name: Exact-main canonical TAI image authority',
  'name: Exact-main REG.RU controller inventory',
  'name: Publish REG.RU preflight status',
  'name: Confirm REG.RU preflight chain result',
  'runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]',
  'sudo -n /usr/local/sbin/pc-tai-release-controller',
  'outputs:\n      evidence_json: ${{ steps.evidence.outputs.json }}',
  'len(raw) > 65536',
  "json.dumps(payload, ensure_ascii=True, separators=(',', ':'))",
  'name: Publish terminal preflight status',
  'production mutation:',
]) requireFragment(automatic, paths.automatic, fragment);

const liveStart = automatic.indexOf('\n  live_preflight:\n');
const publishStart = automatic.indexOf('\n  publish_status:\n', liveStart);
const live = liveStart >= 0 && publishStart > liveStart ? automatic.slice(liveStart, publishStart) : '';
if (!live) violations.push(`${paths.automatic}: live_preflight job boundary missing`);
if (/^\s{6}- uses:/mu.test(live)) violations.push(`${paths.automatic}: production self-hosted preflight must be actionless`);
forbid(live, paths.automatic, /actions\/(?:upload|download)-artifact@v4/u, 'artifact Actions are forbidden on the production runner');
forbid(live, paths.automatic, /docker\s+(?:run|pull|compose|exec|login)/u, 'direct Docker authority is forbidden on the production runner');
forbid(automatic, paths.automatic, /ssh(?:-keyscan)?\s|scp\s/u, 'inbound or arbitrary SSH transport is forbidden');
forbid(automatic, paths.automatic, /continue-on-error:\s*true/mu, 'continue-on-error success laundering is forbidden');
forbid(automatic, paths.automatic, /pull_request_target:/u, 'pull_request_target is forbidden');
forbid(automatic, paths.automatic, /actions:\s*write/u, 'read-only automatic preflight must not receive workflow dispatch authority');
forbid(automatic, paths.automatic, /actions\/workflows\/tai-restricted-qwen-reg-ru-activation[.]yml\/dispatches/u,
  'canonical image publication and automatic preflight must not dispatch production activation');
forbid(automatic, paths.automatic, /inputs\[confirmation\]=ACTIVATE-RESTRICTED-QWEN-REG-RU/u,
  'automatic preflight must not mint production activation confirmation');

for (const fragment of [
  "'TAI Automatic REG.RU Preflight'",
  "run.event !== 'workflow_run'",
  "run.head_branch !== 'main'",
  "new Set([owner, 'github-actions[bot]'])",
  "'Require successful canonical image build'",
  "'Least-privilege preflight contract'",
  "'Exact-main canonical TAI image authority'",
  "'Exact-main REG.RU controller inventory'",
  "'Publish REG.RU preflight status'",
  "'Confirm REG.RU preflight chain result'",
]) requireFragment(activation, paths.activation, fragment);

for (const fragment of [
  '- ".github/workflows/tai-automatic-reg-ru-preflight.yml"',
  '- "scripts/check-tai-automatic-release-chain.mjs"',
  '- "docs/platform-v7/autopilot/scopes/*automatic-exact-release-chain*.json"',
]) requireFragment(docker, paths.docker, fragment);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${paths.scope}: invalid schemaVersion`);
if (scope.branch !== 'fix/tai-automatic-exact-release-chain-20260806') violations.push(`${paths.scope}: branch mismatch`);
if (scope.baselineExactMain !== 'cd1763e5e6f11309c2cde89c17faec4b5cc61c3c') violations.push(`${paths.scope}: baseline mismatch`);
const expectedPaths = Object.values(paths).sort();
const allowedPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(expectedPaths) !== JSON.stringify(allowedPaths)) {
  violations.push(`${paths.scope}: allowedPaths must exactly match automatic release-chain implementation`);
}

if (violations.length) {
  console.error('TAI automatic exact release chain contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI automatic preflight contract PASS: canonical build workflow_run remains read-only, actionless on REG.RU, bounded-evidence and unable to dispatch production activation.');
