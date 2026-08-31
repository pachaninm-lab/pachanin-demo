#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const paths = {
  workflow: '.github/workflows/production-p0-all-role-registration.yml',
  runner: 'scripts/production-p0-all-role-registration.sh',
  checker: 'scripts/check-production-p0-all-role-registration.mjs',
  runbook: 'docs/ops/production-p0-all-role-registration.md',
  scope: 'docs/platform-v7/autopilot/scopes/production-p0-all-role-registration-3785.json',
  decisionBff: 'apps/web/app/api/auth/organization-join-requests/[applicationId]/decision/route.ts',
};

const EXPECTED_BASE_WRAPPER_BLOB = '718fa79314369361c9e5947dfee1dc1aafd7cb32';
const runner = readFileSync(paths.runner, 'utf8');
const workflow = readFileSync(paths.workflow, 'utf8');
const runbook = readFileSync(paths.runbook, 'utf8');
const decisionBff = readFileSync(paths.decisionBff, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const failures = [];

function gitBlob(sha) {
  const result = spawnSync('git', ['cat-file', 'blob', sha], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) {
    throw new Error(`immutable blob unavailable: ${sha}`);
  }
  return result.stdout;
}

function replaceOne(source, oldValue, newValue, label) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`patch cardinality ${label}=${count}`);
  return source.replace(oldValue, newValue);
}

function requireAll(name, source, fragments) {
  for (const fragment of fragments) {
    if (!source.includes(fragment)) failures.push(`${name}: missing ${JSON.stringify(fragment)}`);
  }
}

function forbid(name, source, pattern, message) {
  if (pattern.test(source)) failures.push(`${name}: ${message}`);
}

requireAll(paths.decisionBff, decisionBff, [
  'if (!upstreamResponse.ok) return json({ ...payload, correlationId }, upstreamResponse.status);',
  'return json({ ...payload, notificationDelivered, correlationId }, 200);',
]);
forbid(
  paths.decisionBff,
  decisionBff,
  /return json\(\{ \.\.\.payload, notificationDelivered, correlationId \}, upstreamResponse\.status\);/u,
  'a successful organization-join decision must use the canonical public HTTP 200 contract',
);
const decisionErrorPassthrough = decisionBff.indexOf(
  'if (!upstreamResponse.ok) return json({ ...payload, correlationId }, upstreamResponse.status);',
);
const decisionNotification = decisionBff.indexOf('let notificationDelivered = false;', decisionErrorPassthrough);
const decisionSuccess = decisionBff.indexOf(
  'return json({ ...payload, notificationDelivered, correlationId }, 200);',
  decisionNotification,
);
if (!(decisionErrorPassthrough >= 0
  && decisionNotification > decisionErrorPassthrough
  && decisionSuccess > decisionNotification)) {
  failures.push(`${paths.decisionBff}: only post-notification success may normalize to HTTP 200`);
}

requireAll(paths.workflow, workflow, [
  'name: Production P0 All-Role Registration',
  "github.event.issue.number == 4637",
  "github.event.comment.body == '/production p0-all-role-registration current-main'",
  'actions/workflows/production-p0-first-customer-acceptance.yml/runs',
  'Resolve immutable candidate from latest First Customer intent',
  'P0_LATEST_FIRST_CUSTOMER_INTENT_NOT_TERMINAL_PASS',
  'gh api --paginate --slurp',
  'actor=$GITHUB_REPOSITORY_OWNER',
  'created=%3E%3D$current_created',
  'created=%3E%3D$expected_created',
  '/attempts/$candidate_attempt/jobs?per_page=100',
  'runs/$DEEP_RUN_ID/attempts/$DEEP_RUN_ATTEMPT/jobs?per_page=100',
  'runs/$run_id/attempts/$run_attempt/jobs?per_page=100',
  "job.name === 'Validate production P0 acceptance contract'",
  "job.name === 'Two public customers · staff MFA · RLS · causal receipt'",
  'contract.length !== 1 || acceptance.length !== 1',
  'production-p0-first-customer-([0-9a-f]{40})-${runId}-${attempt}',
  'mapfile -t results < <(find "$deep_dir" -type f -name result.json -print)',
  '[[ "${#results[@]}" == 1',
  'result.runId !== expectedRunId',
  'result.releaseControllerRunId',
  'result.releaseControllerRunAttempt',
  'release_run_attempt=$release_controller_run_attempt',
  'result.production?.authMailWorkerRevisionExact !== true',
  'result.production?.authMailWorkerReady !== true',
  'result.tenantIsolation?.tenantAPostgresqlRlsCount !== 1',
  'result.tenantIsolation?.tenantBPostgresqlRlsCount !== 0',
  "result.causalReceiptProducer !== 'auth.emit_registration_lifecycle_receipt(text,text)'",
  'git merge-base --is-ancestor "$target" "$current"',
  'git checkout --detach "$target"',
  'Validate 9-role contract from immutable candidate',
  'deep_run_attempt=$deep_run_attempt',
  'assert_first_customer_intent_current()',
  'node - "$runs" > "$candidates_parser_file"',
  'mapfile -t candidates < "$candidates_parser_file"',
  '"$current_attempt" == "$DEEP_RUN_ATTEMPT"',
  'production-p0-first-customer-acceptance.yml/runs?event=issue_comment&branch=main&actor=$GITHUB_REPOSITORY_OWNER',
  'P0_NEWER_FIRST_CUSTOMER_INTENT_BLOCKS_ALL_ROLE',
  'P0_NEWER_RELEASE_INTENT_BLOCKS_ALL_ROLE',
  'P0_FIRST_CUSTOMER_ATTEMPT_CHANGED_BEFORE_ALL_ROLE',
  'P0_RELEASE_ATTEMPT_CHANGED_BEFORE_ALL_ROLE',
  'monitor_source_attempts()',
  'P0_%s_ATTEMPT_CHANGED_DURING_ALL_ROLE',
  'P0_FIRST_CUSTOMER_ATTEMPT_CHANGED_BEFORE_ALL_ROLE_ARTIFACT',
  'P0_RELEASE_ATTEMPT_CHANGED_BEFORE_ALL_ROLE_ARTIFACT',
  'setsid --wait bash -c',
  'kill -TERM -- "-$runner_pid"',
  'group: pc-crop-production-release-candidate',
  'pc-crop-registration-lifecycle',
  'queue: max',
  'production.p0.first-customer.acceptance.v1',
  'PC_P0_APPROVAL_WINDOW_NOT_BEFORE_EPOCH',
  "require.resolve('@playwright/test')",
  "typeof chromium.launch !== 'function'",
  'PC_P0_PLAYWRIGHT_MODULE',
  'PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE',
  'PC_PROD_P0_MAILBOX_IMAP_PASSWORD',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'StrictHostKeyChecking=yes',
  'bash scripts/production-p0-all-role-registration.sh',
  'P0_ALL_ROLE_REGISTRATION=PASS',
  'name: Scan bounded redacted 9-role evidence',
  'name: Enforce terminal PASS in bounded 9-role evidence',
  'actions/upload-artifact@v4',
  'production-p0-all-role-${{ steps.target.outputs.sha }}-${{ github.run_id }}-${{ github.run_attempt }}',
  'Remove protected runner credentials',
  'RELEASE_ISSUE_NUMBER: ${{ github.event.issue.number }}',
]);
const lifecycleGroup = workflow.match(/^concurrency:\n\s+group: ([^\n]+)$/mu)?.[1] || '';
if (!lifecycleGroup.includes('pc-crop-registration-lifecycle')
  || lifecycleGroup.includes('github.triggering_actor')) {
  failures.push(`${paths.workflow}: reruns of the original owner command must remain in the serialized lifecycle group`);
}
for (const forbidden of [
  '[[ "$candidate_status" == completed ]] && continue',
  'if [[ "$count" == 0 && "$run_status" == completed ]]; then continue; fi',
  '(contract.length === 0 || contractSkipped)',
  '("$materialized" == 1 || "$run_status" == completed)',
]) {
  if (workflow.includes(forbidden)) failures.push(`${paths.workflow}: zero-job latest-intent bypass remains: ${forbidden}`);
}
if (!workflow.includes('for _ in $(seq 1 15); do')) {
  failures.push(`${paths.workflow}: source-attempt monitor must use the bounded 15-second polling interval`);
}
const sshPreparation = workflow.indexOf('- name: Resolve protected key and pinned REG.RU identity');
const firstCustomerLineage = workflow.indexOf('- name: Require selected First Customer attempt remains current');
const releaseLineage = workflow.indexOf('- name: Require First Customer release remains latest intent');
const matrixExecution = workflow.indexOf('- name: Execute immutable-candidate production 9-role matrix');
const firstCustomerAttemptRecheck = workflow.indexOf('P0_FIRST_CUSTOMER_ATTEMPT_CHANGED_BEFORE_ALL_ROLE', matrixExecution);
const releaseAttemptRecheck = workflow.indexOf('P0_RELEASE_ATTEMPT_CHANGED_BEFORE_ALL_ROLE', matrixExecution);
const attemptMonitor = workflow.indexOf('monitor_source_attempts()', matrixExecution);
const matrixRunnerLaunch = workflow.indexOf('setsid --wait bash -c', matrixExecution);
const matrixMonitorLaunch = workflow.indexOf('monitor_source_attempts &', matrixExecution);
const matrixRunnerWait = workflow.indexOf('wait "$runner_pid"', matrixExecution);
const matrixMutation = workflow.indexOf('bash scripts/production-p0-all-role-registration.sh', matrixExecution);
if (!(sshPreparation >= 0 && firstCustomerLineage > sshPreparation
  && releaseLineage > firstCustomerLineage && matrixExecution > releaseLineage)) {
  failures.push(`${paths.workflow}: both exact acceptance lineage guards must run after SSH preparation and immediately before 9-role execution`);
}
if (!(firstCustomerAttemptRecheck > matrixExecution
  && releaseAttemptRecheck > firstCustomerAttemptRecheck
  && attemptMonitor > releaseAttemptRecheck && matrixMutation > attemptMonitor)) {
  failures.push(`${paths.workflow}: selected First Customer and release attempts must be rechecked and continuously supervised inside the matrix step`);
}
if (!(matrixRunnerLaunch > attemptMonitor && matrixMonitorLaunch > matrixRunnerLaunch
  && matrixRunnerWait > matrixMonitorLaunch)) {
  failures.push(`${paths.workflow}: source-attempt monitor must actually launch and supervise the 9-role process group`);
}
const artifactGuard = workflow.indexOf('- name: Guard immutable candidate before artifact publication');
const artifactReleaseScan = workflow.indexOf('assert_no_newer_release_intent\n', artifactGuard);
const artifactFinalFetch = workflow.indexOf('git fetch --no-tags origin main >/dev/null', artifactReleaseScan);
const artifactFinalAncestry = workflow.indexOf('git merge-base --is-ancestor "$TARGET_SHA" "$current"', artifactFinalFetch);
const artifactFinalDeepEndpoint = workflow.indexOf('actions/runs/$DEEP_RUN_ID', artifactFinalAncestry);
const artifactDeepFinal = workflow.indexOf('P0_FIRST_CUSTOMER_ATTEMPT_CHANGED_BEFORE_ALL_ROLE_ARTIFACT', artifactGuard);
const artifactFinalReleaseEndpoint = workflow.indexOf('actions/runs/$RELEASE_RUN_ID', artifactDeepFinal);
const artifactReleaseFinal = workflow.indexOf('P0_RELEASE_ATTEMPT_CHANGED_BEFORE_ALL_ROLE_ARTIFACT', artifactGuard);
const artifactUpload = workflow.indexOf('- name: Upload bounded production 9-role evidence', artifactGuard);
if (!(artifactGuard >= 0 && artifactReleaseScan > artifactGuard
  && artifactFinalFetch > artifactReleaseScan && artifactFinalAncestry > artifactFinalFetch
  && artifactFinalDeepEndpoint > artifactFinalAncestry && artifactDeepFinal > artifactFinalDeepEndpoint
  && artifactFinalReleaseEndpoint > artifactDeepFinal && artifactReleaseFinal > artifactFinalReleaseEndpoint
  && artifactUpload > artifactReleaseFinal)) {
  failures.push(`${paths.workflow}: artifact publication must follow the final combined source-attempt and candidate-ancestry recheck`);
}
if (/mapfile -t \w+ < <\(node/u.test(workflow)) {
  failures.push(`${paths.workflow}: latest-intent parser exit status must not be hidden by process substitution`);
}
if (workflow.includes('jobs?filter=latest')) {
  failures.push(`${paths.workflow}: latest jobs endpoint is forbidden; every provenance read must name an exact run attempt`);
}
if (/assert_(?:first_customer_intent_current|no_newer_release_intent)\s*(?:\\\n\s*)?\|\|/u.test(workflow)) {
  failures.push(`${paths.workflow}: latest-intent guards must be called directly so Bash errexit remains active inside the functions`);
}
const parserFailureProbe = spawnSync('bash', ['-c',
  'set -euo pipefail; out="$(mktemp)"; trap \'rm -f "$out"\' EXIT; node -e \'process.stdout.write("partial\\n");process.exit(7)\' > "$out"; mapfile -t rows < "$out"; echo FAIL_OPEN',
], { encoding: 'utf8' });
if (parserFailureProbe.status === 0 || parserFailureProbe.stdout.includes('FAIL_OPEN')) {
  failures.push(`${paths.checker}: status-checked latest-intent parser failure probe did not fail closed`);
}
if ((workflow.match(/^\s+queue: max$/gmu) || []).length !== 2) {
  failures.push(`${paths.workflow}: workflow and 9-role acceptance must both retain every serialized pending invocation`);
}

requireAll(paths.runner, runner, [
  `BASE_WRAPPER_BLOB='${EXPECTED_BASE_WRAPPER_BLOB}'`,
  'CHROMIUM_NONROOT_PATH_FILTER_REMOVAL',
  'CHROMIUM_EXACT_PATH_PRESERVATION',
  'CHROMIUM_SERVER_PATH_AUTHORITY',
  'CHROMIUM_NONROOT_PATH_FILTER_REMAINS',
  'CHROMIUM_EXACT_PATH_NOT_PRESERVED',
  'CHROMIUM_ROOT_PATH_ASSERTION_REMAINS',
  'CHROMIUM_ACCESS_SERVER_AUTHORITY_MISSING',
  'CHROMIUM_CABINET_SERVER_AUTHORITY_MISSING',
  'CHROMIUM_HOST_ONLY_SCOPE_GUARD_MISSING',
  'CHROMIUM_REQUIRED_JAR_COOKIE_GUARD_MISSING',
  'LABEL_BOUND_COOKIE_JAR_PATCH_INJECTION',
  'PRIME_CSRF_LABEL_BOUND_BEFORE_JAR',
  'REGISTER_LABEL_BOUND_BEFORE_JAR',
  'LOGIN_LABEL_BOUND_BEFORE_JAR',
  'LOGOUT_LABEL_BOUND_BEFORE_JAR',
  'BASH_DYNAMIC_SCOPE_COOKIE_JAR_BINDING_REMAINS',
  'LABEL_BOUND_COOKIE_JAR_INVARIANT_MISSING',
  'HTTP_REQUEST_TIMEOUT_ENVELOPE',
  'HTTP_REQUEST_TIMEOUT_ENVELOPE_INVALID',
  'HTTP_REQUEST_TIMEOUT_PATCH_MISSING',
  "'--max-time 110'",
  'P0_ALL_ROLE_CHROMIUM_EXACT_PATH_PRESERVATION=PASS',
  'P0_ALL_ROLE_CHROMIUM_SERVER_PATH_AUTHORITY=PASS',
  'P0_ALL_ROLE_LABEL_BOUND_COOKIE_JARS=PASS',
  'P0_ALL_ROLE_HTTP_TIMEOUT_ENVELOPE=PASS',
  'RELEASE_CANDIDATE_ANCESTRY_GUARD',
  'P0_ALL_ROLE_RELEASE_CANDIDATE_GUARD=PASS',
  'AUTH_MAIL_WORKER_EXACT_READY',
  'P0_AUTH_MAIL_WORKER_RUNTIME_AUTHORITY_AMBIGUOUS',
  'P0_AUTH_MAIL_WORKER_REVISION_MISMATCH',
  'P0_AUTH_MAIL_WORKER_NOT_HEALTHY',
  'P0_AUTH_MAIL_WORKER_NOT_READY',
  'authMailWorkerRevisionExact',
  'authMailWorkerReady',
  'TERMINAL_PRODUCTION_PREFLIGHT',
  'P0_ALL_ROLE_AUTH_MAIL_WORKER_GUARD=PASS',
]);

requireAll(paths.runbook, runbook, [
  '/production p0-all-role-registration current-main',
  'Production P0 First-Customer Acceptance',
  'ORGANIZATION_ADMIN_DECISION_REQUIRED',
  'eight distinct organizations and tenants',
  'live desktop Chromium',
  'live mobile Chromium',
  'P0_ALL_ROLE_REGISTRATION_COUNT=9/9',
]);

forbid(paths.workflow, workflow, /PC_(?:P0|PROD_P0)_REVIEWER_(?:EMAIL|PASSWORD|TOTP_SECRET)/u,
  'reviewer credential input is forbidden');
forbid(paths.workflow, workflow, /pull_request_target:/u, 'pull_request_target is forbidden');
forbid(paths.workflow, workflow, /continue-on-error:\s*true/u, 'continue-on-error is forbidden');
if (workflow.includes('production-p0-first-customer-acceptance.yml/runs?event=issue_comment&status=success')) {
  failures.push(`${paths.workflow}: First Customer selector must inspect the latest qualifying intent, including failures and in-progress runs`);
}
const acceptanceJobName = 'Two public customers · staff MFA · RLS · causal receipt';
const contractJobName = 'Validate production P0 acceptance contract';
const firstCustomerVerdict = (runs) => {
  for (const run of runs) {
    const contract = run.jobs.filter((job) => job.name === contractJobName);
    const acceptance = run.jobs.filter((job) => job.name === acceptanceJobName);
    const contractSkipped = contract.length === 1 && contract[0].conclusion === 'skipped';
    const acceptanceSkipped = acceptance.length === 1 && acceptance[0].conclusion === 'skipped';
    if (contractSkipped && acceptanceSkipped) {
      if (Number(run.runAttempt || 1) > 1) return 'BLOCK';
      continue;
    }
    if (contract.length !== 1 || acceptance.length !== 1
      || run.status !== 'completed' || run.conclusion !== 'success'
      || contract[0].conclusion !== 'success' || acceptance[0].conclusion !== 'success') return 'BLOCK';
    return 'PASS';
  }
  return 'BLOCK';
};
const oldFirstCustomerPass = {
  runAttempt: 1, status: 'completed', conclusion: 'success', jobs: [
    { name: contractJobName, conclusion: 'success' },
    { name: acceptanceJobName, conclusion: 'success' },
  ],
};
if (firstCustomerVerdict([
  { runAttempt: 2, status: 'completed', conclusion: 'failure', jobs: [
    { name: contractJobName, conclusion: 'skipped' },
    { name: acceptanceJobName, conclusion: 'skipped' },
  ] },
  oldFirstCustomerPass,
]) !== 'BLOCK') failures.push(`${paths.checker}: newer skipped First Customer rerun must block fallback`);
if (firstCustomerVerdict([
  { runAttempt: 1, status: 'completed', conclusion: 'cancelled', jobs: [] },
  oldFirstCustomerPass,
]) !== 'BLOCK') failures.push(`${paths.checker}: newer completed First Customer intent without materialized jobs must block fallback`);
if (firstCustomerVerdict([
  { status: 'in_progress', conclusion: null, jobs: [
    { name: contractJobName, conclusion: 'success' },
    { name: acceptanceJobName, conclusion: null },
  ] },
  oldFirstCustomerPass,
]) !== 'BLOCK') failures.push(`${paths.checker}: newer in-progress First Customer intent must block fallback`);
if (firstCustomerVerdict([
  { status: 'completed', conclusion: 'failure', jobs: [
    { name: contractJobName, conclusion: 'success' },
    { name: acceptanceJobName, conclusion: 'failure' },
  ] },
  oldFirstCustomerPass,
]) !== 'BLOCK') failures.push(`${paths.checker}: newer failed First Customer intent must block fallback`);
if (firstCustomerVerdict([
  { status: 'completed', conclusion: 'failure', jobs: [
    { name: contractJobName, conclusion: 'failure' },
    { name: acceptanceJobName, conclusion: 'skipped' },
  ] },
  oldFirstCustomerPass,
]) !== 'BLOCK') failures.push(`${paths.checker}: newer contract-failed First Customer intent must block fallback`);
if (firstCustomerVerdict([{ ...oldFirstCustomerPass, jobs: [
  { name: contractJobName, conclusion: 'success' },
  { name: acceptanceJobName, conclusion: 'success' },
  { name: acceptanceJobName, conclusion: 'success' },
] }]) !== 'BLOCK') failures.push(`${paths.checker}: duplicate First Customer job evidence must fail closed`);
if (firstCustomerVerdict([oldFirstCustomerPass]) !== 'PASS') {
  failures.push(`${paths.checker}: exact successful First Customer intent must pass the selector model`);
}
forbid(paths.workflow, workflow, /StrictHostKeyChecking=(?:no|accept-new)/u, 'unpinned SSH host acceptance is forbidden');
forbid(paths.workflow, workflow, /\bDEFAULT_HOST\b/u,
  'historical production host fallback is forbidden');
forbid(paths.workflow, workflow, /\b195[.]19[.]12[.]120\b/u,
  'hard-coded production IPv4 is forbidden; protected host must match current DNS');
forbid(paths.workflow, workflow, /(?:netlify|vercel|railway)/iu,
  'non-canonical production hosting is forbidden');
forbid(paths.runner, runner, /set\s+-[^\n]*x/u, 'shell tracing is forbidden');
forbid(paths.runner, runner, /normalizedDomain/u,
  'broad Domain normalization is forbidden');

let effective;
try {
  effective = gitBlob(EXPECTED_BASE_WRAPPER_BLOB);
  effective = replaceOne(
    effective,
    "    if ((pathValue || '/') !== '/') continue;\n",
    '',
    'nonroot-path-filter-removal',
  );
  effective = replaceOne(
    effective,
    "      path: '/',\n      secure,\n      httpOnly,\n      sameSite: 'Lax',\n",
    "      path: pathValue || '/',\n      secure,\n      httpOnly,\n      sameSite: 'Lax',\n",
    'exact-path-preservation',
  );
  effective = replaceOne(
    effective,
    "      if (cookie.domain !== browserHost\n        || cookie.path !== '/'\n        || cookie.secure !== true\n        || cookie.httpOnly !== true) {\n",
    "      if (cookie.domain !== browserHost\n        || cookie.secure !== true\n        || cookie.httpOnly !== true) {\n",
    'server-path-authority',
  );
} catch (error) {
  failures.push(`${paths.runner}: ${error instanceof Error ? error.message : String(error)}`);
  effective = '';
}

requireAll('effective Chromium wrapper', effective, [
  "path: pathValue || '/'",
  'domain: target.hostname',
  "includeSubdomainsValue.toUpperCase() !== 'FALSE'",
  'P0_CHROMIUM_COOKIE_SCOPE_INVALID',
  'P0_CHROMIUM_JAR_ACCESS_COOKIE_MISSING',
  'P0_CHROMIUM_JAR_CABINET_COOKIE_MISSING',
  'P0_CHROMIUM_ACCESS_COOKIE_IMPORT_MISSING',
  'P0_CHROMIUM_CABINET_COOKIE_IMPORT_MISSING',
  'P0_CHROMIUM_IMPORTED_COOKIE_SCOPE_INVALID',
  "context.request.get(origin + '/api/auth/me'",
  'const cabinetResponse = await context.request.get(origin + route',
  'maxRedirects: 0',
  'P0_CHROMIUM_IMPORTED_SESSION_CONTEXT_INVALID',
  'P0_CHROMIUM_SERVER_SESSION_REJECTED',
  'P0_CHROMIUM_SERVER_ROLE_REDIRECT',
  'P0_CHROMIUM_CLIENT_REDIRECTED',
  'PC_P0_BROWSER_BLOCKER_FILE',
  'fail "$browser_blocker" 69',
]);
if (effective.includes("if ((pathValue || '/') !== '/') continue;")) {
  failures.push('effective Chromium wrapper: non-root cookie filter remains');
}
if (effective.includes("cookie.path !== '/'")) {
  failures.push('effective Chromium wrapper: root-only imported-cookie assertion remains');
}
forbid('effective Chromium wrapper', effective, /\burl:\s*target[.]origin\s*,/u,
  'URL-based cookie import must remain absent');
forbid('effective Chromium wrapper', effective, /P0_CHROMIUM_(?:SERVER|CLIENT)_REDIRECT_PATH=/u,
  'raw redirect paths are forbidden in production evidence');
forbid('effective Chromium wrapper', effective, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE)\s+(?:INTO\s+)?auth\./iu,
  'direct production auth SQL mutation is forbidden');
forbid('effective Chromium wrapper', effective, /\/api\/staff\/registration\/applications\//u,
  'CI must not call the staff decision endpoint');

const expectedPaths = [paths.workflow, paths.runner, paths.checker, paths.runbook, paths.scope];
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push(`${paths.scope}: schema mismatch`);
if (scope.branch !== 'p0/production-all-role-registration-3785') failures.push(`${paths.scope}: branch mismatch`);
if (scope.status !== 'active') failures.push(`${paths.scope}: scope is not active`);
if (!/^[0-9a-f]{40}$/.test(scope.authorityBaseExactMain || '')) failures.push(`${paths.scope}: exact authority base missing`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY') failures.push(`${paths.scope}: hosting mismatch`);
if (scope.newRecurringCostRub !== 0) failures.push(`${paths.scope}: recurring cost must remain zero`);
if (JSON.stringify(scope.allowedPaths) !== JSON.stringify(expectedPaths)) failures.push(`${paths.scope}: exact path allowlist mismatch`);

const syntax = spawnSync('bash', ['-n', paths.runner], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`${paths.runner}: bash syntax failed: ${syntax.stderr.trim()}`);

const labelBindingRegression = spawnSync('bash', ['--noprofile', '--norc', '-c', String.raw`
set -euo pipefail
TMP_ROOT=/tmp/p0-label-binding
label=bank
bind_jar() {
  local label="$1"
  local jar="$TMP_ROOT/$label.cookies"
  printf '%s' "$jar"
}
[[ "$(bind_jar seller)" == "$TMP_ROOT/seller.cookies" ]]
[[ "$(bind_jar employee)" == "$TMP_ROOT/employee.cookies" ]]
`], { encoding: 'utf8' });
if (labelBindingRegression.status !== 0) {
  failures.push(`${paths.runner}: label-first Bash cookie-jar binding regression failed`);
}

const wrapperValidation = spawnSync('bash', [paths.runner], {
  encoding: 'utf8',
  env: { ...process.env, PC_P0_ALL_ROLE_IDNA_VALIDATE_ONLY: '1' },
});
const wrapperMarkers = [
  'P0_ALL_ROLE_CORE_BLOB=PASS',
  'P0_ALL_ROLE_IMAP_LOGIN_IDNA_PATCH=PASS',
  'P0_ALL_ROLE_IMAP_RECIPIENT_IDNA_PATCH=PASS',
  'P0_ALL_ROLE_APPROVAL_WINDOW_NAMESPACE=PASS',
  'P0_ALL_ROLE_HUMAN_REVIEW_ISSUE_ROUTING=PASS',
  'P0_ALL_ROLE_REGISTRATION_RATE_LIMIT_RETRY=PASS',
  'P0_ALL_ROLE_CHROMIUM_COOKIE_HANDOFF=PASS',
  'P0_ALL_ROLE_REVIEWER_CREDENTIAL_BAN=PASS',
  'P0_ALL_ROLE_CHROMIUM_EXACT_PATH_PRESERVATION=PASS',
  'P0_ALL_ROLE_CHROMIUM_SERVER_PATH_AUTHORITY=PASS',
  'P0_ALL_ROLE_LABEL_BOUND_COOKIE_JARS=PASS',
  'P0_ALL_ROLE_HTTP_TIMEOUT_ENVELOPE=PASS',
  'P0_ALL_ROLE_RELEASE_CANDIDATE_GUARD=PASS',
  'P0_ALL_ROLE_AUTH_MAIL_WORKER_GUARD=PASS',
];
if (wrapperValidation.status !== 0) {
  failures.push(`${paths.runner}: immutable wrapper validation failed: ${wrapperValidation.stderr.trim()}`);
} else {
  for (const marker of wrapperMarkers) {
    if (!wrapperValidation.stdout.includes(marker)) failures.push(`${paths.runner}: validation missing ${marker}`);
  }
}

if (!/name: Upload bounded production 9-role evidence[\s\S]*?steps[.]redaction[.]outcome == 'success'[\s\S]*?uses: actions\/upload-artifact@v4/u.test(workflow)) {
  failures.push(`${paths.workflow}: redacted failure evidence must remain uploadable`);
}

if (failures.length) {
  console.error('Production P0 all-role registration contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Production P0 all-role registration contract PASS: latest-intent immutable-candidate prerequisite, exact auth-mail worker, eight visible reviewer decisions, label-bound cookie jars, exact host-only cookie domain with source-preserved cookie paths, server-authoritative access/cabinet proof, nine roles, protected read and logout/relogin.');
