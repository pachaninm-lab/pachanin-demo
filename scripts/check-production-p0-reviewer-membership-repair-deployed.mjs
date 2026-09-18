#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-membership-repair-deployed.yml';
const runnerPath = 'scripts/production-p0-reviewer-membership-repair-deployed-sha.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-membership-repair-deployed.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-membership-repair-deployed-3799.json';
const statePath = 'docs/platform-v7/autopilot/autopilot-state.json';
const branch = 'fix/p0-reviewer-exact-deployed-repair-3799';
const deployedRevision = '30d9075d8867fa60b3ec275b1e244f151debf0f4';
const command = '/production p0-reviewer-membership-repair deployed-30d9075';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

const fail = (code) => {
  console.error(`CHECKER_FAIL=${code}`);
  process.exit(1);
};

const requireMarkers = (code, text, markers) => {
  for (const marker of markers) {
    if (!text.includes(marker)) fail(code);
  }
};

requireMarkers('WORKFLOW_MARKERS', workflow, [
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  `github.event.comment.body == '${command}'`,
  'permissions:\n  contents: read',
  'contents: read\n      issues: write',
  'group: production-p0-reviewer-membership-repair',
  'cancel-in-progress: false',
  `node ${checkerPath}`,
  `bash -n ${runnerPath}`,
  `bash ${runnerPath}`,
]);

requireMarkers('RUNNER_MARKERS', runner, [
  `COMMAND='${command}'`,
  `TARGET_SHA='${deployedRevision}'`,
  'guard_repository_ancestry() {',
  'git merge-base --is-ancestor "$TARGET_SHA" "$live_main"',
  'git cat-file -e "$TARGET_SHA^{commit}"',
  'FROM auth.repair_single_reviewer_membership()',
  'Prisma.TransactionIsolationLevel.Serializable',
  "principal.user_name !== 'pc_staff_runtime'",
  "['REPAIRED', 'ALREADY_REPAIRED']",
  'api_revision_after=',
  'web_revision_after=',
  '[[ "$api_revision_after" == "$target_sha" && "$web_revision_after" == "$target_sha" ]]',
  'PRODUCTION_MUTATION=REVIEWER_MEMBERSHIP_ONLY',
  '- exact deployed revision: \\`$TARGET_SHA\\`',
  '- next: \\`REVIEWER_PASSWORD_RESET_REQUIRED\\`',
]);

for (const forbidden of [
  'python3 - "$SOURCE"',
  'SOURCE_BLOB=',
  'PATCHED=',
  'target.write_text(',
  "COMMAND='/production p0-reviewer-membership-repair current-main'",
  'TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"',
  '[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]',
]) {
  if (runner.includes(forbidden)) fail('RUNNER_FORBIDDEN_MARKER');
}

const shellSyntax = spawnSync('bash', ['-n', runnerPath], { encoding: 'utf8' });
if (shellSyntax.error || shellSyntax.status !== 0) fail('RUNNER_BASH_SYNTAX');

const embeddedNodeMatch = runner.match(
  /docker exec -i "\$api_id" \/nodejs\/bin\/node --input-type=commonjs - <<'NODE'\n([\s\S]*?)\nNODE/,
);
if (!embeddedNodeMatch) fail('EMBEDDED_NODE_EXTRACT');
const nodeSyntax = spawnSync(process.execPath, ['--check'], {
  input: embeddedNodeMatch[1],
  encoding: 'utf8',
});
if (nodeSyntax.error || nodeSyntax.status !== 0) fail('EMBEDDED_NODE_SYNTAX');

for (const unsafe of [
  /console\.(?:log|error)\([^\n]*(?:databaseUrl|password|secret|token|email)/i,
  /gh issue comment[^\n]*(?:databaseUrl|password|secret|token|email)/i,
  /JSON\.stringify\(\s*(?:process\.env|error)/,
  /postgres(?:ql)?:\/\//i,
]) {
  if (unsafe.test(runner)) fail('SENSITIVE_OUTPUT_GUARD');
}

const expectedPaths = [workflowPath, runnerPath, checkerPath, scopePath, statePath];
const exactSet = (value) => {
  if (!Array.isArray(value) || value.length !== expectedPaths.length) return false;
  const actual = new Set(value);
  return actual.size === expectedPaths.length
    && expectedPaths.every((entry) => actual.has(entry));
};

if (!exactSet(scope.allowedPaths)) fail('SCOPE_PATHS');
if (!exactSet(state.approvedConcurrentScopes?.[branch])) fail('AUTHORITATIVE_SCOPE');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
    || scope.branch !== branch
    || scope.status !== 'active'
    || scope.operationalStatus !== 'P0_REVIEWER_MEMBERSHIP_REPAIR_EXACT_DEPLOYED_SHA'
    || scope.issue !== 3799
    || scope.deployedRevision !== deployedRevision
    || scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY'
    || scope.boundaries?.productionMutation !== 'REVIEWER_MEMBERSHIP_ONLY'
    || scope.boundaries?.immutableCheckedInRunner !== true
    || scope.boundaries?.runtimeRewriting !== false
    || scope.boundaries?.arbitraryTarget !== false
    || scope.boundaries?.currentMainDeploymentRequired !== false
    || scope.boundaries?.deployedRevisionMustBeAncestorOfMain !== true
    || scope.boundaries?.piiOutput !== false
    || scope.boundaries?.credentialOutput !== false
    || scope.boundaries?.rawDatabaseMessageOutput !== false
    || scope.boundaries?.deploymentMutation !== false
    || scope.boundaries?.securityWeakening !== false
    || scope.boundaries?.arbitrarySqlSurface !== false
    || scope.boundaries?.newRecurringCostRub !== 0) {
  fail('SCOPE_METADATA');
}

console.log('PASS: immutable owner-only reviewer repair is fixed to deployed 30d9075, exact-revision checked before and after, ancestor-guarded against moving main, and authorized by the repository state.');
