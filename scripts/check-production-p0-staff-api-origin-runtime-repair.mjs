#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-staff-api-origin-runtime-repair.yml';
const scriptPath = 'scripts/production-p0-staff-api-origin-runtime-repair.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/p0-staff-api-origin-runtime-4559.json';
const checkerPath = 'scripts/check-production-p0-staff-api-origin-runtime-repair.mjs';
const neutralScopePath = 'docs/platform-v7/autopilot/scopes/p0-stale-actions-orphan-neutralization-3785.json';
const liveResendPath = 'scripts/production-p0-regru-live-resend-recover.sh';
const provisionerPath = 'scripts/provision-production-p0-password-reset-runtime.sh';
const taiReleasePath = '.github/workflows/tai-release-acceptance.yml';
const productionLikePath = '.github/workflows/production-like-kubernetes-acceptance.yml';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
const neutralScope = JSON.parse(fs.readFileSync(neutralScopePath, 'utf8'));
const liveResend = fs.readFileSync(liveResendPath, 'utf8');
const provisioner = fs.readFileSync(provisionerPath, 'utf8');
const taiRelease = fs.readFileSync(taiReleasePath, 'utf8');
const productionLike = fs.readFileSync(productionLikePath, 'utf8');

function fail(message) { throw new Error(`P0_STAFF_API_ORIGIN_RUNTIME_REPAIR:${message}`); }
function requireAll(label, source, needles) {
  for (const needle of needles) if (!source.includes(needle)) fail(`${label} missing ${needle}`);
}

requireAll('workflow', workflow, [
  'issue_comment:',
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "github.event.comment.body == '/production p0-staff-api-origin-repair current-runtime'",
  'bash scripts/production-p0-staff-api-origin-runtime-repair.sh',
  'Reject concurrent production mutation workflows',
  'actions: write',
  'cancelWorkflowRun',
  'getWorkflowRun',
  'waitForRetirement',
  "POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel",
  "DELETE /repos/{owner}/{repo}/actions/runs/{run_id}",
  'strictStaleStillQueued',
  "retirement: 'FAILED_CLOSED_REREAD'",
  "retirement: 'FAILED_CLOSED_CHANGED_BEFORE_DELETE'",
  "retirement: 'FAILED_CLOSED_DELETE'",
  'force_cancel_http_status',
  'delete_http_status',
  "Number(error?.status || 0) === 404",
  'provenOrphanedRuns',
  'quarantineProvenOrphan',
  'listJobsForWorkflowRun',
  'jobs.length !== 0',
  "Number(cancelStatus) === 500",
  "Number(forceCancelStatus) === 500",
  "Number(deleteStatus) === 403",
  'ORPHANED_API_RECORD_QUARANTINED',
  "retirement: 'FAILED_CLOSED_ORPHAN_METADATA_OR_BACKEND_DRIFT'",
  "retirement: 'FAILED_CLOSED_ORPHAN_JOBS_REREAD'",
  "retirement: 'FAILED_CLOSED_ORPHAN_HAS_JOBS'",
  "retirement: 'FAILED_CLOSED_ORPHAN_NEUTRALIZER_MISSING'",
  'nonProductionCiProfiles',
  'proveNonProductionCi',
  'github.rest.repos.getContent',
  'ref: run.head_sha',
  "Buffer.from(data.content.replace(/\\s/g, ''), 'base64').toString('utf8')",
  'NON_PRODUCTION_CI_PROVEN',
  "nonProductionCiProfiles.has(name) && await proveNonProductionCi(run)",
  "'TAI Release Acceptance'",
  "'.github/workflows/tai-release-acceptance.yml'",
  "'Production-like Kubernetes Acceptance'",
  "'.github/workflows/production-like-kubernetes-acceptance.yml'",
  "'TAI REG.RU Preflight'",
  "'.github/workflows/tai-reg-ru-preflight.yml'",
  "proofMode: 'REG_RU_READONLY_PREFLIGHT'",
  'RESTRICTED_REG_RU_READONLY_PREFLIGHT_PROVEN',
  "'runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]'",
  "ops.length !== 1 || ops[0] !== 'preflight'",
]);
for (const id of ['32219738787','32219737778','32219738538','32218490249','32218487944']) {
  if (!workflow.includes(id)) fail(`workflow missing exact orphan run id ${id}`);
}

const forceCancelIndex = workflow.indexOf("POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel");
const staleRecheckIndex = workflow.indexOf('const strictStaleStillQueued');
const deleteIndex = workflow.indexOf("DELETE /repos/{owner}/{repo}/actions/runs/{run_id}");
if (forceCancelIndex < 0 || staleRecheckIndex <= forceCancelIndex || deleteIndex <= staleRecheckIndex) {
  fail('stale run deletion must follow force-cancel and exact strict-stale revalidation');
}
for (const token of [
  "String(latest.status || '') === 'queued'",
  "latest.event === 'issue_comment'",
  "staleQueuedNames.has(String(latest.name || ''))",
  'now - latestCreatedAt >= staleAfterMs',
  'latestNeverUpdated',
  "String(latest.head_sha || '') !== String(context.sha || '')",
]) {
  if (!workflow.includes(token)) fail(`delete revalidation missing ${token}`);
}

requireAll('script', script, [
  "COMMAND='/production p0-staff-api-origin-repair current-runtime'",
  "CANONICAL_ORIGIN='http://api:3001'",
  "PRODUCTION_MUTATION='WEB_ONLY_API_ORIGIN_OVERRIDE_AND_RECREATE'",
  'git merge-base --is-ancestor "$DEPLOYED_SHA" "$TARGET_SHA"',
  "git show \"$DEPLOYED_SHA:apps/web/lib/server/server-api-origin.ts\"",
  "const COMPOSE_INTERNAL_API_ORIGIN = 'http://api:3001';",
  '.pc-staff-api-origin.override.yml',
  'API_URL: http://api:3001',
  'config --format json',
  "candidate_class=\"$(classify_json_origin \"$tmp/candidate.json\")\"",
  '[[ "$candidate_class" == CANONICAL ]]',
  "candidate_image_id=\"$(docker image inspect --format '{{.Id}}' \"$candidate_image_ref\" 2>/dev/null)\"",
  '[[ "$candidate_image_id" == "$web_image_id" ]]',
  'up -d --no-deps --no-build --pull never web',
  'cmp -s "$tmp/nonweb.before" "$tmp/nonweb.after"',
  '[[ "${api_after[0]}" == "$api_id" ]]',
  "await p('/auth/me','AUTH_STATUS')",
  "await p('/staff/capabilities/me','CAP_STATUS')",
  '[[ "$auth_status" == 401 && "$cap_status" == 401 ]]',
  'ACTIVE_BEFORE=',
  'COMPOSE_BEFORE=',
  'ACTIVE_AFTER=',
  'secrets / API origin value / protected paths / container IDs / raw logs: \\`NOT_PUBLISHED\\`',
]);

if ((script.match(/up -d --no-deps --no-build --pull never web/g) || []).length !== 2) {
  fail('expected exactly one repair and one rollback Web-only compose up');
}

for (const forbidden of [
  '\ndocker pull ', '\ndocker build ', '\ndocker restart ', '\ndocker stop ', '\ndocker rm ',
  '\ndocker compose down', '\ndocker compose pull', '\ndocker compose build',
  'UPDATE auth.', 'DELETE FROM auth.', 'INSERT INTO auth.', 'TRUNCATE ',
  'docker exec -i "$api_id"',
]) {
  if (script.includes(forbidden)) fail(`script contains forbidden mutation ${JSON.stringify(forbidden)}`);
}

for (const forbiddenOutput of [
  'echo "$API_URL"', "printf '%s\\n' \"$API_URL\"", 'env |', 'printenv API_URL', 'docker inspect "$web_id"',
]) {
  if (script.includes(forbiddenOutput)) fail(`script may expose protected runtime data: ${forbiddenOutput}`);
}

requireAll('live resend orphan neutralizer', liveResend, [
  "if [[ \"${GITHUB_RUN_ID:-}\" == '32219738787' ]]; then",
  'BLOCKER=STALE_ACTIONS_ORPHAN_NEUTRALIZED',
  'MUTATION=NONE',
]);
const liveNeutralizerIndex = liveResend.indexOf("if [[ \"${GITHUB_RUN_ID:-}\" == '32219738787' ]]; then");
const liveSshIndex = liveResend.indexOf('ssh-keyscan');
if (liveNeutralizerIndex < 0 || liveSshIndex <= liveNeutralizerIndex) fail('live resend orphan neutralizer must precede SSH and production access');

requireAll('reuse-runtime provisioner orphan neutralizer', provisioner, [
  `if [[ "$(basename -- \"$0\")" == 'pc-auth-runtime-reconcile-32218490249.sh' ]]; then`,
  'fail STALE_ACTIONS_ORPHAN_NEUTRALIZED 79',
]);
const provisionerNeutralizerIndex = provisioner.indexOf('pc-auth-runtime-reconcile-32218490249.sh');
const provisionerMutationIndex = provisioner.indexOf('delivery_temp=');
if (provisionerNeutralizerIndex < 0 || provisionerMutationIndex <= provisionerNeutralizerIndex) fail('reuse-runtime orphan neutralizer must precede persistent runtime mutation');

const forbiddenNonProductionCi = [
  /\$\{\{\s*secrets\./i,
  /\bPC_PROD(?:_|\b)/,
  /(?:^|[\s;|&])(?:ssh|scp|sftp|rsync)(?:[\s;|&]|$)/im,
  /ssh-keyscan/i,
  /appleboy\/ssh-action/i,
  /runs-on:\s*(?:self-hosted|\[[^\]]*self-hosted)/i,
  /permissions:\s*(?:write-all|read-all)/i,
  /(?:actions|checks|contents|deployments|discussions|id-token|issues|packages|pages|pull-requests|repository-projects|security-events|statuses):\s*write\b/i,
];
requireAll('TAI release non-production CI proof', taiRelease, [
  'name: TAI Release Acceptance',
  'permissions:\n  actions: read\n  contents: read',
  'runs-on: ubuntu-latest',
  'production_operational_status") != "NOT_ATTESTED"',
]);
requireAll('production-like Kubernetes non-production CI proof', productionLike, [
  'name: Production-like Kubernetes Acceptance',
  'permissions:\n  contents: read',
  'runs-on: ubuntu-latest',
  'KIND_VERSION=v0.23.0',
  'kind delete cluster --name grainflow-acceptance || true',
  'docker rm -f kind-registry || true',
]);
for (const [label, source] of [['TAI release', taiRelease], ['production-like Kubernetes', productionLike]]) {
  for (const pattern of forbiddenNonProductionCi) if (pattern.test(source)) fail(`${label} non-production CI proof forbidden ${pattern}`);
}

if (neutralScope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('neutralization scope schema mismatch');
if (neutralScope.issue !== 3785 || neutralScope.releaseIssue !== 3072) fail('neutralization scope authority mismatch');
if (neutralScope.branch !== 'fix/p0-stale-actions-orphan-neutralization-3785' || neutralScope.status !== 'active') fail('neutralization scope branch/status mismatch');
if (neutralScope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY' || neutralScope.newRecurringCostRub !== 0) fail('neutralization scope hosting/cost mismatch');
const neutralAllowed = [workflowPath, neutralScopePath, checkerPath, liveResendPath, provisionerPath].sort();
if (JSON.stringify([...neutralScope.allowedPaths].sort()) !== JSON.stringify(neutralAllowed)) fail('neutralization scope allowed paths mismatch');
const exactOrphans = [32219738787,32219737778,32219738538,32218490249,32218487944].sort((a,b)=>a-b);
if (JSON.stringify([...neutralScope.knownOrphanedRuns].sort((a,b)=>a-b)) !== JSON.stringify(exactOrphans)) fail('neutralization exact run-id set mismatch');
const mutationOrphans = [32219738787,32218490249].sort((a,b)=>a-b);
if (JSON.stringify([...neutralScope.mutationCapableRunsToNeutralize].sort((a,b)=>a-b)) !== JSON.stringify(mutationOrphans)) fail('neutralization mutation-capable run set mismatch');
const readOnlyOrphans = [32219737778,32219738538,32218487944].sort((a,b)=>a-b);
if (JSON.stringify([...neutralScope.readOnlyRuns].sort((a,b)=>a-b)) !== JSON.stringify(readOnlyOrphans)) fail('neutralization read-only run set mismatch');
const expectedNonProductionCiProfiles = [
  { name: 'Production-like Kubernetes Acceptance', path: productionLikePath },
  { name: 'TAI Release Acceptance', path: taiReleasePath },
  { name: 'TAI REG.RU Preflight', path: '.github/workflows/tai-reg-ru-preflight.yml' },
].sort((a,b)=>a.name.localeCompare(b.name));
const actualNonProductionCiProfiles = [...(neutralScope.nonProductionCiProfiles || [])].sort((a,b)=>String(a.name).localeCompare(String(b.name)));
if (JSON.stringify(actualNonProductionCiProfiles) !== JSON.stringify(expectedNonProductionCiProfiles)) fail('neutralization non-production CI profile mismatch');
const nb = neutralScope.boundaries || {};
for (const key of ['registrationOnly','exactFiveRunIdsOnly','orphanMetadataMustMatch','zeroJobsRequired','realActiveWorkflowStillBlocks','neutralizeBeforePersistentMutation','provenNonProductionCiMayBeIgnored','nonProductionCiMustBeExactHeadContentProven','nonProductionCiProofFailureBlocks','restrictedReadOnlyProductionPreflightMayBeIgnored','restrictedReadOnlyPreflightMustProveNoSecretsAndNoDirectDockerAuthority']) if (nb[key] !== true) fail(`neutralization boundary must be true: ${key}`);
for (const key of ['databaseMutation','migrationMutation','credentialMutation','sessionMutation','mfaMutation','roleOrMembershipMutation','dnsMutation','caddyMutation','sshPinMutation']) if (nb[key] !== false) fail(`neutralization boundary must be false: ${key}`);
if (nb.productionMutationByThisChange !== 'NONE' || nb.newRecurringCostRub !== 0) fail('neutralization mutation/cost boundary mismatch');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('scope schema mismatch');
if (scope.issue !== 4559 || scope.releaseIssue !== 3072) fail('scope authority mismatch');
if (scope.branch !== 'fix/p0-staff-api-origin-runtime-4559' || scope.status !== 'active') fail('scope branch/status mismatch');
if (scope.authorityBaseExactMain !== '328c89877f3d26e2828816846d1132f7a5cabfd8') fail('scope exact-main mismatch');
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) fail('scope hosting/cost mismatch');
const expected = [workflowPath, scopePath, checkerPath, scriptPath].sort();
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify(expected)) fail('scope allowed paths mismatch');
const b = scope.boundaries || {};
for (const key of ['registrationOnly','ownerCommandOnly','webOnlyRuntimeMutation']) if (b[key] !== true) fail(`boundary must be true: ${key}`);
for (const key of ['apiMutation','databaseMutation','migrationMutation','passwordOrRecoveryMutation','mfaMutation','sessionMutation','roleOrMembershipMutation','dnsMutation','caddyMutation','sshPinMutation','imageBuildOrPull','credentialOutput','rawApiOriginOutput','protectedPathOutput','containerIdOutput']) {
  if (b[key] !== false) fail(`boundary must be false: ${key}`);
}
if (b.newRecurringCostRub !== 0) fail('scope recurring cost mismatch');

console.log('production P0 staff API origin runtime repair contract PASS');
