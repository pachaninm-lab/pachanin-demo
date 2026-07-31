#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/tai-reg-ru-preflight.yml';
const scriptPath = 'scripts/tai-reg-ru-preflight.sh';
const workflow = readFileSync(workflowPath, 'utf8');
const script = readFileSync(scriptPath, 'utf8');
const violations = [];

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) violations.push(`${label}: missing ${JSON.stringify(fragment)}`);
}

function forbid(source, pattern, label) {
  if (pattern.test(source)) violations.push(label);
}

for (const fragment of [
  'workflow_run:',
  'workflows: ["Build & Publish Canonical Docker Images"]',
  'github.event.workflow_run.conclusion == \'success\'',
  'github.event.workflow_run.head_branch == \'main\'',
  'workflow_dispatch:',
  "inputs.confirmation == 'PREFLIGHT-TAI-REG-RU'",
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  '[[ "$target" == "$(git rev-parse origin/main)" ]]',
  'permissions:',
  'contents: read',
  'packages: read',
  'statuses: write',
  'ghcr.io/pachaninm-lab/grainflow-tai:sha-${SHORT_SHA}',
  '"$user" == \'65532:65532\'',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'StrictHostKeyChecking=yes',
  'Upload redacted preflight evidence',
  'Publish exact-main preflight commit status',
  "context='TAI REG.RU Preflight'",
  "if: github.event_name == 'workflow_dispatch'",
]) requireFragment(workflow, fragment, workflowPath);

for (const fragment of [
  'tai.reg-ru.preflight.v1',
  'READ_ONLY_PREFLIGHT',
  'productionMutationAllowed',
  'snapshot_containers',
  'compose-hash.before',
  'compose-hash.after',
  'NO_PRODUCTION_MUTATION_DETECTED',
  'TAI_SERVICE_NOT_MATERIALIZED',
  'TAI_DEDICATED_ENV_NOT_MATERIALIZED',
  'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED',
  'API_TO_PRIVATE_MODEL_HEALTHY',
  'API_WEB_EXACT_MAIN',
  'SET TRANSACTION READ ONLY',
  "namespace.nspname = 'public'",
  'admission.artifact_sha256 = profile.artifact_sha256',
  'ACTIVE_MODEL_IDENTITY_MATCHED',
  'MODEL_ADMISSION_ACCEPTED',
  'ACTIVE_KNOWLEDGE_READY',
]) requireFragment(script, fragment, scriptPath);

forbid(
  workflow,
  /^\s*(?:actions|checks|deployments|id-token|issues|pull-requests|security-events):\s*write\s*$/mu,
  `${workflowPath}: unapproved write permission is forbidden`,
);
forbid(
  workflow,
  /continue-on-error:\s*true/mu,
  `${workflowPath}: continue-on-error is forbidden`,
);

for (const line of workflow.split('\n')) {
  if (!/\|\|\s*true/u.test(line)) continue;
  const approvedAlternativeDecode = line.includes('base64 --decode > "$c"');
  const approvedFingerprintParse = line.includes('ssh-keygen -lf - -E sha256');
  const approvedHostKeyMatchCount = line.includes('grep -c . "$match"');
  if (
    !approvedAlternativeDecode
    && !approvedFingerprintParse
    && !approvedHostKeyMatchCount
  ) {
    violations.push(`${workflowPath}: unapproved suppressed failure: ${line.trim()}`);
  }
}

const allowedTemporaryCleanup = 'trap \'rm -rf "$work"\' EXIT';
const normalizedScript = script
  .replace(/^\s*#.*$/gmu, '')
  .replace(allowedTemporaryCleanup, '');

for (const [pattern, label] of [
  [
    /\bdocker\s+compose\b[^\n]*(?:\bup\b|\bdown\b|\brestart\b|\bpull\b|\bcreate\b|\brm\b)/iu,
    'production Docker Compose mutation',
  ],
  [
    /\bdocker\s+(?:start|stop|restart|kill|rm|update|run|pull)\b/iu,
    'production container or image mutation',
  ],
  [
    /\bsystemctl\s+(?:start|stop|restart|enable|disable|daemon-reload)\b/iu,
    'systemd mutation',
  ],
  [
    /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/iu,
    'PostgreSQL mutation statement',
  ],
  [
    /\b(?:install|cp|mv|chmod|chown|truncate)\s+[^\n]*\/(?:etc|srv|opt|var|home|root)\b/iu,
    'production filesystem mutation',
  ],
  [/\b(?:kill|pkill|killall)\b/iu, 'process mutation'],
]) forbid(normalizedScript, pattern, `${scriptPath}: forbidden ${label}`);

forbid(
  script,
  /docker\s+inspect[^\n]*\.Config\.Env[^\n]*>\s*\/dev\/stdout/iu,
  `${scriptPath}: container environment must not be printed`,
);
forbid(script, /set\s+-[^\n]*x/iu, `${scriptPath}: shell tracing is forbidden`);
forbid(
  script,
  /(?:password|secret|api_key|database_url)\s*=.*(?:echo|printf)/iu,
  `${scriptPath}: secret-like values must not be printed`,
);

if (violations.length > 0) {
  console.error('TAI REG.RU preflight contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TAI REG.RU preflight contract PASS: exact-main, read-only, redacted, automatic and fail-closed.');
