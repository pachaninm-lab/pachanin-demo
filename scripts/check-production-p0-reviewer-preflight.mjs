#!/usr/bin/env node
import fs from 'node:fs';

const path = '.github/workflows/production-p0-reviewer-preflight.yml';
const workflow = fs.readFileSync(path, 'utf8');

const required = [
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-reviewer-preflight current-main'",
  'DEFAULT_HOST: 195.19.12.120',
  'SSH_HOST_FINGERPRINT_SECRET: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
  'StrictHostKeyChecking=yes',
  'UserKnownHostsFile=',
  'git fetch --no-tags origin main',
  'gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha',
  "--filter 'label=com.docker.compose.service=web'",
  "--filter 'label=com.docker.compose.service=api'",
  'org.opencontainers.image.revision',
  'STAFF_DATABASE_URL',
  "principal.user_name !== 'pc_staff_runtime'",
  'principal.rolsuper',
  'principal.rolbypassrls',
  'principal.can_read_deals',
  "role = 'PLATFORM_OWNER'",
  "role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')",
  "status IN ('ELIGIBLE', 'ACTIVE')",
  'PRODUCTION_MUTATION=NONE',
  'rm -f -- "$key_path"',
  'rm -f -- "$known_hosts"',
];

for (const marker of required) {
  if (!workflow.includes(marker)) {
    console.error(`Missing required reviewer-preflight marker: ${marker}`);
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
  /secrets\.PC_PROD_P0_REVIEWER_PASSWORD/,
  /secrets\.PC_PROD_P0_REVIEWER_TOTP_SECRET/,
];
for (const pattern of forbidden) {
  if (pattern.test(workflow)) {
    console.error(`Reviewer preflight is not read-only: ${pattern}`);
    process.exit(1);
  }
}

if (!/permissions:\n\s+contents: read/.test(workflow)) {
  console.error('Top-level permissions must remain contents: read');
  process.exit(1);
}
if (!/permissions:\n\s+contents: read\n\s+issues: write/.test(workflow)) {
  console.error('Production job may add only issues: write to contents: read');
  process.exit(1);
}

console.log('PASS: production P0 reviewer preflight is owner-only, exact-main, pinned-SSH and read-only.');
