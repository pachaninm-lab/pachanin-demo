#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/tai-reg-ru-deploy.yml';
const deployPath = 'scripts/tai-reg-ru-deploy.sh';
const preflightPath = 'scripts/tai-reg-ru-preflight.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/tai-agro-os-v4-stage1-reg-ru-deploy-20260731.json';
const workflow = readFileSync(workflowPath, 'utf8');
const deploy = readFileSync(deployPath, 'utf8');
const preflight = readFileSync(preflightPath, 'utf8');
const scope = JSON.parse(readFileSync(scopePath, 'utf8'));
const violations = [];

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) violations.push(`${label}: missing ${JSON.stringify(fragment)}`);
}

function forbid(source, pattern, label) {
  if (pattern.test(source)) violations.push(label);
}

for (const fragment of [
  'workflows: ["TAI Restricted Qwen REG.RU Activation"]',
  "inputs.confirmation == 'DEPLOY-TAI-REG-RU'",
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  '[[ "$target" == "$(git rev-parse origin/main)" ]]',
  'contents: read',
  'packages: read',
  'statuses: write',
  'ghcr.io/pachaninm-lab/grainflow-tai:sha-${SHORT_SHA}',
  '"$revision" == "$TARGET_SHA"',
  '"$user" == \'65532:65532\'',
  '"$digest" =~ @sha256:[0-9a-f]{64}$',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'StrictHostKeyChecking=yes',
  'bash scripts/prepare-reg-ru-bastion-ssh.sh prepare',
  'node scripts/check-reg-ru-bastion-transport.mjs',
  'Execute strict read-only pre-deployment inventory',
  'not blockers.issubset(allowed)',
  'unexpected pre-deployment blockers',
  'Recover private Qwen token without disclosure',
  'Deploy exact TAI image on existing REG.RU authority',
  'Collect redacted deployment evidence',
  'Execute strict post-deployment preflight',
  'Roll back failed deployment acceptance',
  "context='TAI REG.RU Deployment'",
]) requireFragment(workflow, fragment, workflowPath);

for (const fragment of [
  'TAI_SERVICE_NOT_MATERIALIZED',
  'TAI_DEDICATED_ENV_NOT_MATERIALIZED',
  'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED',
]) requireFragment(workflow, fragment, `${workflowPath}: pre-deployment allowlist`);

const remoteCleanup = workflow.indexOf("rm -f '/tmp/tai-reg-ru-deploy-${GITHUB_RUN_ID}.sh'");
const transportCleanup = workflow.indexOf('bash scripts/prepare-reg-ru-bastion-ssh.sh cleanup');
if (remoteCleanup < 0 || transportCleanup < 0 || remoteCleanup > transportCleanup) {
  violations.push(`${workflowPath}: remote token/script cleanup must precede bastion transport cleanup`);
}

for (const fragment of [
  'TAI_IMAGE_DIGEST',
  'image: ${TAI_IMAGE_DIGEST}',
  'docker pull "$TAI_IMAGE_DIGEST"',
  'remote_digest_match=',
  '"$(docker inspect --format \'{{.Image}}\' "$tai_id")" = "$expected_image_id"',
  '"$(docker inspect --format \'{{.Config.Image}}\' "$tai_id")" = "$TAI_IMAGE_DIGEST"',
  'test "$(docker inspect --format \'{{ index .Config.Labels "org.opencontainers.image.revision" }}\' "$tai_id")" = "$TARGET_SHA"',
  'COMPOSE_JSON="$(mktemp)"',
  'rm -f "$COMPOSE_JSON" "$TOPOLOGY_ENV"',
  "--filter 'label=com.docker.compose.service=tai'",
  'PREVIOUS_TAI_ROLLBACK_AUTHORITY_INCOMPLETE',
  'user: "65532:65532"',
  'read_only: true',
  'cap_drop:',
  '- ALL',
  'no-new-privileges:true',
  'NOBYPASSRLS',
  'NOSUPERUSER',
  'NOCREATEDB',
  'NOCREATEROLE',
  'NOINHERIT',
  'NOREPLICATION',
  'rolinherit',
  'has_table_privilege',
  "relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'",
  'nonTaiTableGrantCount',
  'membershipCount',
  'docker port "$tai_id"',
  'TAI_MODEL_BEARER_TOKEN=${model_token}',
  'HMACPlatformIdentityAuthority',
  'canonical_api_request_sha256',
  'preparedActionCount',
  'toolExecution',
  'TAI_REG_RU_DEPLOY_ROLLBACK=PASS',
  'TAI_REG_RU_DEPLOYMENT_COMPLETE=1',
  'tai.reg-ru.deployment.v1',
  'newRecurringCostRub',
]) requireFragment(deploy, fragment, deployPath);

for (const fragment of [
  'TAI_SERVICE_NOT_MATERIALIZED',
  'TAI_DEDICATED_ENV_NOT_MATERIALIZED',
  'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED',
  'NO_PRODUCTION_MUTATION_DETECTED',
  'compose.tai-agro-os.override.yml',
  'TAI_OVERRIDE_PROTECTED',
  'expected_image_id=',
  'has_table_privilege',
]) requireFragment(preflight, fragment, preflightPath);

forbid(
  workflow,
  /^\s*(?:actions|checks|deployments|id-token|issues|pull-requests|security-events):\s*write\s*$/mu,
  `${workflowPath}: unapproved workflow write permission`,
);
forbid(workflow, /continue-on-error:\s*true/mu, `${workflowPath}: continue-on-error is forbidden`);
forbid(workflow, /set\s+-[^\n]*x/iu, `${workflowPath}: shell tracing is forbidden`);
forbid(deploy, /set\s+-[^\n]*x/iu, `${deployPath}: shell tracing is forbidden`);
forbid(deploy, /^\s*ports\s*:/mu, `${deployPath}: public or host port publication is forbidden`);
forbid(deploy, /network_mode:\s*host/iu, `${deployPath}: host networking is forbidden`);
forbid(deploy, /privileged:\s*true/iu, `${deployPath}: privileged container is forbidden`);
forbid(deploy, /^\s*cap_add\s*:/mu, `${deployPath}: capability addition is forbidden`);
forbid(deploy, /\/var\/run\/docker[.]sock/iu, `${deployPath}: Docker socket mount is forbidden`);
forbid(deploy, /TAI_PLATFORM_TOOL_(?:BASE_URL|HMAC_SECRET)/u, `${deployPath}: platform tools must remain disabled-safe`);
forbid(deploy, /\b(?:netlify|vercel|railway|openai[.]com|anthropic[.]com)\b/iu, `${deployPath}: external hosting or cloud LLM dependency is forbidden`);
forbid(deploy, /GRANT\s+ALL\b/iu, `${deployPath}: broad database grant is forbidden`);
forbid(deploy, /GRANT[^\n]+ON\s+ALL\s+TABLES/iu, `${deployPath}: all-table grant is forbidden`);
forbid(deploy, /ALTER\s+ROLE\s+\$?\{?ROLE_NAME\}?/iu, `${deployPath}: existing role mutation is forbidden; reuse requires exact safe evidence`);
forbid(deploy, /docker\s+compose[^\n]+\bdown\b/iu, `${deployPath}: full Compose shutdown is forbidden`);
forbid(deploy, /(?:AI_ASSISTANT_API_KEY|TAI_MODEL_BEARER_TOKEN)[^\n]*(?:echo|printf)/iu, `${deployPath}: model credential output is forbidden`);
forbid(deploy, /compose[.]base[.]json/iu, `${deployPath}: expanded Compose configuration must not persist in release evidence`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${scopePath}: invalid schemaVersion`);
if (scope.branch !== 'agent/tai-agro-os-v4-stage1-reg-ru-deploy-20260731') violations.push(`${scopePath}: branch mismatch`);
if (scope.authorityBaseExactMain !== '551ab5bf087ed710baca6483d70da11dc311a68a') violations.push(`${scopePath}: exact-main authority mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY') violations.push(`${scopePath}: hosting boundary changed`);
if (scope.newRecurringCostRub !== 0) violations.push(`${scopePath}: recurring cost must remain zero`);
if (scope.productionMutationAllowed !== true) violations.push(`${scopePath}: deployment mutation authority is absent`);
for (const path of [workflowPath, deployPath, preflightPath, 'scripts/check-tai-reg-ru-deploy.mjs']) {
  if (!scope.allowedPaths.includes(path)) violations.push(`${scopePath}: ${path} is outside allowedPaths`);
}

if (violations.length > 0) {
  console.error('TAI REG.RU deployment contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TAI REG.RU deployment contract PASS: exact-main, immutable-digest, rootless, internal-only, effective-least-privilege, rollback-bound and bastion-routed at zero cost.');
