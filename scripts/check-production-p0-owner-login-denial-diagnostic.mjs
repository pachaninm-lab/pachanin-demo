#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-owner-login-denial-diagnostic.yml';
const runnerPath = 'scripts/production-p0-owner-login-denial-diagnostic.sh';
const checkerPath = 'scripts/check-production-p0-owner-login-denial-diagnostic.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-owner-login-denial-diagnostic-3785.json';
const branch = 'fix/pc-crop-owner-login-diagnostic-3785';
const command = '/production p0-owner-login-denial-diagnose current-main';
const runtimeBase = 'ee1fbecac8ae301102e451b78351a0e51ebe2060';
const attemptSince = '2026-08-22T18:04:00Z';
const attemptUntil = '2026-08-22T18:08:59Z';
const allowedPaths = [workflowPath, scopePath, checkerPath, runnerPath];
const runtimeNeutralDelta = [
  workflowPath,
  'apps/web/tests/e2e/platform-v7-public-intelligence-layer.spec.ts',
  'apps/web/tests/e2e/support/acceptance-login.ts',
  'docs/platform-v7/autopilot/scopes/design-v8-acceptance-csrf-faq-4503.json',
  scopePath,
  checkerPath,
  runnerPath,
];

const failures = [];
const read = (file) => {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: missing`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
};
const workflow = read(workflowPath);
const runner = read(runnerPath);
const checker = read(checkerPath);
const scopeText = read(scopePath);

const requireTokens = (label, source, tokens) => {
  for (const token of tokens) {
    if (!source.includes(token)) failures.push(`${label}: missing ${JSON.stringify(token)}`);
  }
};
const forbid = (label, source, patterns) => {
  for (const pattern of patterns) {
    if (pattern.test(source)) failures.push(`${label}: forbidden ${pattern}`);
  }
};
const sameStrings = (left, right) => (
  Array.isArray(left)
  && left.every((value) => typeof value === 'string')
  && JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
);

requireTokens('workflow', workflow, [
  'name: Production P0 Owner Login-Denial Diagnostic',
  'pull_request:',
  'issue_comment:',
  'permissions:\n  contents: read',
  "github.event.issue.number == 3072",
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.author_association == 'OWNER'",
  'github.event.comment.performed_via_github_app.id == 1144995',
  `github.event.comment.body == '${command}'`,
  'cancel-in-progress: false',
  'persist-credentials: false',
  'fetch-depth: 0',
  `node ${checkerPath}`,
  `bash -n ${runnerPath}`,
  `bash ${runnerPath}`,
  'PC_PROD_SSH_HOST_FINGERPRINT: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
  'issues: write',
]);
for (const file of allowedPaths) requireTokens('workflow', workflow, [`      - '${file}'`]);
if (workflow.split(command).length - 1 !== 3) failures.push('workflow: command cardinality must be 3');
const secretNames = [...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]);
const allowedSecrets = [
  'PC_PROD_HOST', 'PC_PROD_SSH_USER', 'PC_PROD_SSH_PORT',
  'PC_PROD_SSH_KEY', 'PC_PROD_SSH_PRIVATE_KEY', 'VPS_SSH_KEY',
  'PC_PROD_SSH_HOST_FINGERPRINT',
];
if (!sameStrings([...new Set(secretNames)], allowedSecrets)) failures.push('workflow: secret allowlist mismatch');
forbid('workflow', workflow, [
  /workflow_dispatch:/,
  /schedule:/,
  /\bpush:/,
  /actions\/upload-artifact/,
  /PC_P0_REVIEWER_(?:EMAIL|PASSWORD|TOTP)/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
]);

requireTokens('runner', runner, [
  `COMMAND='${command}'`,
  `RUNTIME_BASE_SHA='${runtimeBase}'`,
  `ATTEMPT_SINCE='${attemptSince}'`,
  `ATTEMPT_UNTIL='${attemptUntil}'`,
  "DEFAULT_HOST='195.19.12.120'",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "RELEASE_ISSUE_NUMBER='3072'",
  'git merge-base --is-ancestor "$RUNTIME_BASE_SHA" "$TARGET_SHA"',
  'git diff --name-only "$RUNTIME_BASE_SHA" "$TARGET_SHA"',
  '[[ "${runtime_delta[*]}" == "${allowed_runtime_delta[*]}" ]]',
  'StrictHostKeyChecking=yes',
  'UserKnownHostsFile="$known_hosts"',
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  "--filter 'label=com.docker.compose.service=api'",
  'org.opencontainers.image.revision',
  '[[ "$api_revision" == "$runtime_base" && "$web_revision" == "$runtime_base" ]]',
  'docker logs --since "$attempt_since" --until "$attempt_until" --timestamps "$web_id"',
  "'control_plane_login_denied'",
  "counts = {'csrf': 0, 'credentials': 0, 'rate_limited': 0}",
  "docker exec -i \"$api_id\" /nodejs/bin/node --input-type=commonjs - \"$attempt_since\" \"$attempt_until\"",
  '-c default_transaction_read_only=on',
  "current_setting('transaction_read_only') = 'on'",
  "auth.staff_reviewer_preflight()",
  "auth.staff_reviewer_login_readiness()",
  "counts.join('|') !== '1|1|1|1|1|1|0|0'",
  "FROM auth.sessions",
  "membership_id = 'membership_pc_reviewer_internal_v1'",
  "organization_id = 'org_pc_internal_platform_v1'",
  "has_table_privilege(current_user, 'auth.sessions', 'SELECT')",
  "has_table_privilege(current_user, 'auth.login_throttles', 'SELECT')",
  "has_table_privilege(current_user, 'auth.audit_events', 'SELECT')",
  "metadata->>'accountHash' ~ '^[a-f0-9]{64}$'",
  "ORDER BY created_at DESC",
  "FROM auth.login_throttles",
  "FROM auth.audit_events",
  "action = 'auth.login'",
  "'INVALID_CREDENTIALS'",
  "'ACCOUNT_TEMPORARILY_LOCKED'",
  "const denialRows = auditRows.filter",
  "outcome === 'FAILURE' || outcome === 'DENIED'",
  "return { total: denialRows.length",
  "classification='AMBIGUOUS_OR_NO_EVENT'",
  "classification='ACCOUNT_TEMPORARILY_LOCKED'",
  "classification='INVALID_CREDENTIALS_AND_ACCOUNT_NOW_LOCKED'",
  "classification='INVALID_CREDENTIALS'",
  "^(CLEAR|PARTIAL|LOCKED|EXPIRED|UNAVAILABLE)$",
  'owner identity / email / account hash exposure: \\`NONE\\`',
  'password / TOTP / cookie / token exposure: \\`NONE\\`',
  'raw Docker / database / log output: \\`NOT_PUBLISHED\\`',
  'login / reset / recovery replay: \\`NONE\\`',
  'PRODUCTION_MUTATION=NONE',
]);
for (const file of runtimeNeutralDelta) {
  requireTokens('runner', runner, [`  '${file}'`]);
}
forbid('runner', runner, [
  /set\s+-[^\n]*x/,
  /StrictHostKeyChecking=no/,
  /sshpass/i,
  /docker\s+(?:compose|restart|stop|kill|rm|rmi|update|run)\b/,
  /\bpsql\b/,
  /\b(?:INSERT\s+INTO|UPDATE\s+(?:auth|public)\.|DELETE\s+FROM|ALTER\s+(?:TABLE|ROLE)|CREATE\s+(?:TABLE|ROLE)|DROP\s+(?:TABLE|ROLE)|TRUNCATE\s+)/i,
  /\/api\/auth\/(?:login|forgot-password|password-reset|mfa)/,
  /forgot-password/i,
  /password-reset\/request/i,
  /recovery\/request/i,
  /FROM\s+public\."?(?:users|user_orgs)"?/i,
  /process\.env\.AUTH_TOKEN_PEPPER/,
  /createHmac\s*\(/,
  /raw Docker \/ database \/ log output:\s*\\`\$(?:output|web_marker|db_marker)/,
  /owner (?:email|identity):\s*\\`\$/i,
  /account hash:\s*\\`\$/i,
  /classification='CSRF_REJECTED_BEFORE_AUTH'/,
  /classification='IP_RATE_LIMITED_BEFORE_AUTH'/,
]);

if (spawnSync('bash', ['-n', runnerPath], { encoding: 'utf8' }).status !== 0) {
  failures.push('runner: bash syntax invalid');
}

const pythonMatch = runner.match(/read -r -d '' log_classifier <<'PY_LOG' \|\| true\n([\s\S]*?)\nPY_LOG/);
if (!pythonMatch) {
  failures.push('runner: log classifier block missing');
} else {
  const classifier = pythonMatch[1];
  const syntax = spawnSync('python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], {
    input: classifier,
    encoding: 'utf8',
  });
  if (syntax.status !== 0) failures.push('runner: log classifier Python syntax invalid');
  const fixture = [
    '2026-08-22T18:05:01Z control_plane_login_denied {"correlationId":"do-not-print","reason":"credentials"}',
    '2026-08-22T18:05:02Z unrelated {"email":"must-not-print@example.test"}',
  ].join('\n');
  const classified = spawnSync('python3', ['-c', classifier], { input: fixture, encoding: 'utf8' });
  if (classified.status !== 0
      || classified.stdout.trim() !== 'OWNER_LOGIN_WEB|PASS|1|0|1|0|CREDENTIALS') {
    failures.push('runner: log classifier fixture regression');
  }
  if (`${classified.stdout}${classified.stderr}`.includes('do-not-print')
      || `${classified.stdout}${classified.stderr}`.includes('must-not-print')) {
    failures.push('runner: log classifier disclosed raw data');
  }
  for (const invalidFixture of [
    'control_plane_login_denied missing-json',
    'control_plane_login_denied {not-json}',
    'control_plane_login_denied {"reason":"unknown"}',
  ]) {
    const rejected = spawnSync('python3', ['-c', classifier], {
      input: invalidFixture,
      encoding: 'utf8',
    });
    if (rejected.status === 0) failures.push(`runner: malformed denial marker accepted: ${invalidFixture}`);
  }
}

try {
  const scope = JSON.parse(scopeText);
  if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
      || scope.branch !== branch
      || scope.status !== 'active'
      || scope.operationalStatus !== 'P0_OWNER_LOGIN_DENIAL_READ_ONLY_DIAGNOSTIC'
      || scope.issue !== 3785
      || scope.releaseIssue !== 3072
      || scope.authorityBaseExactMain !== runtimeBase
      || scope.productionRuntimePolicy !== 'API_WEB_MUST_EQUAL_REVIEWED_RUNTIME_BASE_WITH_EXACT_RUNTIME_NEUTRAL_MAIN_DELTA'
      || scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY'
      || scope.newRecurringCostRub !== 0
      || !sameStrings(scope.allowedPaths, allowedPaths)
      || !sameStrings(scope.runtimeNeutralDeltaAllowlist, runtimeNeutralDelta)
      || scope.boundaries?.ownerOnly !== true
      || scope.boundaries?.trustedConnectorAllowed !== true
      || scope.boundaries?.exactMainGuard !== true
      || scope.boundaries?.pinnedSsh !== true
      || scope.boundaries?.fixedAttemptWindowUtc !== `${attemptSince}/${attemptUntil}`
      || scope.boundaries?.deployedRuntimeBase !== runtimeBase
      || scope.boundaries?.runtimeNeutralDeltaOnly !== true
      || scope.boundaries?.productionMutation !== 'NONE'
      || scope.boundaries?.databaseTransactionReadOnly !== true
      || scope.boundaries?.loginReplay !== false
      || scope.boundaries?.passwordResetOrRecovery !== false
      || scope.boundaries?.credentialMutation !== false
      || scope.boundaries?.sessionMutation !== false
      || scope.boundaries?.mfaMutation !== false
      || scope.boundaries?.roleOrMembershipMutation !== false
      || scope.boundaries?.piiOutput !== false
      || scope.boundaries?.credentialOutput !== false
      || scope.boundaries?.rawEnvironmentOutput !== false
      || scope.boundaries?.rawLogOutput !== false
      || scope.boundaries?.newRecurringCostRub !== 0) {
    failures.push('scope: metadata or boundary mismatch');
  }
} catch (error) {
  failures.push(`scope: invalid JSON: ${error.message}`);
}

if (!checker.includes('P0_OWNER_LOGIN_DENIAL_READ_ONLY_DIAGNOSTIC')) {
  failures.push('checker: self-contract marker missing');
}

if (failures.length) {
  console.error('Production P0 owner login-denial diagnostic contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('PASS: owner-only exact-main diagnostic classifies one bounded existing login denial from allowlisted runtime and read-only database aggregates without replay, mutation, PII, credential or raw-log output.');
