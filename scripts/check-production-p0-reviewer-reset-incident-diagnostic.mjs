#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-incident-diagnostic.yml';
const runnerPath = 'scripts/production-p0-reviewer-reset-incident-diagnostic.sh';
const checkerPath = 'scripts/check-production-p0-reviewer-reset-incident-diagnostic.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-incident-diagnostic-3785.json';
const branch = 'fix/p0-password-reset-production-diagnostic-3785-v2';
const paths = { workflow: workflowPath, runner: runnerPath, checker: checkerPath, scope: scopePath };
const content = {};
const failures = [];

for (const [name, filePath] of Object.entries(paths)) {
  if (!fs.existsSync(filePath)) failures.push(`${filePath}: missing`);
  else content[name] = fs.readFileSync(filePath, 'utf8');
}

const requireAll = (name, markers) => {
  for (const marker of markers) {
    if (!content[name]?.includes(marker)) failures.push(`${paths[name]}: missing ${JSON.stringify(marker)}`);
  }
};

requireAll('workflow', [
  'name: Production P0 Reviewer Reset Incident Diagnostic',
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  "github.event.comment.body == '/production p0-reviewer-reset-incident-diagnose 31635866371'",
  "node-version: '24'",
  'persist-credentials: false',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'PC_REVIEWER_RESET_INCIDENT_COMMAND: ${{ github.event.comment.body }}',
  `node ${checkerPath}`,
  `bash -n ${runnerPath}`,
  `bash ${runnerPath}`,
]);

requireAll('runner', [
  "DEFAULT_HOST='195.19.12.120'",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "RELEASE_ISSUE_NUMBER='3072'",
  "COMMAND='/production p0-reviewer-reset-incident-diagnose 31635866371'",
  "INCIDENT_RUN_ID='31635866371'",
  "INCIDENT_SINCE='2026-08-12T20:05:30Z'",
  "INCIDENT_UNTIL='2026-08-12T20:06:00Z'",
  "EXPECTED_DEPLOYED_SHA='58d7e1f80aa4482293e24eb7b0e111f7bf988d29'",
  'git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"',
  'StrictHostKeyChecking=yes',
  'UserKnownHostsFile="$known_hosts"',
  'for attempt in 1 2 3',
  '/usr/bin/ssh-keyscan -T 10 -p "$port" "$host"',
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  "--filter 'label=com.docker.compose.service=api'",
  'org.opencontainers.image.revision',
  "read -r -d '' env_classifier <<'PY_ENV' || true",
  "read -r -d '' incident_classifier <<'PY_INCIDENT' || true",
  "web.get('PASSWORD_RESET_DELIVERY_KEY', '').strip()",
  "api.get('PASSWORD_RESET_DELIVERY_KEY', '').strip()",
  'hmac.compare_digest(web_key, api_key)',
  "web.get('API_URL', '').strip()",
  "web.get('RESEND_API_KEY', '').strip()",
  "('PC_SMTP_HOST', 'PC_SMTP_USER', 'PC_SMTP_PASS')",
  'password_reset_request_configuration_error',
  'password_reset_request_api_failure',
  'password_reset_request_transport_failure',
  'password_reset_delivery_result',
  'password_reset_request_accepted_without_delivery',
  'docker logs --since "$incident_since" --until "$incident_until" "$web_id"',
  'RESET_INCIDENT_LOG|',
  'PRODUCTION_MUTATION=NONE',
  'auth/reset request replay: \\`NONE\\`',
  'raw environment/log output: \\`NOT_PUBLISHED\\`',
]);

const forbiddenRunnerPatterns = [
  /set\s+-[^\n]*x/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
  /sshpass/i,
  /docker\s+(?:compose|exec|restart|stop|kill|rm|rmi|update|run|start|create)\b/,
  /\bpsql\b/,
  /\b(?:curl|wget)\b/,
  /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\s+(?:INTO|TABLE|SCHEMA|ROLE|DATABASE|FROM)?\b/i,
  /source\s+[^\n]*\.env/,
  /\bprintenv\b/,
  /\/proc\/[0-9$]+\/environ/,
  /reviewer_email/i,
  /resetToken|passwordHash|mfaSecret|totpSecret/i,
  /raw environment\/log output:\s*\\`\$(?:output|config_marker|incident_marker)/,
];
for (const pattern of forbiddenRunnerPatterns) {
  if (pattern.test(content.runner ?? '')) failures.push(`${runnerPath}: forbidden ${pattern}`);
}

if (spawnSync('bash', ['-n', runnerPath], { encoding: 'utf8' }).status !== 0) {
  failures.push(`${runnerPath}: bash syntax invalid`);
}

const extractPython = (name, delimiter) => {
  const expression = new RegExp(`read -r -d '' ${name} <<'${delimiter}' \\|\\| true\\n([\\s\\S]*?)\\n${delimiter}`);
  const match = content.runner?.match(expression);
  if (!match) {
    failures.push(`${runnerPath}: missing Python block ${name}`);
    return '';
  }
  const syntax = spawnSync('python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], {
    input: match[1],
    encoding: 'utf8',
  });
  if (syntax.status !== 0) failures.push(`${runnerPath}: invalid Python block ${name}`);
  return match[1];
};

const envClassifier = extractPython('env_classifier', 'PY_ENV');
const incidentClassifier = extractPython('incident_classifier', 'PY_INCIDENT');
const secret = 'diagnostic-secret-value-that-must-never-be-printed';
const smtpPassword = 'diagnostic-smtp-password-that-must-never-be-printed';
const accountHash = 'diagnostic-account-hash-that-must-never-be-printed';
const token = 'diagnostic-reset-token-that-must-never-be-printed';

if (envClassifier) {
  const inspectFixture = (webKey, apiKey) => JSON.stringify([
    {
      Config: {
        Env: [
          'API_URL=http://api:3001',
          `PASSWORD_RESET_DELIVERY_KEY=${webKey}`,
          'PC_SMTP_HOST=mail.example.test',
          'PC_SMTP_USER=mailer@example.test',
          `PC_SMTP_PASS=${smtpPassword}`,
        ],
      },
    },
    { Config: { Env: [`PASSWORD_RESET_DELIVERY_KEY=${apiKey}`] } },
  ]);
  const ready = spawnSync('python3', ['-c', envClassifier], {
    input: inspectFixture(secret, secret),
    encoding: 'utf8',
  });
  if (ready.status !== 0 || ready.stdout.trim() !== 'RESET_INCIDENT_CONFIG|1|1|1|1|0|1|1') {
    failures.push(`${runnerPath}: ready environment classifier regression`);
  }
  const mismatch = spawnSync('python3', ['-c', envClassifier], {
    input: inspectFixture(secret, `${secret}-other`),
    encoding: 'utf8',
  });
  if (mismatch.status !== 0 || mismatch.stdout.trim() !== 'RESET_INCIDENT_CONFIG|1|1|1|0|0|1|1') {
    failures.push(`${runnerPath}: mismatched-key environment classifier regression`);
  }
  if (`${ready.stdout}${ready.stderr}${mismatch.stdout}${mismatch.stderr}`.includes(secret)
      || `${ready.stdout}${ready.stderr}${mismatch.stdout}${mismatch.stderr}`.includes(smtpPassword)) {
    failures.push(`${runnerPath}: environment classifier disclosed protected values`);
  }
}

if (incidentClassifier) {
  const correlationId = '05c8ad8f-be3d-4e44-bdab-2ea4b418b5af';
  const classify = (line) => spawnSync('python3', ['-c', incidentClassifier], {
    input: `${line}\n`,
    encoding: 'utf8',
  });
  const smtpFailure = classify(`password_reset_delivery_result ${JSON.stringify({
    correlationId,
    accountHash,
    delivered: false,
    provider: 'smtp',
    reason: 'smtp_failed:Error:smtp_535',
    token,
  })}`);
  if (smtpFailure.status !== 0
      || smtpFailure.stdout.trim() !== 'RESET_INCIDENT_LOG|DELIVERY_FAILED|SMTP_535|1|1') {
    failures.push(`${runnerPath}: SMTP failure incident classifier regression`);
  }
  const smtpSuccess = classify(`password_reset_delivery_result ${JSON.stringify({
    correlationId,
    accountHash,
    delivered: true,
    provider: 'smtp',
    reason: 'sent',
  })}`);
  if (smtpSuccess.status !== 0
      || smtpSuccess.stdout.trim() !== 'RESET_INCIDENT_LOG|DELIVERY_OK|SMTP_SENT|1|1') {
    failures.push(`${runnerPath}: SMTP success incident classifier regression`);
  }
  const accepted = classify(`password_reset_request_accepted_without_delivery ${JSON.stringify({ correlationId, accountHash })}`);
  if (accepted.status !== 0
      || accepted.stdout.trim() !== 'RESET_INCIDENT_LOG|ACCEPTED_WITHOUT_DELIVERY|NONE|1|1') {
    failures.push(`${runnerPath}: accepted-without-delivery classifier regression`);
  }
  const secondCorrelation = '15c8ad8f-be3d-4e44-bdab-2ea4b418b5af';
  const ambiguous = spawnSync('python3', ['-c', incidentClassifier], {
    input: [
      `password_reset_delivery_result ${JSON.stringify({ correlationId, accountHash, delivered: false, provider: 'smtp', reason: 'smtp_timeout' })}`,
      `password_reset_delivery_result ${JSON.stringify({ correlationId: secondCorrelation, accountHash, delivered: false, provider: 'smtp', reason: 'smtp_timeout' })}`,
    ].join('\n') + '\n',
    encoding: 'utf8',
  });
  if (ambiguous.status !== 0
      || ambiguous.stdout.trim() !== 'RESET_INCIDENT_LOG|AMBIGUOUS|MULTIPLE_CORRELATIONS|2|2') {
    failures.push(`${runnerPath}: multiple-correlation classifier regression`);
  }
  const combined = [smtpFailure, smtpSuccess, accepted, ambiguous]
    .map((result) => `${result.stdout}${result.stderr}`).join('');
  for (const protectedValue of [accountHash, token]) {
    if (combined.includes(protectedValue)) failures.push(`${runnerPath}: incident classifier disclosed protected runtime data`);
  }
}

try {
  const scope = JSON.parse(content.scope ?? '{}');
  const expectedPaths = [workflowPath, scopePath, checkerPath, runnerPath].sort();
  if (JSON.stringify([...(scope.allowedPaths ?? [])].sort()) !== JSON.stringify(expectedPaths)) {
    failures.push(`${scopePath}: allowedPaths mismatch`);
  }
  if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1'
      || scope.branch !== branch
      || scope.status !== 'active'
      || scope.operationalStatus !== 'P0_REVIEWER_RESET_INCIDENT_READ_ONLY_DIAGNOSTIC'
      || scope.issue !== 3785
      || scope.releaseIssue !== 3072
      || scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY'
      || scope.boundaries?.productionMutation !== 'NONE'
      || scope.boundaries?.databaseMutation !== false
      || scope.boundaries?.deploymentMutation !== false
      || scope.boundaries?.credentialMutation !== false
      || scope.boundaries?.sessionMutation !== false
      || scope.boundaries?.mfaMutation !== false
      || scope.boundaries?.piiOutput !== false
      || scope.boundaries?.credentialOutput !== false
      || scope.boundaries?.rawEnvironmentOutput !== false
      || scope.boundaries?.rawLogOutput !== false
      || scope.boundaries?.ownerOnly !== true
      || scope.boundaries?.exactMainGuard !== true
      || scope.boundaries?.newRecurringCostRub !== 0) {
    failures.push(`${scopePath}: metadata mismatch`);
  }
  if (scope.incident?.runId !== 31635866371
      || scope.incident?.sinceUtc !== '2026-08-12T20:05:30Z'
      || scope.incident?.untilUtc !== '2026-08-12T20:06:00Z'
      || scope.incident?.deployedRevision !== '58d7e1f80aa4482293e24eb7b0e111f7bf988d29') {
    failures.push(`${scopePath}: incident binding mismatch`);
  }
} catch (error) {
  failures.push(`${scopePath}: invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error('Production P0 reviewer reset incident diagnostic contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('PASS: fixed-incident diagnostic is owner-only, exact-main guarded and read-only; it publishes only allowlisted configuration booleans and sanitized incident classes without auth replay, production mutation, PII, secrets or raw logs.');
