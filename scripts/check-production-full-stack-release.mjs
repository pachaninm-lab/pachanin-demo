// Exact-current release trigger after owner-only TAI deployment dispatch authority.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const paths = {
  publish: '.github/workflows/docker-publish.yml',
  workflow: '.github/workflows/production-full-stack-exact-sha.yml',
  controller: '.github/workflows/platform-v7-safe-merge.yml',
  middleware: 'apps/web/middleware.ts',
  executor: 'scripts/production-full-stack-exact-sha.sh',
  live: 'scripts/production-full-stack-live-acceptance.sh',
  hero: 'apps/web/i18n/platform-v7-hero-message.ts',
  scope: 'docs/platform-v7/autopilot/scopes/production-full-stack-release-v1.json',
};
const failures = [];
const text = {};
for (const [name, path] of Object.entries(paths)) {
  if (!fs.existsSync(path)) failures.push(`${path}: missing`);
  else text[name] = fs.readFileSync(path, 'utf8');
}
const requireAll = (name, needles) => {
  for (const needle of needles) if (!(text[name] ?? '').includes(needle)) failures.push(`${paths[name]}: missing ${JSON.stringify(needle)}`);
};
const forbid = (name, patterns) => {
  for (const pattern of patterns) if (pattern.test(text[name] ?? '')) failures.push(`${paths[name]}: forbidden ${pattern}`);
};

const parsePushPaths = (source) => {
  const lines = String(source ?? '').split(/\r?\n/);
  const onIndex = lines.findIndex((line) => line === 'on:');
  if (onIndex < 0) return null;

  let onEnd = lines.length;
  for (let index = onIndex + 1; index < lines.length; index += 1) {
    if (/^[^\s#][^:]*:/.test(lines[index])) {
      onEnd = index;
      break;
    }
  }

  const pushIndex = lines.findIndex((line, index) => index > onIndex && index < onEnd && line === '  push:');
  if (pushIndex < 0) return null;

  let pushEnd = onEnd;
  for (let index = pushIndex + 1; index < onEnd; index += 1) {
    if (/^  [^\s#][^:]*:/.test(lines[index])) {
      pushEnd = index;
      break;
    }
  }

  const pathsIndex = lines.findIndex((line, index) => index > pushIndex && index < pushEnd && line === '    paths:');
  if (pathsIndex < 0) return null;

  const result = [];
  for (let index = pathsIndex + 1; index < pushEnd; index += 1) {
    const line = lines[index];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (!/^\s{6,}/.test(line)) break;
    const match = line.match(/^\s{6}-\s+(.+?)\s*$/);
    if (!match) continue;
    let value = match[1].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    if (value) result.push(value);
  }
  return result;
};

requireAll('publish', [
  'infra/docker/Dockerfile.migrations',
  'build-migration:',
  '${{ env.IMAGE_PREFIX }}-migration',
  'file: infra/docker/Dockerfile.migrations',
  'GIT_COMMIT=${{ github.sha }}',
]);

const requiredReleaseTriggerPaths = [
  '.github/workflows/production-full-stack-exact-sha.yml',
  'scripts/production-full-stack-exact-sha.sh',
  'scripts/production-full-stack-live-acceptance.sh',
  'scripts/check-production-full-stack-release.mjs',
];
const pushPaths = parsePushPaths(text.publish);
if (!pushPaths) {
  failures.push(`${paths.publish}: missing on.push.paths sequence`);
} else {
  const pushPathSet = new Set(pushPaths);
  for (const requiredPath of requiredReleaseTriggerPaths) {
    if (!pushPathSet.has(requiredPath)) failures.push(`${paths.publish}: on.push.paths missing ${JSON.stringify(requiredPath)}`);
  }
}

requireAll('workflow', [
  'Production Full-Stack Exact-SHA Release',
  'workflow_call:',
  'owner_release_authorized:',
  "description: 'Immutable release candidate captured by the owner controller.'",
  'target_sha:',
  'controller_issue_number:',
  'required: true',
  "default: ''",
  'default: 0',
  'inputs.owner_release_authorized == true',
  'Reject every non-controller reusable release authority',
  '[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ && "$TARGET_SHA" == "$EVENT_SHA" ]]',
  '(inputs.controller_issue_number == 3072 || inputs.controller_issue_number == 4637)',
  'inputs.controller_issue_number == github.event.issue.number',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.body == '/production release current-main'",
  'ref: ${{ inputs.target_sha }}',
  "target='${{ inputs.target_sha }}'",
  'git merge-base --is-ancestor "$target" "$current_main"',
  'RELEASE_CANDIDATE_NO_LONGER_ANCESTOR',
  'group: pc-crop-production-release-candidate',
  'queue: max',
  'RELEASE_ISSUE_NUMBER: 3072',
  'CONTINUATION_ISSUE_NUMBER: 4637',
  'for component in api web migration',
  'grainflow-${component}:sha-${SHORT_SHA}',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'PC_PROD_BACKUP_EVIDENCE_FILE_B64',
  'No valid protected SSH private key is configured.',
  'scripts/production-full-stack-exact-sha.sh',
  'scripts/production-full-stack-live-acceptance.sh',
  'Verify PostgreSQL, audit and outbox evidence',
  'Restore exact API/web images after acceptance failure',
  'DURABLE_INTAKE_DB=PASS',
  'steps.database.outcome',
  'Publish release evidence',
  'gh issue comment',
  'gh issue close',
  'EVIDENCE_ISSUE_NUMBER: ${{ inputs.owner_release_authorized == true && inputs.controller_issue_number || 3072 }}',
  'gh issue comment "$EVIDENCE_ISSUE_NUMBER"',
  '[[ "$EVIDENCE_ISSUE_NUMBER" == "$RELEASE_ISSUE_NUMBER" || "$EVIDENCE_ISSUE_NUMBER" == "$CONTINUATION_ISSUE_NUMBER" ]]',
  'retention-days: 90',
  'production-full-stack-release-${{ github.run_id }}-${{ github.run_attempt }}',
]);
const workflowSource = text.workflow ?? '';
if ((workflowSource.match(/^\s+queue: max$/gmu) || []).length !== 2) {
  failures.push(`${paths.workflow}: workflow and production job must both retain every serialized pending invocation`);
}
if ((workflowSource.match(/git merge-base --is-ancestor "\$TARGET_SHA" "\$current_main"/gu) || []).length < 2
  || !workflowSource.includes('git merge-base --is-ancestor "$target" "$current_main"')) {
  failures.push(`${paths.workflow}: immutable candidate ancestry must be rechecked before every production mutation boundary`);
}
forbid('workflow', [
  /^\s{2}workflow_run:/m,
  /^\s{2}workflow_dispatch:/m,
  /^\s{2}issue_comment:/m,
  /github\.event\.workflow_run/,
  /\/production full-stack current-main/,
  /DEPLOY-FULL-STACK-EXACT-SHA/,
  /inputs\.controller_issue_number == 0/,
  /inputs\.target_sha \|\| github\.sha/,
]);
requireAll('controller', [
  '/production release current-main',
  'pc-crop-registration-lifecycle',
  'queue: max',
  'gh workflow run docker-publish.yml',
  'gh run watch "$image_run_id"',
  'Build API image',
  'Build web image',
  'Build migration image',
  'Release candidate is no longer an ancestor of main.',
  'production-full-stack-execution-3072:',
  'needs: production-release-control-3072',
  "github.event.comment.body == '/production release current-main'",
  'uses: ./.github/workflows/production-full-stack-exact-sha.yml',
  'owner_release_authorized: true',
  'target_sha: ${{ github.sha }}',
  'controller_issue_number: ${{ github.event.issue.number }}',
  '(github.event.issue.number == 3072 || github.event.issue.number == 4637)',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  'secrets: inherit',
]);
requireAll('middleware', [
  "'/api/platform-v7/organization-connect'",
  '|| PUBLIC_API_EXACT.has(p)',
]);
const controllerSource = text.controller ?? '';
const controllerConcurrencyGroup = controllerSource.match(/^concurrency:\n\s+group: ([^\n]+)$/mu)?.[1] ?? '';
if (!controllerConcurrencyGroup.includes('pc-crop-registration-lifecycle')
  || controllerConcurrencyGroup.includes('github.triggering_actor')) {
  failures.push(`${paths.controller}: reruns of the original owner release command must remain in the serialized lifecycle group`);
}
const publishDispatchIndex = controllerSource.indexOf('gh workflow run docker-publish.yml');
const imageWatchIndex = controllerSource.indexOf('gh run watch "$image_run_id"');
const reusableReleaseIndex = controllerSource.indexOf('production-full-stack-execution-3072:');
if (!(publishDispatchIndex >= 0 && imageWatchIndex > publishDispatchIndex && reusableReleaseIndex > imageWatchIndex)) {
  failures.push(`${paths.controller}: exact image publication must complete before owner-authorized reusable release`);
}
if (controllerSource.includes('gh workflow run production-full-stack-exact-sha.yml')) {
  failures.push(`${paths.controller}: the controller must not dispatch a second workflow as github-actions[bot]`);
}
if (workflowSource.split('inputs.controller_issue_number == github.event.issue.number').length - 1 !== 1
  || !workflowSource.includes('[[ "$CONTROLLER_ISSUE_NUMBER" == "$EVENT_ISSUE_NUMBER" ]]')) {
  failures.push(`${paths.workflow}: contract guard and deploy job must bind the controller issue to the triggering issue`);
}
if (!workflowSource.includes('"$EVIDENCE_ISSUE_NUMBER" == "$RELEASE_ISSUE_NUMBER"')
  || !workflowSource.includes('gh issue comment "$EVIDENCE_ISSUE_NUMBER"')) {
  failures.push(`${paths.workflow}: release evidence must use the validated triggering authority issue`);
}
requireAll('executor', [
  'COMPOSE_SERVICE_DISCOVERY_FAILED',
  'BACKUP_MODE=LOGICAL_COMPOSE_POSTGRES',
  'PC_PROD_BACKUP_EVIDENCE_FILE_B64',
  'BACKUP_AUTHORITY_UNAVAILABLE',
  'run --rm --no-deps --pull never "$migration_service"',
  'MIGRATION_COMPLETE=1',
  'up -d --no-deps --pull never api',
  'up -d --no-deps --pull never web',
  'wait_api',
  'redact_api_startup_log',
  'emit_api_startup_diagnostics',
  'API_STARTUP_DIAGNOSTICS_BEGIN',
  'API_STARTUP_LOG_TAIL_BEGIN',
  'docker logs --tail 80',
  'wait_web',
  'rollback_images',
  'verify_durable_intake',
  'DURABLE_INTAKE_DB=PASS',
  'public_organization_connection_requests',
  'public:organization-intake:create',
  'PUBLIC_ORGANIZATION_CONNECTION_REQUESTED',
  'NON_TARGET_CONTAINER_CHANGED',
  'WATCHTOWER_RETIRED=1',
  'DEPLOYMENT_COMPLETE=1',
]);
requireAll('live', [
  'for locale in ru en zh',
  '?lang=$locale&release=$TARGET_SHA&run=$RELEASE_RUN_ID',
  'Cache-Control: no-cache, no-store, max-age=0',
  'Платформа управления агросделками в растениеводстве',
  'с собственным искусственным интеллектом',
  'Управляйте агросделкой',
  'от цены до расчёта',
  'Crop Deal management platform',
  'with proprietary artificial intelligence',
  'Manage an agricultural Deal',
  '种植业农业交易管理平台',
  '配备自主人工智能',
  'Цена согласована. Теперь нужно исполнить Сделку.',
  'if grep -Fq "$retired_title"',
  '/api/health/ready?release=$TARGET_SHA&run=$RELEASE_RUN_ID',
  '/api/platform-v7/organization-connect',
  'Idempotency-Key:',
  'PC_RELEASE_RUN_ID',
  'LIVE_CORRELATION_ID=',
  'LIVE_APPROVED_HERO=PASS',
  'LIVE_EXACT_REPLAY=PASS',
  'LIVE_CONFLICT_REPLAY=PASS',
  'LIVE_ACCEPTANCE=PASS',
]);
requireAll('hero', [
  'Платформа управления агросделками в растениеводстве',
  'с собственным искусственным интеллектом',
  'Управляйте агросделкой',
  'от цены до расчёта',
  'Crop Deal management platform',
  'with proprietary artificial intelligence',
  'Manage an agricultural Deal',
  'from price to settlement',
  '种植业农业交易管理平台',
  '配备自主人工智能',
  '管理农业交易',
  '从价格到结算',
]);
forbid('hero', [/Crop Deal execution platform/]);

forbid('workflow', [
  /github\.actor\s*==\s*['"]github-actions\[bot\]['"]/,
  /sshpass/i,
  /SSH_PASSWORD/i,
  /StrictHostKeyChecking=no/,
  /grainflow-(?:api|web|migration):latest/,
  /docker\s+build/,
  /prisma\s+migrate\s+reset/i,
  /\[\[\s*"?\$user"?\s*==\s*root\s*\]\]/,
  /BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY/,
]);
forbid('executor', [
  /docker\s+(?:build|commit|tag)\b/,
  /prisma\s+migrate\s+(?:reset|dev)/i,
  /down[-_ ]migration/i,
  /docker\s+compose[^\n]*(?:down|rm\s+-f)/,
  /caddy/i,
  /(?:source|cat|cp|mv|install|sed)[^\n]*\/\.env(?:\s|$)/i,
]);
forbid('live', [/email=.*@/i, /phone=/i, /inn=/i]);

for (const path of [paths.executor, paths.live]) {
  const result = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${path}: bash -n failed: ${result.stderr.trim()}`);
}

/**
 * Go templates must reach Docker with real double quotes.
 *
 * A backslash inside a single-quoted shell word escapes nothing — the shell
 * passes it through and Docker rejects the template with `unexpected "\" in
 * operand`. `bash -n` cannot see this, because the shell syntax is valid; only
 * Docker's parser objects, and only when the line actually runs. Both offending
 * lines lived in the rollback path, which runs exclusively during an incident,
 * so the defect stayed invisible until a production rollback needed it and then
 * reported failure regardless of what happened to the containers.
 */
for (const [name, path] of [['executor', paths.executor], ['live', paths.live]]) {
  const lines = String(text[name] ?? '').split(/\r?\n/);
  lines.forEach((line, index) => {
    const template = /--format\s+'([^']*)'/.exec(line) ?? /\binspect\s+-f\s+'([^']*)'/.exec(line);
    if (template && template[1].includes('\\"')) {
      failures.push(`${path}:${index + 1}: Go template escapes double quotes inside single quotes — Docker will reject it at runtime`);
    }
  });
}

/* The rollback verification says which check failed, and still fails on each. */
requireAll('executor', [
  'container_revision()',
  "docker inspect --format '{{ index .Config.Labels \"org.opencontainers.image.revision\" }}' \"$1\"",
  'fail ROLLBACK_REVISION_UNREADABLE 57',
  'fail ROLLBACK_REVISION_MISMATCH 58',
  'fail AUTOMATIC_ROLLBACK_FAILED 50',
  'RELEASE_ROLLBACK_ARMED=0',
  'RELEASE_ROLLBACK_ACTIVE=0',
  'rollback_and_exit()',
  'RELEASE_ROLLBACK_ARMED=1',
  "printf 'ROLLBACK_COMPLETE=1\\n' >&2",
  "printf 'ROLLBACK_FAILED=1\\n' >&2",
  "printf 'RUNNING_API_REVISION=%s\\n'",
  "printf 'RUNNING_WEB_REVISION=%s\\n'",
  'fail RUNNING_REVISION_MISMATCH 33',
]);
const executorSource = text.executor ?? '';
const rollbackHandlerIndex = executorSource.indexOf('rollback_and_exit()');
const rollbackArmIndex = executorSource.indexOf('RELEASE_ROLLBACK_ARMED=1');
const targetOverrideIndex = executorSource.indexOf('write_override "$API_IMAGE" "$WEB_IMAGE" "$MIGRATION_IMAGE" "$full_override" 1');
const revisionMismatchIndex = executorSource.indexOf('fail RUNNING_REVISION_MISMATCH 33');
const rollbackDisarmIndex = executorSource.lastIndexOf('RELEASE_ROLLBACK_ARMED=0');
const successIndex = executorSource.indexOf("printf 'DEPLOYMENT_COMPLETE=1\\n'");
if (!(rollbackHandlerIndex >= 0
  && rollbackArmIndex > rollbackHandlerIndex
  && targetOverrideIndex > rollbackArmIndex
  && revisionMismatchIndex > targetOverrideIndex
  && rollbackDisarmIndex > revisionMismatchIndex
  && successIndex > rollbackDisarmIndex)) {
  failures.push(`${paths.executor}: explicit-exit rollback arm/disarm order is invalid`);
}
if (executorSource.split('RELEASE_ROLLBACK_ARMED=1').length - 1 !== 1
  || executorSource.split('RELEASE_ROLLBACK_ARMED=0').length - 1 !== 2
  || executorSource.split('RELEASE_ROLLBACK_ACTIVE=0').length - 1 !== 1
  || executorSource.split('rollback_and_exit').length - 1 !== 3
  || executorSource.split('RUNNING_API_REVISION=').length - 1 !== 1
  || executorSource.split('RUNNING_WEB_REVISION=').length - 1 !== 1) {
  failures.push(`${paths.executor}: explicit-exit rollback safety marker cardinality is invalid`);
}
try {
  const scope = JSON.parse(text.scope ?? '{}');
  if (scope.branch !== 'ops/production-full-stack-release-v1') failures.push(`${paths.scope}: branch mismatch`);
  if (scope.evidenceIssue !== 3072) failures.push(`${paths.scope}: evidence issue mismatch`);
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error('Production full-stack release contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('PASS: exact API/web/migration images, owner-controller-only immutable release authority, serialized release chain, protected pinned SSH identity, protected Compose discovery, backup, forward-only migration, target-only rollout, automatic image rollback, approved homepage content, public organization intake, live acceptance and PostgreSQL/audit/outbox evidence are enforced.');
