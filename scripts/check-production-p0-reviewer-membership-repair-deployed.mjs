#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-membership-repair-deployed.yml';
const sourcePath = 'scripts/production-p0-reviewer-membership-repair.sh';
const wrapperPath = 'scripts/production-p0-reviewer-membership-repair-deployed-sha.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-membership-repair-deployed.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-membership-repair-deployed-3799.json';
const branch = 'fix/p0-reviewer-exact-deployed-repair-3799';
const deployedRevision = '30d9075d8867fa60b3ec275b1e244f151debf0f4';
const sourceBlob = '0b55b5b9a8ae36c37ac5974d9ee80ea77cb5df7c';
const command = '/production p0-reviewer-membership-repair deployed-30d9075';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const source = fs.readFileSync(sourcePath, 'utf8');
const wrapper = fs.readFileSync(wrapperPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const fail = (code) => {
  console.error(`CHECKER_FAIL=${code}`);
  process.exit(1);
};

const requireMarkers = (code, text, markers) => {
  for (const marker of markers) {
    if (!text.includes(marker)) fail(code);
  }
};

const sourceGitBlob = crypto
  .createHash('sha1')
  .update(`blob ${Buffer.byteLength(source, 'utf8')}\0`)
  .update(source)
  .digest('hex');
if (sourceGitBlob !== sourceBlob) fail('SOURCE_BLOB_DRIFT');

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
  `bash -n ${wrapperPath}`,
  `bash ${wrapperPath}`,
]);

requireMarkers('SOURCE_MARKERS', source, [
  "COMMAND='/production p0-reviewer-membership-repair current-main'",
  'FROM auth.repair_single_reviewer_membership()',
  'Prisma.TransactionIsolationLevel.Serializable',
  'PRODUCTION_MUTATION=REVIEWER_MEMBERSHIP_ONLY',
  "['REPAIRED', 'ALREADY_REPAIRED']",
  "principal.user_name !== 'pc_staff_runtime'",
]);

requireMarkers('WRAPPER_MARKERS', wrapper, [
  `SOURCE_BLOB='${sourceBlob}'`,
  `TARGET_DEPLOYED_SHA='${deployedRevision}'`,
  `COMMAND='${command}'`,
  'git hash-object "$SOURCE"',
  'git merge-base --is-ancestor "$TARGET_SHA" "$live_main"',
  'git merge-base --is-ancestor "$TARGET_SHA" origin/main',
  'git cat-file -e "$TARGET_SHA^{commit}"',
  'api_revision_after=',
  'web_revision_after=',
  '[[ "$api_revision_after" == "$target_sha" && "$web_revision_after" == "$target_sha" ]]',
  "bash -n \"$PATCHED\"",
  'exec bash "$PATCHED"',
]);

const pythonMatch = wrapper.match(
  /python3 - "\$SOURCE" "\$PATCHED" "\$TARGET_DEPLOYED_SHA" "\$COMMAND" <<'PY'\n([\s\S]*?)\nPY/,
);
if (!pythonMatch) fail('PYTHON_EXTRACT');
const pythonSyntax = spawnSync(
  'python3',
  ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'],
  { input: pythonMatch[1], encoding: 'utf8' },
);
if (pythonSyntax.error) fail('PYTHON3_UNAVAILABLE');
if (pythonSyntax.status !== 0) fail('PYTHON_SYNTAX');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-reviewer-exact-deployed-'));
const tempSource = path.join(tempRoot, 'source.sh');
const patchedPath = path.join(tempRoot, 'patched.sh');
try {
  fs.writeFileSync(tempSource, source, 'utf8');
  const patchResult = spawnSync(
    'python3',
    ['-c', pythonMatch[1], tempSource, patchedPath, deployedRevision, command],
    { encoding: 'utf8' },
  );
  if (patchResult.error) fail('PYTHON3_UNAVAILABLE');
  if (patchResult.status !== 0 || !fs.existsSync(patchedPath)) {
    console.error(patchResult.stdout || patchResult.stderr || '');
    fail('PATCH_MATERIALIZE');
  }

  const patched = fs.readFileSync(patchedPath, 'utf8');
  const bashSyntax = spawnSync('bash', ['-n', patchedPath], { encoding: 'utf8' });
  if (bashSyntax.status !== 0) fail('PATCHED_BASH_SYNTAX');

  requireMarkers('PATCHED_MARKERS', patched, [
    `COMMAND='${command}'`,
    `TARGET_SHA='${deployedRevision}'`,
    'git merge-base --is-ancestor "$TARGET_SHA" "$live_main"',
    'git merge-base --is-ancestor "$TARGET_SHA" origin/main',
    'git cat-file -e "$TARGET_SHA^{commit}"',
    '- exact deployed revision: \\`$TARGET_SHA\\`',
    'api_revision_after=',
    'web_revision_after=',
    '[[ "$api_revision_after" == "$target_sha" && "$web_revision_after" == "$target_sha" ]]',
    'FROM auth.repair_single_reviewer_membership()',
    'Prisma.TransactionIsolationLevel.Serializable',
    'PRODUCTION_MUTATION=REVIEWER_MEMBERSHIP_ONLY',
    '- next: \\`REVIEWER_PASSWORD_RESET_REQUIRED\\`',
  ]);

  for (const forbidden of [
    "COMMAND='/production p0-reviewer-membership-repair current-main'",
    'TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"',
    '[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]',
    /email/i,
    /passwordHash/,
    /mfa_secret_ciphertext/,
  ]) {
    if (typeof forbidden === 'string' ? patched.includes(forbidden) : forbidden.test(patched)) {
      fail('PATCHED_FORBIDDEN_MARKER');
    }
  }

  if ((patched.match(new RegExp(deployedRevision, 'g')) || []).length !== 1) {
    fail('DEPLOYED_SHA_CARDINALITY');
  }
  if ((patched.match(new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 1) {
    fail('COMMAND_CARDINALITY');
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const expectedPaths = [workflowPath, wrapperPath, checkerPath, scopePath].sort();
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify(expectedPaths)) {
  fail('SCOPE_PATHS');
}
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
    || scope.branch !== branch
    || scope.status !== 'active'
    || scope.operationalStatus !== 'P0_REVIEWER_MEMBERSHIP_REPAIR_EXACT_DEPLOYED_SHA'
    || scope.issue !== 3799
    || scope.deployedRevision !== deployedRevision
    || scope.sourceScriptBlob !== sourceBlob
    || scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY'
    || scope.boundaries?.productionMutation !== 'REVIEWER_MEMBERSHIP_ONLY'
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

console.log('PASS: reviewer repair is fixed to the already deployed 30d9075 revision, remains ancestor-guarded, function-only, exact-revision checked before and after, and cannot deploy unrelated moving-main changes.');
