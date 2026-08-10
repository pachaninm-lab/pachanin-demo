#!/usr/bin/env node
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/production-p0-reviewer-inspect.yml', 'utf8');
const runner = fs.readFileSync('scripts/production-p0-reviewer-inspect.sh', 'utf8');

const workflowMarkers = [
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-reviewer-inspect current-main'",
  'permissions:\n  contents: read',
  'contents: read\n      issues: write',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'bash scripts/production-p0-reviewer-inspect.sh',
];

for (const marker of workflowMarkers) {
  if (!workflow.includes(marker)) {
    console.error(`Missing reviewer inspect workflow marker: ${marker}`);
    process.exit(1);
  }
}

const runnerMarkers = [
  "DEFAULT_HOST='195.19.12.120'",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "COMMAND='/production p0-reviewer-inspect current-main'",
  'gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha',
  'StrictHostKeyChecking=yes',
  'ssh-keyscan -T 10',
  'org.opencontainers.image.revision',
  'STAFF_DATABASE_URL',
  'docker exec -i "$api_id" /nodejs/bin/node -',
  "principal.user_name !== 'pc_staff_runtime'",
  'principal.rolsuper',
  'principal.rolbypassrls',
  'principal.can_read_deals',
  "role = 'PLATFORM_OWNER'",
  "role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')",
  "status IN ('ELIGIBLE', 'ACTIVE')",
  'PRODUCTION_MUTATION=NONE',
  'REVIEWER_INSPECT_FAILED_CLOSED',
  'trap cleanup EXIT',
  'rm -f -- "$key_path" "$known_hosts"',
];

for (const marker of runnerMarkers) {
  if (!runner.includes(marker)) {
    console.error(`Missing reviewer inspect runner marker: ${marker}`);
    process.exit(1);
  }
}

const forbidden = [
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+(?:auth\.|public\.)/i,
  /\bDELETE\s+FROM\b/i,
  /\bCREATE\s+(?:ROLE|USER|TABLE|FUNCTION)\b/i,
  /\bALTER\s+(?:ROLE|USER|TABLE)\b/i,
  /\bDROP\s+(?:ROLE|USER|TABLE|FUNCTION)\b/i,
  /bootstrap-platform-owner\.mjs/,
  /BOOTSTRAP_PLATFORM_OWNER_/,
  /PC_PROD_P0_STAFF_PASSWORD/,
  /PC_PROD_P0_STAFF_TOTP_SECRET/,
  /PC_PROD_P0_REVIEWER_PASSWORD/,
  /PC_PROD_P0_REVIEWER_TOTP_SECRET/,
];

for (const pattern of forbidden) {
  if (pattern.test(workflow) || pattern.test(runner)) {
    console.error(`Reviewer inspect is not read-only or exceeds its credential boundary: ${pattern}`);
    process.exit(1);
  }
}

console.log('PASS: reviewer inspect is owner-only, exact-main, pinned-SSH, aggregate-only and read-only.');
