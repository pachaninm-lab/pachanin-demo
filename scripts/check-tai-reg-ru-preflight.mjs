#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/tai-reg-ru-preflight.yml';
const scriptPath = 'scripts/tai-reg-ru-preflight.sh';
const bootstrapPath = 'scripts/install-pc-prod-actions-runner.sh';
const workflow = readFileSync(workflowPath, 'utf8');
const script = readFileSync(scriptPath, 'utf8');
const bootstrap = readFileSync(bootstrapPath, 'utf8');
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
  "github.event.workflow_run.event == 'push'",
  'workflow_dispatch:',
  "inputs.confirmation == 'PREFLIGHT-TAI-REG-RU'",
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  '[[ "$target" == "$(git rev-parse origin/main)" ]]',
  'permissions:',
  'contents: read',
  'packages: read',
  'statuses: write',
  'image-authority:',
  'Verify canonical exact-SHA TAI image outside production',
  'needs: [contract, image-authority]',
  'Initialize fail-closed evidence',
  'PREFLIGHT_NOT_EXECUTED',
  'runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]',
  'Verify local production runner authority',
  '[[ "${RUNNER_NAME:-}" == pc-prod-* ]]',
  '[[ "$(id -u)" -ne 0 ]]',
  'clean: true',
  'ghcr.io/pachaninm-lab/grainflow-tai:sha-${SHORT_SHA}',
  'TAI_IMAGE: ${{ needs.image-authority.outputs.reference }}',
  'TAI_DIGEST: ${{ needs.image-authority.outputs.digest }}',
  '"$user" == \'65532:65532\'',
  'Execute local read-only production preflight',
  'bash scripts/tai-reg-ru-preflight.sh',
  'PREFLIGHT_EXECUTION_FAILED',
  'Upload redacted preflight evidence',
  'publish-status:',
  'Publish exact-main preflight commit status',
  'actions/download-artifact@v4',
  "context='TAI REG.RU Preflight'",
  "if: always() && github.event_name == 'workflow_dispatch'",
  'Remove transient runner material',
  'rm -f "$RUNNER_TEMP/tai-reg-ru-preflight.json"',
  'statuses: none',
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

for (const fragment of [
  'RUNNER_VERSION="2.336.0"',
  'RUNNER_PACKAGE_SHA256="04cf0be1aff4c3ec3554466c39124ca250e3effd8873bb7e8d68535aa9505d5d"',
  'RUNNER_REGISTRATION_TOKEN',
  '--labels "pc-prod,tai-readonly"',
  './svc.sh install "$RUNNER_USER"',
  'sudo -u "$RUNNER_USER" -H docker version',
  'NoNewPrivileges=true',
  'ProtectKernelTunables=true',
  'ProtectKernelModules=true',
  'ProtectControlGroups=true',
]) requireFragment(bootstrap, fragment, bootstrapPath);

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
forbid(
  workflow,
  /PC_PROD_SSH_|ssh-keyscan|StrictHostKeyChecking|id_pc_prod|\bscp\b|\bssh\s+-/u,
  `${workflowPath}: inbound SSH transport is forbidden`,
);
forbid(
  workflow,
  /\bsudo\b/u,
  `${workflowPath}: live preflight must not escalate privileges`,
);
forbid(
  workflow,
  /pull_request_target:/u,
  `${workflowPath}: pull_request_target is forbidden`,
);

for (const line of workflow.split('\n')) {
  if (/\|\|\s*true/u.test(line)) {
    violations.push(`${workflowPath}: suppressed failure is forbidden: ${line.trim()}`);
  }
}

const liveWorkflow = (workflow.split('\n  live-preflight:\n')[1] || '').split('\n  publish-status:\n')[0];
forbid(
  liveWorkflow,
  /\bdocker\s+(?:login|pull|run|start|stop|restart|kill|rm|update)\b/iu,
  `${workflowPath}: production runner must not mutate Docker state`,
);
forbid(
  liveWorkflow,
  /GH_TOKEN|DOCKER_CONFIG|github\.token/u,
  `${workflowPath}: production runner must not receive registry credentials`,
);

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
forbid(bootstrap, /set\s+-[^\n]*x/iu, `${bootstrapPath}: shell tracing is forbidden`);
forbid(
  bootstrap,
  /echo[^\n]*(?:RUNNER_REGISTRATION_TOKEN|registration_token|token=)/iu,
  `${bootstrapPath}: registration token must not be printed`,
);

if (violations.length > 0) {
  console.error('TAI REG.RU preflight contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TAI REG.RU preflight contract PASS: exact-main, local outbound-only runner, read-only, redacted, automatic and fail-closed.');
