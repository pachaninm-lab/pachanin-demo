#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-inspect.yml';
const runnerPath = 'scripts/production-p0-reviewer-inspect.sh';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');

const sourceRun = '33293760567-1';
const sourceRevision = '9639a2a3d06f0aa3b38187bc22891450468115c0';
const command = `/production p0-employee-join-inspect ${sourceRun} ${sourceRevision}`;
const registerCorrelation = 'p0-all-role-register:9639a2a3d06f:33293760567-1:employee';
const decisionCorrelation = 'p0-all-role-employee-join:9639a2a3d06f:33293760567-1';
const decisionEventKey = `org-join-decision:p0-all-role-employee-join:${sourceRevision}:${sourceRun}`;
const decisionApprovedEventKey = `${decisionEventKey}:approved`;

const requireMarkers = (source, markers, label) => {
  for (const marker of markers) {
    if (!source.includes(marker)) {
      console.error(`Missing ${label} marker: ${marker}`);
      process.exit(1);
    }
  }
};

requireMarkers(workflow, [
  'name: Production P0 Employee Join Inspect',
  'group: production-p0-employee-join-inspect',
  'github.event.issue.number == 4637',
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  `github.event.comment.body == '${command}'`,
  'permissions:\n  contents: read',
  'contents: read\n      issues: write',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER: ${{ github.event.issue.number }}',
  'node scripts/check-production-p0-reviewer-inspect.mjs',
  'bash -n scripts/production-p0-reviewer-inspect.sh',
  'bash scripts/production-p0-reviewer-inspect.sh',
], 'employee join inspect workflow');

const escapedCommand = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
if ((workflow.match(new RegExp(escapedCommand, 'g')) || []).length !== 2) {
  console.error('The exact one-shot command must guard both contract and inspect jobs.');
  process.exit(1);
}
for (const forbidden of [
  '/production p0-reviewer-inspect current-main',
  'scripts/production-p0-employee-join-state-inspect.sh',
  'github.event.issue.number == 3072',
  'reviewer login readiness',
]) {
  if (workflow.toLowerCase().includes(forbidden.toLowerCase())) {
    console.error(`Misleading legacy workflow path remains executable: ${forbidden}`);
    process.exit(1);
  }
}

requireMarkers(runner, [
  "DEFAULT_HOST='195.19.12.120'",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "CONTINUATION_ISSUE_NUMBER='4637'",
  `COMMAND='${command}'`,
  `JOIN_DIAG_SOURCE_RUN_ID='${sourceRun}'`,
  `JOIN_DIAG_SOURCE_REVISION='${sourceRevision}'`,
  "JOIN_DIAG_SINCE='2026-08-30T05:11:10Z'",
  "JOIN_DIAG_UNTIL='2026-08-30T05:11:25Z'",
  `REGISTER_CORRELATION='${registerCorrelation}'`,
  `DECISION_CORRELATION='${decisionCorrelation}'`,
  `DECISION_EVENT_KEY='${decisionEventKey}'`,
  `DECISION_APPROVED_EVENT_KEY='${decisionApprovedEventKey}'`,
  'gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha',
  'StrictHostKeyChecking=yes',
  'ssh-keyscan -T 10',
  'org.opencontainers.image.revision',
  'com.docker.compose.project',
  '--filter "label=com.docker.compose.project=$live_project"',
  'AUTH_DATABASE_URL',
  'DATABASE_URL',
  'authDatabaseUrl === applicationDatabaseUrl',
  'authDatabaseUser === applicationDatabaseUser',
  'new PrismaClient({ datasources: { db: { url: authDatabaseUrl } } })',
  "await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')",
  "current_setting('transaction_read_only') = 'on'",
  'current_user = session_user',
  "'SELECT current_user = $1::text AS auth_user_bound'",
  'FROM pg_catalog.pg_roles role',
  'NOT role.rolinherit',
  'FROM pg_catalog.pg_auth_members membership',
  'WHERE membership.member = role.oid',
  "role.rolname IN ('app_service', 'pc_auth_runtime', 'one_deal_auth', 'app_auth')",
  "current_user, 'auth.registration_applications', column_name, 'SELECT'",
  "current_user, 'auth.registration_application_events', column_name, 'SELECT'",
  "current_user, 'auth.registration_applications', column_name, 'UPDATE'",
  "current_user, 'auth.registration_application_events', column_name, 'INSERT'",
  "applicationSelectMap.get('organization_id')",
  "eventSelectMap.get('new_status')",
  "current_user, 'auth.registration_application_events', 'UPDATE'",
  'AUTH_RUNTIME_SELECTOR_MISS',
  'AUTH_EMPLOYEE_DIFFERENTIAL_MISSING',
  'AUTH_DECISION_SURFACE_COMPLETE',
  'AUTH_DECISION_PRIVILEGES|',
  'AUTH_EXACT_RUN_STATE|',
  'AMBIGUOUS_FIXED_WINDOW_QUERY_PRIVILEGE_SIGNAL',
  'AMBIGUOUS_PERMISSION_TEXT_ONLY',
  'AMBIGUOUS_FIXED_WINDOW_BUSINESS_SIGNAL',
  'historical log native class',
  'historical business class',
  'AUTH application.organization_id SELECT',
  'AUTH event.new_status SELECT',
  'raw identifiers, principals, URLs or error messages published: \\`0\\`',
  'employee join replay: \\`NONE\\`',
  'PRODUCTION_MUTATION=NONE',
  'trap cleanup EXIT',
  'rm -f -- "$key_path" "$known_hosts"',
], 'employee join inspect runner');

for (const exact of [sourceRevision, registerCorrelation, decisionCorrelation, decisionEventKey, decisionApprovedEventKey]) {
  const escaped = exact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if ((runner.match(new RegExp(escaped, 'g')) || []).length < 2) {
    console.error(`Exact diagnostic binding is not asserted locally and remotely: ${exact}`);
    process.exit(1);
  }
}

const orderedColumnMarkers = {
  applicationSelectOrder: [
    "'id', 'kind', 'user_id', 'organization_id', 'membership_id',",
    "'requested_workspace', 'requested_role', 'status', 'version', 'correlation_id',",
    "'email', 'decision_reason', 'decided_at',",
  ],
  applicationUpdateOrder: [
    "'status', 'decided_at', 'decision_reason', 'decision_actor_user_id', 'version', 'updated_at',",
  ],
  eventSelectOrder: [
    "'id', 'application_id', 'actor_user_id', 'actor_kind', 'previous_status', 'new_status',",
    "'reason', 'correlation_id', 'idempotency_key', 'application_version', 'metadata', 'created_at',",
  ],
  eventInsertOrder: [
    "'id', 'application_id', 'actor_user_id', 'actor_kind', 'previous_status', 'new_status',",
    "'reason', 'correlation_id', 'idempotency_key', 'application_version',",
  ],
};
for (const [name, markers] of Object.entries(orderedColumnMarkers)) {
  requireMarkers(runner, markers, name);
}
for (const vectorGuard of [
  '[[ "$auth_application_select_vector" =~ ^[01U]{13}$ ]]',
  '[[ "$auth_application_update_vector" =~ ^[01U]{6}$ ]]',
  '[[ "$auth_event_select_vector" =~ ^[01U]{12}$ ]]',
  '[[ "$auth_event_insert_vector" =~ ^[01U]{10}$ ]]',
]) {
  if (!runner.includes(vectorGuard)) {
    console.error(`Exact column privilege vector guard is missing: ${vectorGuard}`);
    process.exit(1);
  }
}

const nodeInspectorMatch = runner.match(
  /"\$api_id" \/nodejs\/bin\/node --input-type=commonjs - <<'NODE'\n([\s\S]*?)\nNODE/,
);
if (!nodeInspectorMatch) {
  console.error('AUTH_DATABASE_URL Node inspector is missing or not explicit CommonJS.');
  process.exit(1);
}
const nodeInspector = nodeInspectorMatch[1];
try {
  // Parse only; never execute the embedded inspector during contract checking.
  new Function('require', 'process', nodeInspector);
} catch (error) {
  console.error(`Embedded AUTH inspector is not valid JavaScript: ${error.name}`);
  process.exit(1);
}

if ((nodeInspector.match(/\$executeRawUnsafe\(/g) || []).length !== 1
    || !nodeInspector.includes("$executeRawUnsafe('SET TRANSACTION READ ONLY')")) {
  console.error('The only raw execute in the inspector must be SET TRANSACTION READ ONLY.');
  process.exit(1);
}
for (const pattern of [
  /console\.(?:log|error)\([^\n]*(?:authDatabaseUrl|applicationDatabaseUrl|authDatabaseUser|applicationDatabaseUser)/,
  /console\.(?:log|error)\([^\n]*(?:current_user|session_user|DATABASE_URL)/i,
  /console\.error\(\s*error\s*\)/,
  /error\.(?:message|stack)/,
  /JSON\.stringify\(\s*error/,
  /AS\s+(?:user_name|principal_name)/i,
]) {
  if (pattern.test(nodeInspector)) {
    console.error(`AUTH inspector may disclose a URL, principal or raw error: ${pattern}`);
    process.exit(1);
  }
}

const dataQueryMatch = nodeInspector.match(
  /SELECT\n\s+count\(DISTINCT application\.id\)[\s\S]*?WHERE application\.correlation_id = \$1::text/,
);
if (!dataQueryMatch) {
  console.error('Exact-run state proof must remain fixed-key and aggregate-only.');
  process.exit(1);
}
requireMarkers(dataQueryMatch[0], [
  "application.status = 'ORGANIZATION_VERIFICATION_PENDING'",
  "application.status = 'ACTIVATED'",
  'event.new_status',
  'application.organization_id IS NOT NULL',
  'event.correlation_id = $2::text',
  'event.idempotency_key IN ($3::text, $4::text)',
], 'aggregate exact-run state query');

for (const pattern of [
  /\bINSERT\s+INTO\s+(?:auth|public)\./i,
  /\bUPDATE\s+(?:auth|public)\./i,
  /\bDELETE\s+FROM\s+(?:auth|public)\./i,
  /\bCREATE\s+(?:ROLE|USER|TABLE|FUNCTION)\b/i,
  /\bALTER\s+(?:ROLE|USER|TABLE)\b/i,
  /\bDROP\s+(?:ROLE|USER|TABLE|FUNCTION)\b/i,
  /-X\s+POST\b/i,
  /curl[^\n]+--data/i,
  /bootstrap-platform-owner\.mjs/,
  /BOOTSTRAP_PLATFORM_OWNER_/,
  /PC_PROD_P0_(?:STAFF|REVIEWER)_(?:PASSWORD|TOTP_SECRET)/,
  /password_hash/i,
  /mfa_secret_ciphertext/i,
  /mfa_backup_hashes/i,
]) {
  if (pattern.test(workflow) || pattern.test(runner)) {
    console.error(`Employee join inspect is not bounded read-only: ${pattern}`);
    process.exit(1);
  }
}

// Capability lookups are permitted, but invoking any decision, row-lock,
// identity-transition or lifecycle-receipt function is not.
for (const pattern of [
  /FROM\s+auth\.lock_registration_decision_application\s*\(/i,
  /FROM\s+auth\.apply_registration_identity_transition\s*\(/i,
  /FROM\s+auth\.emit_registration_lifecycle_receipt\s*\(/i,
  /SELECT\s+auth\.(?:lock_registration_decision_application|apply_registration_identity_transition|emit_registration_lifecycle_receipt)\s*\(/i,
]) {
  if (pattern.test(nodeInspector)) {
    console.error(`Inspector must not invoke a registration mutation function: ${pattern}`);
    process.exit(1);
  }
}

if (!/permissions:\n\s+contents: read/.test(workflow)
    || !/permissions:\n\s+contents: read\n\s+issues: write/.test(workflow)) {
  console.error('Workflow permissions must remain contents:read plus inspect-only issues:write.');
  process.exit(1);
}

console.log(
  'PASS: employee join inspect is owner-only, exact-run/revision, pinned-SSH, '
  + 'AUTH_DATABASE_URL-bound, transaction-read-only, column-exact, aggregate-only, '
  + 'native/business-separated and mutation-free.',
);
