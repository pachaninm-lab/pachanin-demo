#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-repair-diagnose.yml';
const runnerPath = 'scripts/production-p0-reviewer-repair-diagnose.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-repair-diagnose.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-repair-diagnose-3802.json';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const requireMarkers = (label, source, markers) => {
  for (const marker of markers) {
    if (!source.includes(marker)) {
      console.error(`Missing ${label} marker: ${marker}`);
      process.exit(1);
    }
  }
};

requireMarkers('workflow', workflow, [
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-reviewer-membership-diagnose current-main'",
  'permissions:\n  contents: read',
  'contents: read\n      issues: write',
  'cancel-in-progress: false',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'bash scripts/production-p0-reviewer-repair-diagnose.sh',
  scopePath,
]);

requireMarkers('runner', runner, [
  "COMMAND='/production p0-reviewer-membership-diagnose current-main'",
  'git rev-parse "$TARGET_SHA^1"',
  'git diff --name-only "$DEPLOYED_SHA" "$TARGET_SHA"',
  'org.opencontainers.image.revision',
  'STAFF_DATABASE_URL',
  'docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs -',
  'Prisma.TransactionIsolationLevel.Serializable',
  'FROM auth.repair_single_reviewer_membership()',
  'P0_REVIEWER_ROLLBACK_ONLY',
  'REVIEWER_REPAIR_DIAGNOSTIC|',
  'PRODUCTION_MUTATION=ROLLBACK_ONLY_NONE_DURABLE',
  'IMPLEMENT_NARROW_REPAIR_CORRECTION_3799',
  'trap cleanup EXIT',
]);

const nodeMatch = runner.match(
  /docker exec -i "\$api_id" \/nodejs\/bin\/node --input-type=commonjs - <<'NODE'\n([\s\S]*?)\nNODE/,
);
if (!nodeMatch) {
  console.error('Bounded CommonJS diagnostic executor is missing.');
  process.exit(1);
}
const embeddedNode = nodeMatch[1];
const syntax = spawnSync(process.execPath, ['--check'], {
  input: embeddedNode,
  encoding: 'utf8',
});
if (syntax.status !== 0) {
  console.error('Embedded diagnostic Node executor is not syntactically valid.');
  process.exit(1);
}

for (const pattern of [
  /error\.(?:message|stack)/,
  /JSON\.stringify\(\s*error/,
  /console\.(?:log|error)\([^\n]*(?:DATABASE_URL|STAFF_DATABASE_URL)/,
  /bootstrap-platform-owner\.mjs/,
  /PC_PROD_P0_(?:STAFF|REVIEWER)_(?:PASSWORD|TOTP_SECRET)/,
  /passwordHash|password_hash|mfaSecret|mfa_secret|backup_code|backupHash/i,
  /\b(?:UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i,
  /\bINSERT\s+INTO\b/i,
]) {
  if (pattern.test(embeddedNode)) {
    console.error(`Diagnostic executor is broader or more sensitive than allowed: ${pattern}`);
    process.exit(1);
  }
}

if (!/\$transaction\([\s\S]*FROM auth\.repair_single_reviewer_membership\(\)[\s\S]*P0_REVIEWER_ROLLBACK_ONLY[\s\S]*TransactionIsolationLevel\.Serializable/.test(embeddedNode)) {
  console.error('Diagnostic must reproduce the existing function only inside one forced-rollback SERIALIZABLE transaction.');
  process.exit(1);
}
if (!/before\.join\('\|'\) !== after\.join\('\|'\)/.test(embeddedNode)) {
  console.error('Diagnostic must prove aggregate reviewer readiness is unchanged after rollback.');
  process.exit(1);
}

const expectedPaths = [workflowPath, runnerPath, checkerPath, scopePath].sort();
const actualPaths = [...scope.allowedPaths].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
  console.error('Governed diagnostic scope does not match the exact four-file surface.');
  process.exit(1);
}
if (scope.issue !== 3802
    || scope.boundaries?.productionMutation !== 'ROLLBACK_ONLY_NONE_DURABLE'
    || scope.boundaries?.piiOutput !== false
    || scope.boundaries?.credentialOutput !== false
    || scope.boundaries?.deploymentMutation !== false
    || scope.boundaries?.newRecurringCostRub !== 0) {
  console.error('Governed diagnostic boundaries are incomplete or unsafe.');
  process.exit(1);
}

console.log('PASS: reviewer repair diagnostic is owner-only, exact-parent-deployment-bound, forced-rollback, aggregate-only and credential/PII-free.');
