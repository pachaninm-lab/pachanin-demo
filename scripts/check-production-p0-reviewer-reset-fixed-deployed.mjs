#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-fixed-deployed.yml';
const runnerPath = 'scripts/production-p0-reviewer-reset-fixed-deployed.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-fixed-deployed.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-fixed-deployed-3785.json';
const command = '/production p0-reviewer-reset-request deployed-d2dd797';
const deployedRevision = 'd2dd7972105cc59002263455b5ae0eb8d8f2d386';
const branch = 'fix/p0-reviewer-reset-fixed-deployed-d2dd-3785';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const fail = (code) => {
  console.error(`CHECKER_FAIL=${code}`);
  process.exit(1);
};
const requireMarkers = (code, text, markers) => {
  for (const marker of markers) if (!text.includes(marker)) fail(code);
};

requireMarkers('WORKFLOW_MARKERS', workflow, [
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  `github.event.comment.body == '${command}'`,
  'permissions:\n  contents: read',
  'contents: read\n      issues: write',
  'persist-credentials: false',
  `node ${checkerPath}`,
  `bash -n ${runnerPath}`,
  `bash ${runnerPath}`,
]);

requireMarkers('RUNNER_MARKERS', runner, [
  `COMMAND='${command}'`,
  `TARGET_SHA='${deployedRevision}'`,
  'git merge-base --is-ancestor "$TARGET_SHA" "$live_main"',
  'git cat-file -e "$TARGET_SHA^{commit}"',
  '/usr/bin/ssh-keyscan -T 10 -p "$port" "$host"',
  '-o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes',
  'auth.staff_reviewer_preflight()',
  'auth.staff_reviewer_login_readiness()',
  'auth.staff_reviewer_password_reset_subject()',
  "counts.join('|') !== '1|1|1|1|1|0|0|0'",
  '/platform-v7/forgot-password?lang=ru',
  '-H "Origin: $live_base"',
  '-H "x-csrf-token: $csrf"',
  '$live_base/api/auth/forgot-password',
  "grep -F 'password_reset_delivery_result'",
  "grep -Eq '\"delivered\"[[:space:]]*:[[:space:]]*true'",
  '[[ "$api_revision_after" == "$target_sha" && "$web_revision_after" == "$target_sha" ]]',
  'PRODUCTION_MUTATION=NORMAL_PASSWORD_RESET_REQUEST_ONLY',
  'reviewer identity exposure: \\`NONE\\`',
  'reset-token/password/TOTP exposure: \\`NONE\\`',
]);

for (const forbidden of [
  'StrictHostKeyChecking=no',
  'StrictHostKeyChecking=accept-new',
  'ssh-keyscan -H',
  'BYPASSRLS',
  'ALTER ROLE',
  'SET ROLE',
  'UPDATE public.users',
  'UPDATE auth.mfa',
  'TARGET_SHA="$(gh api',
  'workflow_dispatch',
  'repository_dispatch',
]) {
  if (runner.includes(forbidden) || workflow.includes(forbidden)) fail('FORBIDDEN_MARKER');
}

const shellSyntax = spawnSync('bash', ['-n', runnerPath], { encoding: 'utf8' });
if (shellSyntax.error || shellSyntax.status !== 0) fail('RUNNER_BASH_SYNTAX');
const nodeSyntax = spawnSync(process.execPath, ['--check', checkerPath], { encoding: 'utf8' });
if (nodeSyntax.error || nodeSyntax.status !== 0) fail('CHECKER_NODE_SYNTAX');

const expectedPaths = [workflowPath, runnerPath, checkerPath, scopePath];
const actualPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (actualPaths.length !== expectedPaths.length
    || expectedPaths.slice().sort().some((path, index) => path !== actualPaths[index])) {
  fail('SCOPE_PATHS');
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
    || scope.branch !== branch
    || scope.status !== 'active'
    || scope.operationalStatus !== 'P0_REVIEWER_PASSWORD_RESET_FIXED_DEPLOYED_REVISION'
    || scope.issue !== 3785
    || scope.deployedRevision !== deployedRevision
    || scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY'
    || scope.boundaries?.productionMutation !== 'NORMAL_PASSWORD_RESET_REQUEST_ONLY'
    || scope.boundaries?.identityMutation !== false
    || scope.boundaries?.staffAssignmentMutation !== false
    || scope.boundaries?.membershipMutation !== false
    || scope.boundaries?.passwordMutation !== false
    || scope.boundaries?.mfaMutation !== false
    || scope.boundaries?.sessionMutation !== false
    || scope.boundaries?.deploymentMutation !== false
    || scope.boundaries?.databasePrivilegeMutation !== false
    || scope.boundaries?.arbitraryTarget !== false
    || scope.boundaries?.deployedRevisionMustBeAncestorOfMain !== true
    || scope.boundaries?.piiOutput !== false
    || scope.boundaries?.credentialOutput !== false
    || scope.boundaries?.resetTokenOutput !== false
    || scope.boundaries?.strictSshHostVerification !== true
    || scope.boundaries?.newRecurringCostRub !== 0) {
  fail('SCOPE_METADATA');
}

console.log('PASS: fixed-deployed reviewer reset is owner-only, pinned to proven REG.RU revision, ancestry-guarded, CSRF-preserving, delivery-attested and secret-free.');
