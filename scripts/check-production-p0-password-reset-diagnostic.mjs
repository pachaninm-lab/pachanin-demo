#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-password-reset-diagnostic.yml';
const runnerPath = 'scripts/production-p0-password-reset-diagnostic.sh';
const checkerPath = 'scripts/check-production-p0-password-reset-diagnostic.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-password-reset-diagnostic-3785.json';
const branch = 'fix/p0-password-reset-production-diagnostic-3785';
const governanceMerge = 'ce4de5abc5fc84faa07c6713c4ebb3d1bb5a0ff7';

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
  'name: Production P0 Password Reset Diagnostic',
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  "startsWith(github.event.comment.body, '/production p0-password-reset-diagnose current-main ')",
  'permissions:\n  contents: read',
  'issues: write',
  'cancel-in-progress: false',
  'persist-credentials: false',
  'PC_PASSWORD_RESET_DIAGNOSTIC_COMMAND: ${{ github.event.comment.body }}',
  `node ${checkerPath}`,
  `bash -n ${runnerPath}`,
  `bash ${runnerPath}`,
]);

requireAll('runner', [
  "COMMAND_PREFIX='/production p0-password-reset-diagnose current-main '",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "RELEASE_ISSUE_NUMBER='3072'",
  'git fetch --no-tags origin main',
  'StrictHostKeyChecking=yes',
  "docker ps -q --filter 'label=com.docker.compose.service=web'",
  "--filter 'label=com.docker.compose.service=api'",
  'org.opencontainers.image.revision',
  "read -r -d '' env_classifier <<'PY_ENV' || true",
  "read -r -d '' log_classifier <<'PY_LOG' || true",
  "web.get('PASSWORD_RESET_DELIVERY_KEY', '').strip()",
  "api.get('PASSWORD_RESET_DELIVERY_KEY', '').strip()",
  "hmac.compare_digest(web_key, api_key)",
  "web.get('API_URL', '').strip()",
  "web.get('RESEND_API_KEY', '').strip()",
  "('PC_SMTP_HOST', 'PC_SMTP_USER', 'PC_SMTP_PASS')",
  'password_reset_request_configuration_error',
  'password_reset_request_api_failure',
  'password_reset_request_transport_failure',
  "docker logs --since 24h \"$web_id\" 2>&1 | python3 -c \"$log_classifier\" \"$correlation_id\"",
  'PRODUCTION_MUTATION=NONE',
  "blocker='WEB_DELIVERY_KEY_MISSING'",
  "blocker='API_DELIVERY_KEY_MISSING'",
  "blocker='DELIVERY_KEY_MISMATCH'",
  "blocker='WEB_MAIL_CHANNEL_MISSING'",
  'raw environment/log output: \\`NOT_PUBLISHED\\`',
]);

const forbiddenRunnerPatterns = [
  /set\s+-[^\n]*x/,
  /StrictHostKeyChecking=no/,
  /sshpass/i,
  /docker\s+(?:compose|restart|stop|kill|rm|rmi|exec|update|run)\b/,
  /\bpsql\b/,
  /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\s+(?:INTO|TABLE|SCHEMA|ROLE|DATABASE|FROM)?\b/i,
  /source\s+[^\n]*\.env/,
  /cat\s+[^\n]*(?:\.env|docker\.logs)/i,
  /raw environment\/log output:\s*\\`\$(?:output|config_marker|log_marker)/,
  /password:\s*\\`\$/i,
  /token:\s*\\`\$/i,
];
for (const pattern of forbiddenRunnerPatterns) {
  if (pattern.test(content.runner ?? '')) failures.push(`${runnerPath}: forbidden ${pattern}`);
}

if (spawnSync('bash', ['-n', runnerPath], { encoding: 'utf8' }).status !== 0) {
  failures.push(`${runnerPath}: bash syntax invalid`);
}

const extractPython = (name) => {
  const expression = new RegExp(`read -r -d '' ${name} <<'PY_[A-Z]+' \\|\\| true\\n([\\s\\S]*?)\\nPY_[A-Z]+`);
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

const envClassifier = extractPython('env_classifier');
const logClassifier = extractPython('log_classifier');
const secret = 'diagnostic-secret-value-that-must-never-be-printed';
const smtpPassword = 'diagnostic-smtp-password-that-must-never-be-printed';

if (envClassifier) {
  const inspectFixture = (webKey, apiKey) => JSON.stringify([
    {
      Config: {
        Env: [
          'API_URL=http://api:3001',
          `PASSWORD_RESET_DELIVERY_KEY=${webKey}`,
          'PC_SMTP_HOST=smtp.example.test',
          'PC_SMTP_USER=mailer',
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
  if (ready.status !== 0 || ready.stdout.trim() !== 'PASSWORD_RESET_CONFIG|1|1|1|1|1') {
    failures.push(`${runnerPath}: ready environment classifier regression`);
  }
  const missing = spawnSync('python3', ['-c', envClassifier], {
    input: inspectFixture('', ''),
    encoding: 'utf8',
  });
  if (missing.status !== 0 || missing.stdout.trim() !== 'PASSWORD_RESET_CONFIG|1|0|0|0|1') {
    failures.push(`${runnerPath}: missing-key environment classifier regression`);
  }
  if (`${ready.stdout}${ready.stderr}${missing.stdout}${missing.stderr}`.includes(secret)
      || `${ready.stdout}${ready.stderr}${missing.stdout}${missing.stderr}`.includes(smtpPassword)) {
    failures.push(`${runnerPath}: environment classifier disclosed a protected value`);
  }
}

if (logClassifier) {
  const correlationId = '05c8ad8f-be3d-4e44-bdab-2ea4b418b5af';
  const rawSecret = 'raw-account-hash-or-token';
  const configLine = `password_reset_request_configuration_error ${JSON.stringify({
    correlationId,
    apiConfigured: true,
    deliveryBoundaryConfigured: false,
    mailConfigured: true,
    accountHash: rawSecret,
  })}\n`;
  const classified = spawnSync('python3', ['-c', logClassifier, correlationId], {
    input: configLine,
    encoding: 'utf8',
  });
  if (classified.status !== 0
      || classified.stdout.trim() !== 'PASSWORD_RESET_LOG|CONFIGURATION_ERROR|1|0|1|NONE') {
    failures.push(`${runnerPath}: configuration log classifier regression`);
  }
  const apiFailure = spawnSync('python3', ['-c', logClassifier, correlationId], {
    input: `password_reset_request_api_failure ${JSON.stringify({ correlationId, status: 503, accountHash: rawSecret })}\n`,
    encoding: 'utf8',
  });
  if (apiFailure.status !== 0
      || apiFailure.stdout.trim() !== 'PASSWORD_RESET_LOG|API_FAILURE|NONE|NONE|NONE|503') {
    failures.push(`${runnerPath}: API failure log classifier regression`);
  }
  if (`${classified.stdout}${classified.stderr}${apiFailure.stdout}${apiFailure.stderr}`.includes(rawSecret)) {
    failures.push(`${runnerPath}: log classifier disclosed raw runtime data`);
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
      || scope.operationalStatus !== 'P0_PASSWORD_RESET_PRODUCTION_READ_ONLY_DIAGNOSTIC'
      || scope.issue !== 3785
      || scope.releaseIssue !== 3072
      || scope.governancePr !== 3875
      || scope.governanceMerge !== governanceMerge
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
} catch (error) {
  failures.push(`${scopePath}: invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error('Production P0 password-reset diagnostic contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('PASS: the owner-only exact-main diagnostic reads only bounded API/Web revision, reset dependency booleans and an allowlisted correlated failure class without production mutation or secret/PII output.');
