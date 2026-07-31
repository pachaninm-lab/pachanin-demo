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
  'image_authority:',
  'Verify canonical exact-SHA TAI image outside production',
  'Publish local-runner pending status',
  'runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]',
  'packages: none',
  'statuses: none',
  'Verify local production runner authority',
  '[[ "${RUNNER_NAME:-}" == pc-prod-* ]]',
  '[[ "$(id -u)" -ne 0 ]]',
  '/etc/pc-release-authority/actions-runner.json',
  'PREFLIGHT_NOT_EXECUTED',
  'PREFLIGHT_EXECUTION_FAILED',
  'ghcr.io/pachaninm-lab/grainflow-tai:sha-${SHORT_SHA}',
  '"$user" == \'65532:65532\'',
  'Execute local read-only production preflight',
  'Upload redacted preflight evidence',
  'Publish exact-main preflight commit status',
  "context='TAI REG.RU Preflight'",
  "if: always() && github.event_name == 'workflow_dispatch'",
]) requireFragment(workflow, fragment, workflowPath);

for (const fragment of [
  'tai.reg-ru.preflight.v1',
  'READ_ONLY_PREFLIGHT',
  'productionMutationAllowed',
  'snapshot_containers',
  'compose-hash.before',
  'compose-hash.after',
  'NO_PRODUCTION_MUTATION_DETECTED',
  'compose.tai-agro-os.override.yml',
  'TAI_OVERRIDE_PROTECTED',
  'TAI_OVERRIDE_PROTECTION_INVALID',
  'TAI_SERVICE_NOT_MATERIALIZED',
  'TAI_SERVICE_DECLARED',
  'TAI_RUNTIME_HEALTHY',
  'TAI_RUNTIME_EXACT_MAIN',
  'TAI_RUNTIME_ISOLATED',
  'TAI_DEDICATED_ENV_NOT_MATERIALIZED',
  'TAI_DEDICATED_ENV_MATERIALIZED',
  'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED',
  'TAI_DEDICATED_DB_PRINCIPAL_ATTESTED',
  'TAI_READINESS_READY',
  'TAI_READINESS_BLOCKED',
  'API_TO_PRIVATE_MODEL_HEALTHY',
  'API_WEB_EXACT_MAIN',
  'SET TRANSACTION READ ONLY',
  "namespace.nspname = 'public'",
  'admission.artifact_sha256 = profile.artifact_sha256',
  'ACTIVE_MODEL_IDENTITY_MATCHED',
  'MODEL_ADMISSION_ACCEPTED',
  'ACTIVE_KNOWLEDGE_READY',
  'expected_image_id=',
  'expected_repo_digest=',
  '"$tai_container_image_id" == "$expected_image_id"',
  '"$tai_config_image" == "$TAI_IMAGE_DIGEST"',
  'docker port "$tai_id"',
  'rolinherit',
  'has_table_privilege',
  "relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'",
  "components.get('tools') == 'disabled-safe'",
]) requireFragment(script, fragment, scriptPath);

for (const fragment of [
  'RUNNER_VERSION="2.336.0"',
  'RUNNER_PACKAGE_SHA256="04cf0be1aff4c3ec3554466c39124ca250e3effd8873bb7e8d68535aa9505d5d"',
  'RUNNER_REGISTRATION_TOKEN',
  '[[ "$(id -u)" -eq 0 ]]',
  'install -d -m 0750 -o root -g root "$RUNNER_ROOT"',
  '"$RUNNER_ROOT/bin/installdependencies.sh"',
  'chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT"',
  '--labels "pc-prod,tai-readonly"',
  './svc.sh install "$RUNNER_USER"',
  'NoNewPrivileges=true',
  'ProtectKernelTunables=true',
  'ProtectKernelModules=true',
  'ProtectControlGroups=true',
  'TRANSPORT=OUTBOUND_ONLY',
]) requireFragment(bootstrap, fragment, bootstrapPath);

const dependencyInstallIndex = bootstrap.indexOf('"$RUNNER_ROOT/bin/installdependencies.sh"');
const ownershipTransferIndex = bootstrap.indexOf('chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT"');
if (
  dependencyInstallIndex < 0
  || ownershipTransferIndex < 0
  || dependencyInstallIndex > ownershipTransferIndex
) {
  violations.push(`${bootstrapPath}: checksum-verified dependency installation must run as root before ownership transfer`);
}

forbid(
  workflow,
  /^\s*(?:checks|deployments|id-token|issues|pull-requests|security-events):\s*write\s*$/mu,
  `${workflowPath}: unapproved write permission is forbidden`,
);
forbid(workflow, /continue-on-error:\s*true/mu, `${workflowPath}: continue-on-error is forbidden`);
forbid(
  workflow,
  /PC_PROD_SSH_|ssh-keyscan|StrictHostKeyChecking|id_pc_prod|\bscp\b|\bssh\s+-/u,
  `${workflowPath}: inbound SSH transport is forbidden`,
);
forbid(workflow, /pull_request_target:/u, `${workflowPath}: pull_request_target is forbidden`);

const liveWorkflow = (workflow.split('\n  live_preflight:\n')[1] || '').split('\n  publish_status:\n')[0];
forbid(liveWorkflow, /\bsudo\b/u, `${workflowPath}: live preflight must not escalate privileges`);
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

for (const line of workflow.split('\n')) {
  if (/\|\|\s*true/u.test(line)) {
    violations.push(`${workflowPath}: suppressed failure is forbidden: ${line.trim()}`);
  }
}

const allowedTemporaryCleanup = 'trap \'rm -rf "$work"\' EXIT';
const normalizedScript = script
  .replace(/^\s*#.*$/gmu, '')
  .replace(allowedTemporaryCleanup, '')
  .replaceAll("'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'", "'EFFECTIVE_TABLE_PRIVILEGES'")
  .replaceAll("'USAGE,SELECT,UPDATE'", "'EFFECTIVE_SEQUENCE_PRIVILEGES'");

for (const [pattern, label] of [
  [/\bdocker\s+compose\b[^\n]*(?:\bup\b|\bdown\b|\brestart\b|\bpull\b|\bcreate\b|\brm\b)/iu, 'production Docker Compose mutation'],
  [/\bdocker\s+(?:start|stop|restart|kill|rm|update|run|pull)\b/iu, 'production container or image mutation'],
  [/\bsystemctl\s+(?:start|stop|restart|enable|disable|daemon-reload)\b/iu, 'systemd mutation'],
  [/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/iu, 'PostgreSQL mutation statement'],
  [/\b(?:install|cp|mv|chmod|chown|truncate)\s+[^\n]*\/(?:etc|srv|opt|var|home|root)\b/iu, 'production filesystem mutation'],
  [/\b(?:kill|pkill|killall)\b/iu, 'process mutation'],
]) forbid(normalizedScript, pattern, `${scriptPath}: forbidden ${label}`);

forbid(script, /docker\s+inspect[^\n]*\.Config\.Env[^\n]*>\s*\/dev\/stdout/iu, `${scriptPath}: container environment must not be printed`);
forbid(script, /set\s+-[^\n]*x/iu, `${scriptPath}: shell tracing is forbidden`);
forbid(script, /(?:password|secret|api_key|database_url)\s*=.*(?:echo|printf)/iu, `${scriptPath}: secret-like values must not be printed`);
forbid(script, /^\s*ports\s*:/mu, `${scriptPath}: preflight must not define public ports`);
forbid(bootstrap, /set\s+-[^\n]*x/iu, `${bootstrapPath}: shell tracing is forbidden`);
forbid(bootstrap, /echo[^\n]*(?:RUNNER_REGISTRATION_TOKEN|registration_token|token=)/iu, `${bootstrapPath}: registration token must not be printed`);
forbid(
  bootstrap,
  /sudo\s+-u\s+"?\$RUNNER_USER"?[^\n]*installdependencies[.]sh/iu,
  `${bootstrapPath}: dependency installer must not run as the unprivileged runner user`,
);

if (violations.length > 0) {
  console.error('TAI REG.RU preflight contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TAI REG.RU preflight contract PASS: exact-main, root-authorized dependency bootstrap, local outbound-only runner, read-only, override-aware, digest-bound, effective-least-privilege and fail-closed.');
