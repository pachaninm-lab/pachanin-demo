#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const paths = {
  workflow: '.github/workflows/production-p0-all-role-registration.yml',
  runner: 'scripts/production-p0-all-role-registration.sh',
  checker: 'scripts/check-production-p0-all-role-registration.mjs',
  runbook: 'docs/ops/production-p0-all-role-registration.md',
  scope: 'docs/platform-v7/autopilot/scopes/production-p0-all-role-registration-3785.json',
};

const sources = Object.fromEntries(
  Object.entries(paths).map(([name, path]) => [name, readFileSync(path, 'utf8')]),
);
const scope = JSON.parse(sources.scope);
const failures = [];

function requireAll(sourceName, fragments) {
  for (const fragment of fragments) {
    if (!sources[sourceName].includes(fragment)) {
      failures.push(`${paths[sourceName]}: missing ${JSON.stringify(fragment)}`);
    }
  }
}

function forbid(sourceName, pattern, message) {
  if (pattern.test(sources[sourceName])) failures.push(`${paths[sourceName]}: ${message}`);
}

requireAll('workflow', [
  'name: Production P0 All-Role Registration',
  "github.event.issue.number == 3072",
  "github.event.issue.number == 4637",
  "github.event.comment.body == '/production p0-all-role-registration current-main'",
  'actions/workflows/production-p0-first-customer-acceptance.yml/runs',
  'production-p0-first-customer-$TARGET_SHA-$deep_run_id',
  'production.p0.first-customer.acceptance.v1',
  'PC_P0_APPROVAL_WINDOW_NOT_BEFORE_EPOCH',
  "pnpm install --filter @pc/web... --frozen-lockfile --ignore-scripts",
  'playwright install --with-deps chromium',
  "require.resolve('@playwright/test')",
  "typeof chromium.launch !== 'function'",
  "printf -- '- blocker:",
  'PC_P0_PLAYWRIGHT_MODULE',
  'PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE',
  'PC_PROD_P0_MAILBOX_IMAP_PASSWORD',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'host="$(trim "${SSH_HOST_SECRET:-}")"',
  'mapfile -t dns_ipv4 < <(',
  'getent ahostsv4 "$LIVE_DOMAIN"',
  '(( ${#dns_ipv4[@]} >= 1 ))',
  'printf \'%s\\n\' "${dns_ipv4[@]}" | grep -Fxq "$host"',
  'StrictHostKeyChecking=yes',
  "bash scripts/production-p0-all-role-registration.sh",
  'P0_ALL_ROLE_REGISTRATION=PASS',
  'name: Scan bounded redacted 9-role evidence',
  'id: redaction',
  'name: Enforce terminal PASS in bounded 9-role evidence',
  "if: always() && steps.redaction.outcome == 'success'",
  "steps.redaction.outcome == 'success'",
  'actions/upload-artifact@v4',
  'Remove protected runner credentials',
  'RELEASE_ISSUE_NUMBER: ${{ github.event.issue.number }}',
]);

requireAll('runner', [
  'PLATFORM_LABELS=(seller buyer logistics driver elevator lab surveyor bank)',
  'ALL_LABELS=(seller buyer logistics driver elevator lab surveyor bank employee)',
  "EXPECTED_ROLE[seller]='FARMER'",
  "EXPECTED_ROLE[buyer]='BUYER'",
  "EXPECTED_ROLE[logistics]='LOGISTICIAN'",
  "EXPECTED_ROLE[driver]='DRIVER'",
  "EXPECTED_ROLE[elevator]='ELEVATOR'",
  "EXPECTED_ROLE[lab]='LAB'",
  "EXPECTED_ROLE[surveyor]='SURVEYOR'",
  "EXPECTED_ROLE[bank]='ACCOUNTING'",
  "EXPECTED_ROLE[employee]='GUEST'",
  "CABINET_ROUTE[seller]='/platform-v7/seller'",
  "CABINET_ROUTE[buyer]='/platform-v7/buyer'",
  "CABINET_ROUTE[logistics]='/platform-v7/logistics'",
  "CABINET_ROUTE[driver]='/platform-v7/driver/field'",
  "CABINET_ROUTE[elevator]='/platform-v7/elevator'",
  "CABINET_ROUTE[lab]='/platform-v7/lab'",
  "CABINET_ROUTE[surveyor]='/platform-v7/surveyor'",
  "CABINET_ROUTE[bank]='/platform-v7/bank'",
  "CABINET_ROUTE[employee]='/platform-v7/profile'",
  'PC_P0_APPROVAL_WINDOW_NOT_BEFORE_EPOCH',
  'APPROVAL_WINDOW_NAMESPACE',
  'HUMAN_REVIEW_ISSUE_ROUTING',
  'CHROMIUM_CANONICAL_COOKIE_SCOPE',
  'CHROMIUM_COOKIE_HANDOFF_PROOF',
  'CHROMIUM_SAFE_REDIRECT_CLASSIFICATION',
  'CHROMIUM_BLOCKER_CAPTURE_FINISH',
  'gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY"',
  'REGISTRATION_RATE_LIMIT_RETRY',
  'P0_REGISTRATION_RATE_LIMIT_CONTRACT_INVALID',
  'P0_REGISTRATION_RATE_LIMIT_RETRY_EXHAUSTED',
  'payload.get("code") != "RATE_LIMITED"',
  'payload.get("retryAfterSeconds")',
  'guarded_wait_seconds "$retry_after"',
  "if env | grep -Eq '^PC_(P0|PROD_P0)_REVIEWER_'; then",
  'P0_REVIEWER_CREDENTIAL_INPUT_FORBIDDEN',
  'wait_for_reviewer_rate_window',
  'wait_for_platform_approvals',
  'P0_HUMAN_REVIEW_REQUIRED=8',
  'p0_human_reviewer_ceremony',
  'notificationSuppressed',
  'register_and_verify employee',
  'approve_employee_join',
  '$LIVE_BASE/api/auth/organization-join-requests/',
  'ORGANIZATION_ADMIN_DECISION_REQUIRED',
  '$LIVE_BASE/api/auth/login',
  '$LIVE_BASE/api/auth/mfa-login',
  '$LIVE_BASE/api/auth/me',
  "fetch('/api/proxy/auth/organization-team'",
  '$LIVE_BASE/api/auth/logout',
  "require(process.env.PC_P0_PLAYWRIGHT_MODULE)",
  "kind === 'desktop'",
  "kind === 'mobile'",
  'page.goto',
  'context.addCookies',
  'domain: target.hostname',
  "includeSubdomainsValue.toUpperCase() !== 'FALSE'",
  "for (const required of ['pc_access_token', 'pc_v7_cabinet'])",
  'context.cookies()',
  'P0_CHROMIUM_JAR_ACCESS_COOKIE_MISSING',
  'P0_CHROMIUM_JAR_CABINET_COOKIE_MISSING',
  'P0_CHROMIUM_ACCESS_COOKIE_IMPORT_MISSING',
  'P0_CHROMIUM_CABINET_COOKIE_IMPORT_MISSING',
  'P0_CHROMIUM_IMPORTED_COOKIE_SCOPE_INVALID',
  "context.request.get(origin + '/api/auth/me'",
  'maxRedirects: 0',
  'P0_CHROMIUM_IMPORTED_SESSION_CONTEXT_INVALID',
  'P0_CHROMIUM_SERVER_SESSION_REJECTED',
  'P0_CHROMIUM_SERVER_ROLE_REDIRECT',
  'P0_CHROMIUM_SERVER_REDIRECT_CLASS=',
  'P0_CHROMIUM_CLIENT_REDIRECT_CLASS=',
  'P0_CHROMIUM_CLIENT_REDIRECTED',
  'PC_P0_BROWSER_BLOCKER_FILE',
  'fail "$browser_blocker" 69',
  'assert_topology',
  'P0_ALL_ROLE_REGISTRATION_COUNT=9/9',
  'P0_ALL_ROLE_TOPOLOGY=8_ORGS_8_TENANTS_9_MEMBERSHIPS',
  'P0_ALL_ROLE_DESKTOP_CHROMIUM=PASS',
  'P0_ALL_ROLE_MOBILE_CHROMIUM=PASS',
  'P0_ALL_ROLE_LOGOUT_RELOGIN=PASS',
  'P0_ALL_ROLE_REGISTRATION=PASS',
]);

requireAll('runbook', [
  '/production p0-all-role-registration current-main',
  'Production P0 First-Customer Acceptance',
  'ORGANIZATION_ADMIN_DECISION_REQUIRED',
  'eight distinct organizations and tenants',
  'live desktop Chromium',
  'live mobile Chromium',
  'P0_ALL_ROLE_REGISTRATION_COUNT=9/9',
]);

for (const name of ['workflow', 'runner']) {
  forbid(name, /PC_P0_REVIEWER_(?:EMAIL|PASSWORD|TOTP_SECRET)|PC_PROD_P0_REVIEWER_/u,
    'reviewer credential input is forbidden');
  forbid(name, /pull_request_target:/u, 'pull_request_target is forbidden');
  forbid(name, /continue-on-error:\s*true/u, 'continue-on-error is forbidden');
  forbid(name, /StrictHostKeyChecking=(?:no|accept-new)/u, 'unpinned SSH host acceptance is forbidden');
  forbid(name, /set\s+-[^\n]*x/u, 'shell tracing is forbidden');
  forbid(name, /(?:demo\.|@demo\.|localStorage|role-preview)/iu, 'demo or client-selected role authority is forbidden');
  forbid(name, /(?:netlify|vercel|railway)/iu, 'non-canonical production hosting is forbidden');
}

forbid('workflow', /\bDEFAULT_HOST\b/u,
  'a historical production host constant is forbidden; protected host must match current DNS');
forbid('workflow', /\b195[.]19[.]12[.]120\b/u,
  'a historical REG.RU address is forbidden; resolve current DNS at execution time');
forbid('workflow', /require[.]resolve\(['"]playwright['"]\)/u,
  'transitive Playwright module resolution is forbidden; resolve the direct @playwright/test dependency');
forbid('workflow', /echo\s+"[^"\n]*`[^"\n]*"/u,
  'double-quoted Markdown backticks invoke shell command substitution; use printf');
forbid('workflow', /PC_(?:P0|PROD_P0)_REVIEWER_/u,
  'Actions must not inject reviewer-namespaced inputs');
if (!/name: Upload bounded production 9-role evidence[\s\S]*?steps[.]redaction[.]outcome == 'success'[\s\S]*?uses: actions\/upload-artifact@v4/u.test(sources.workflow)) {
  failures.push(`${paths.workflow}: redacted failure evidence must remain uploadable`);
}
if (/name: Upload bounded production 9-role evidence[\s\S]{0,240}steps[.]evidence[.]outcome == 'success'/u.test(sources.workflow)) {
  failures.push(`${paths.workflow}: PASS enforcement must not suppress a redacted failure artifact`);
}

forbid('runner', /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE)\s+(?:INTO\s+)?auth\./iu,
  'direct production auth SQL mutation is forbidden');
forbid('runner', /\/api\/staff\/registration\/applications\//u,
  'CI must not call the staff decision endpoint');
forbid('runner', /curl[^\n]+(?:127[.]0[.]0[.]1:3001|\/auth\/registration\/applications)/u,
  'direct API approval or activation is forbidden');
forbid('runner', /P0_CHROMIUM_(?:SERVER|CLIENT)_REDIRECT_PATH=/u,
  'raw redirect paths are forbidden in production evidence');
forbid('runner', /normalizedDomain/u,
  'broad Domain cookies must not be normalized into host-only scope');
forbid('runner', /url:\s*target[.]origin/u,
  'URL-based cookie import is forbidden; preserve exact host-only domain/path semantics');

const expectedPaths = [
  paths.workflow,
  paths.runner,
  paths.checker,
  paths.runbook,
  paths.scope,
];
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push(`${paths.scope}: schema mismatch`);
if (scope.branch !== 'p0/production-all-role-registration-3785') failures.push(`${paths.scope}: branch mismatch`);
if (scope.status !== 'active') failures.push(`${paths.scope}: scope is not active`);
if (!/^[0-9a-f]{40}$/.test(scope.authorityBaseExactMain || '')) failures.push(`${paths.scope}: exact authority base missing`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY') failures.push(`${paths.scope}: hosting mismatch`);
if (scope.newRecurringCostRub !== 0) failures.push(`${paths.scope}: recurring cost must remain zero`);
if (JSON.stringify(scope.allowedPaths) !== JSON.stringify(expectedPaths)) failures.push(`${paths.scope}: exact path allowlist mismatch`);

const syntax = spawnSync('bash', ['-n', paths.runner], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`${paths.runner}: bash syntax failed: ${syntax.stderr.trim()}`);

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
];
if (wrapperValidation.status !== 0) {
  failures.push(`${paths.runner}: immutable core validation failed: ${wrapperValidation.stderr.trim()}`);
} else {
  for (const marker of wrapperMarkers) {
    if (!wrapperValidation.stdout.includes(marker)) {
      failures.push(`${paths.runner}: immutable core validation missing ${marker}`);
    }
  }
}

const roleAssignments = [...sources.runner.matchAll(/EXPECTED_ROLE\[([a-z]+)\]='([A-Z_]+)'/gu)];
const cabinetAssignments = [...sources.runner.matchAll(/CABINET_ROUTE\[([a-z]+)\]='([^']+)'/gu)];
if (roleAssignments.length !== 9 || new Set(roleAssignments.map((match) => match[1])).size !== 9) {
  failures.push(`${paths.runner}: role matrix must contain exactly nine distinct labels`);
}
if (cabinetAssignments.length !== 9 || new Set(cabinetAssignments.map((match) => match[1])).size !== 9) {
  failures.push(`${paths.runner}: cabinet matrix must contain exactly nine distinct labels`);
}

if (failures.length) {
  console.error('Production P0 all-role registration contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Production P0 all-role registration contract PASS: exact-main deep prerequisite, eight visible reviewer decisions, one tenant-authoritative employee join, nine first-TOTP identities, eight tenants, exact host-only Chromium cookie transfer, protected read and logout/relogin.');
