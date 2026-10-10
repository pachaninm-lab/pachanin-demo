#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const files = {
  workflow: '.github/workflows/production-gekta-first-user-acceptance.yml',
  executor: 'scripts/production-gekta-first-user-acceptance.mjs',
  checker: 'scripts/check-production-gekta-first-user-acceptance.mjs',
  live: 'scripts/production-web-live-acceptance.sh',
  runbook: 'docs/ops/production-gekta-first-user-acceptance.md',
  scope: 'docs/platform-v7/autopilot/scopes/production-gekta-runtime-20260813.json',
};
const mailIdnaScopePath = 'docs/platform-v7/autopilot/scopes/gekta-first-user-mail-idna-3072.json';

const source = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, readFileSync(file, 'utf8')]));

function requireAll(name, values) {
  for (const value of values) {
    if (!source[name].includes(value)) throw new Error(`${name}: missing ${JSON.stringify(value)}`);
  }
}

function forbid(name, patterns) {
  for (const pattern of patterns) {
    if (pattern.test(source[name])) throw new Error(`${name}: forbidden ${pattern}`);
  }
}

requireAll('workflow', [
  'name: Production Gekta First-User Acceptance',
  'issue_comment:',
  'RELEASE_ISSUE_NUMBER: 4637',
  "github.event.issue.number == 4637",
  "github.event.comment.author_association == 'OWNER'",
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  "github.event.comment.user.login == github.repository_owner",
  "github.event.comment.body == '/production gekta-first-user current-main'",
  'github.event.pull_request.head.sha || github.sha',
  'Resolve exact current main',
  'Verify exact deployed revision before journey',
  'PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE',
  'PC_PROD_P0_MAILBOX_IMAP_HOST',
  'PC_PROD_P0_MAILBOX_IMAP_USER',
  'PC_PROD_P0_MAILBOX_IMAP_PASSWORD',
  'Install Chromium runtime',
  'Execute first-user journey and wait for owner ceremony',
  'timeout-minutes: 90',
  'GEKTA_OWNER_CEREMONY=WAITING',
  'synthetic test phone',
  'https://процент-агро.рф/gekta/console',
  'existing PLATFORM_OWNER session with fresh MFA',
  'Enforce bounded evidence',
  'grep -PRiq',
  'Guard exact main before artifact publication',
  'Remove protected acceptance material',
  'GEKTA_FIRST_USER_ACCEPTANCE=PASS',
]);

forbid('workflow', [
  /workflow_dispatch:/u,
  /grep -PERiq/u,
  /PC_PROD_GE?KTA_(?:OWNER|REVIEWER)_(?:EMAIL|PASSWORD|TOTP|SECRET)/iu,
  /(?:echo|printf)[^\n]*(?:IMAP_PASSWORD|MFA_SECRET|VERIFY_TOKEN|BACKUP_CODES)/iu,
  /continue-on-error:\s*true[\s\S]{0,180}Execute first-user journey/iu,
]);

requireAll('executor', [
  "LIVE_BASE === 'https://xn----8sbjf4befbjgs9b.xn--p1ai'",
  "REPOSITORY === 'pachaninm-lab/pachanin-demo'",
  "RELEASE_ISSUE_NUMBER === '4637'",
  "'GEKTA_RELEASE_ISSUE_AUTHORITY_INVALID'",
  "'issue', 'comment', RELEASE_ISSUE_NUMBER",
  'assertExactMain();',
  '/manifest-pc-deploy.json?gekta-acceptance=',
  "requireFromWeb('@playwright/test')",
  "page.waitForResponse(\n    (response) => isEntitlementResponse(response, 'GET')",
  "page.locator('[data-gekta-consent-accept=\"true\"]')",
  "consentPayload?.consent?.version !== consentPayload.legalVersion",
  "(response) => isEntitlementResponse(response, 'POST')",
  "GEKTA_ANONYMOUS_ENTITLEMENT_BOOTSTRAP_FAILED",
  "GEKTA_ANONYMOUS_CONSENT_FAILED",
  "const persistedConsent = await pageJson(page, '/api/gekta/entitlement');",
  "persistedConsent.data?.consent?.version === consentPayload.legalVersion",
  "GEKTA_ANONYMOUS_CONSENT_PERSISTENCE_FAILED",
  "page.getByRole('button', { name: 'Отправить', exact: true })",
  "GEKTA_LIVE_ANONYMOUS_ANSWER=PASS",
  "fetch('/api/agro-chat?stream=1'",
  "'x-gekta-answer-ticket': ticket",
  "body.includes('\"event\":\"done\"') && body.includes('\"complete\":true')",
  'usage.data?.entitlement?.remaining === 8 - index',
  'GEKTA_DURABLE_ANONYMOUS_ANSWER_FAILED',
  "GEKTA_ANONYMOUS_TEN_ANSWER_GATE=PASS",
  "page.locator('[data-gekta-registration-cta=\"true\"]')",
  "GEKTA_SEPARATE_CONSENTS_MISSING",
  "PC_P0_IMAP_PASSWORD",
  "imaplib.IMAP4_SSL",
  "def canonical_address(value):",
  "domain = domain.encode('idna').decode('ascii').lower()",
  "target = canonical_address(os.environ['GEKTA_TARGET_EMAIL'])",
  "canonical = canonical_address(address)",
  "recipients.append(canonical)",
  "/api/gekta/auth/email/verify",
  "page.getByRole('button', { name: 'Подтвердить email', exact: true })",
  "page.getByRole('heading', { name: 'Защитите аккаунт', exact: true })",
  "GEKTA_MANDATORY_MFA=PASS",
  "trial.days > 29 && trial.days <= 30.1",
  "phone.data?.state === 'DECLARED'",
  "/api/gekta/account/conversations?search=",
  "/api/gekta/account/projects",
  "GEKTA_OWNER_CEREMONY=WAITING",
  "GEKTA_OWNER_GRANT_7_DAYS=PASS",
  "GEKTA_OWNER_GRANT_30_DAYS=PASS",
  "GEKTA_OWNER_GRANT_LIFETIME=PASS",
  "publishOwnerProgress('7_DAYS')",
  "publishOwnerProgress('30_DAYS')",
  "publishOwnerProgress('LIFETIME')",
  "page.getByRole('button', { name: 'Выйти', exact: true })",
  "page.getByRole('tab', { name: 'Вход', exact: true })",
  "GEKTA_FRESH_LOGIN_MFA=PASS",
  "production.gekta.first-user.acceptance.v1",
]);

forbid('executor', [
  /target\s*=\s*os\.environ\['GEKTA_TARGET_EMAIL'\]\.strip\(\)\.lower\(\)/u,
  /recipients\.extend\(address\.lower\(\) for _, address in getaddresses/u,
  /x-registration-delivery-key/iu,
  /registrationDeliveryKey/iu,
  /DATABASE_URL/iu,
  /\b(?:psql|ssh)\b/iu,
  /(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?(?:auth\.|public\.|gekta_)/iu,
  /body:\s*\{\s*action:\s*'complete'/iu,
  /SMS|payment|billing|acquir|NPD|НПД/iu,
  /console\.(?:log|error)\(\s*(?:email|password|secret|token|backup|cookie)\b/iu,
]);

requireAll('live', [
  '/api/gekta/entitlement',
  '--data \'{"action":"reserve"}\'',
  '--data \'{"action":"consent"}\'',
  'verify_current_consent "$consent_body"',
  'if (( consent_ok == 1 )); then',
  'if (( consent_ok == 1 && reserve_ok == 1 )); then',
  'GEKTA_CONSENT=PASS',
  'x-gekta-answer-ticket: $answer_ticket',
  '-c "$cookie_jar" -b "$cookie_jar"',
  '"complete":true',
]);

forbid('live', [
  /(?:echo|printf)[^\n]*(?:answer_ticket|cookie_jar|reserve_body|consent_body)/iu,
]);

if (source.live.indexOf('--data \'{"action":"consent"}\'') >= source.live.indexOf('--data \'{"action":"reserve"}\'')) {
  throw new Error('live: consent must precede reservation');
}
for (const fragment of ["github.event.issue.number == 4637", "github.event.comment.author_association == 'OWNER'", 'github.actor == github.repository_owner', 'github.triggering_actor == github.repository_owner']) {
  if (source.workflow.split(fragment).length !== 3) throw new Error('workflow: both owner-only gates must use the canonical journal');
}
forbid('workflow', [/github\.event\.issue\.number == 3072/u]);
forbid('executor', [/'issue', 'comment', '3072'/u]);

requireAll('runbook', [
  '/production gekta-first-user current-main',
  '10 бесплатных ответов',
  'реальное verification-письмо',
  '30-дневный trial',
  'https://процент-агро.рф/gekta/console',
  'поиск по телефону',
  '7 дней',
  '30 дней',
  'бессрочный доступ',
  'logout/login',
  'SMS',
  'billing',
  'DECLARED',
  '#4637',
]);

const scope = JSON.parse(source.scope);
if (scope.firstUserReleaseIssue !== 4637) throw new Error('scope: first-user journal');
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') throw new Error('scope: schemaVersion');
if (scope.branch !== 'ops/production-gekta-runtime-20260813') throw new Error('scope: branch');
if (scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') throw new Error('scope: hosting');
if (scope.boundaries?.newRecurringCostRub !== 0) throw new Error('scope: recurring cost');
if (
  scope.boundaries?.databaseMutation !== 'EXACT_RELEASE_MIGRATIONS_AND_SYNTHETIC_GEKTA_ACCEPTANCE_ONLY'
  || scope.boundaries?.sessionMutation !== true
  || scope.boundaries?.mfaMutation !== true
  || scope.boundaries?.syntheticAccountMutation !== true
  || scope.boundaries?.ownerEntitlementMutation !== true
) throw new Error('scope: production acceptance mutation boundary');
for (const file of Object.values(files)) {
  if (!scope.allowedPaths.includes(file)) throw new Error(`scope: missing allowed path ${file}`);
}

requireAll('scope', [
  'OWNER_ONLY_EXACT_MAIN_REAL_MAIL_BROWSER_ACCEPTANCE',
  'no reviewer password, owner password or TOTP secret enters GitHub Actions',
  'only a synthetic run-scoped phone locator may be published for the visible owner ceremony',
  'billing remains disabled',
]);

const mailIdnaScope = JSON.parse(readFileSync(mailIdnaScopePath, 'utf8'));
const expectedMailIdnaPaths = [files.executor, files.checker, mailIdnaScopePath].sort();
if (mailIdnaScope.schemaVersion !== 'platform-v7.concurrent-scope.v1') throw new Error('mail-idna scope: schemaVersion');
if (mailIdnaScope.branch !== 'fix/gekta-first-user-mail-idna-3072') throw new Error('mail-idna scope: branch');
if (mailIdnaScope.issue !== 3072) throw new Error('mail-idna scope: issue');
if (mailIdnaScope.baseline?.commit !== '5045702e6d7baeff2f49a50451c3e8a268a8a59d') throw new Error('mail-idna scope: baseline');
if (mailIdnaScope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') throw new Error('mail-idna scope: hosting');
if (JSON.stringify([...mailIdnaScope.allowedPaths].sort()) !== JSON.stringify(expectedMailIdnaPaths)) throw new Error('mail-idna scope: allowedPaths');
for (const [key, expected] of Object.entries({
  productionMutation: false,
  databaseMutation: false,
  identityMutation: false,
  mailSend: false,
  mailRuntimeMutation: false,
  deploymentMutation: false,
  productCodeMutation: false,
  credentialOutput: false,
  piiOutput: false,
  ownerOnlyAcceptancePreserved: true,
  exactMainGuardPreserved: true,
  newRecurringCostRub: 0,
})) {
  if (mailIdnaScope.boundaries?.[key] !== expected) throw new Error(`mail-idna scope: boundary ${key}`);
}

requireAll('executor', [
  'await proveOwnedHistoryRemoval(page);',
  'GEKTA_OWNED_HISTORY_DUPLICATE_IMPORT=PASS',
  'GEKTA_OWNED_HISTORY_DELETE_IMPORT_RACE=PASS',
  'GEKTA_OWNED_HISTORY_REPLAY_BLOCKED=PASS',
  'GEKTA_OWNED_HISTORY_CHANGED_PAYLOAD_CONFLICT=PASS',
  'GEKTA_OWNED_HISTORY_CLEANUP_FAILED',
  'timeoutMs: 30_000',
  'controller.abort()',
  'clearTimeout(timer)',
]);
if (scope.boundaries?.historyFixtureMutation !== 'NEW_RUN_OWNED_SINGLE_CONVERSATION_ONLY') throw new Error('scope: owned history fixture boundary');

const ownedStart = source.executor.indexOf('async function proveOwnedHistoryRemoval(page) {');
const ownedEnd = source.executor.indexOf('async function proveAccountWorkspace(', ownedStart);
assert(ownedStart >= 0 && ownedEnd > ownedStart);
const ownedFunction = source.executor.slice(ownedStart, ownedEnd);
for (const behavior of ['pass', 'foreign-row', 'duplicate', 'receipt-lost', 'legacy-alias-lost', 'delete-lost', 'conflict-lost', 'transport-failure', 'cleanup-failure']) {
  const rows = new Map();
  const receipts = new Map();
  const logs = [];
  const deletions = [];
  let nextId = 0;
  let changed = false;
  const context = {
    TARGET_SHA: 'a'.repeat(40), RUN_ID: '42', stage: '',
    randomBytes: () => ({ toString: () => 'b'.repeat(16) }),
    console: { log: (line) => logs.push(line) },
    assert: (condition, code) => { if (!condition) throw new Error(code); },
    pageJson: async (_page, pathName, init = {}) => {
      assert.equal(init.timeoutMs, 30_000);
      const url = new URL(pathName, 'https://fixture.invalid');
      const method = init.method || 'GET';
      if (url.pathname === '/api/gekta/account/history/import' && method === 'POST') {
        assert.equal(init.body.conversations.length, 1);
        const item = init.body.conversations[0];
        if (item.sourceId !== undefined) assert.match(item.sourceId, /^gekta_fixture_a{12}_42_b{16}$/u);
        else assert.equal(behavior === 'legacy-alias-lost' || receipts.has('legacy'), true);
        const fingerprint = JSON.stringify(item);
        const previous = receipts.get(item.sourceId ?? 'legacy');
        if (previous !== undefined && previous !== fingerprint) {
          changed = true;
          return { status: behavior === 'conflict-lost' ? 201 : 409, data: { importedCount: 0 } };
        }
        if (previous !== undefined && behavior !== 'duplicate') return { status: 201, data: { importedCount: 0 } };
        receipts.set(item.sourceId ?? 'legacy', fingerprint);
        if (item.sourceId !== undefined && behavior !== 'legacy-alias-lost') {
          const { sourceId: _sourceId, ...legacy } = item;
          receipts.set('legacy', JSON.stringify(legacy));
        }
        rows.set(`owned-${++nextId}`, { id: `owned-${nextId}`, title: item.title, sourceId: item.sourceId });
        return { status: behavior === 'transport-failure' ? 500 : 201, data: { importedCount: 1 } };
      }
      if (url.pathname === '/api/gekta/account/conversations' && method === 'GET') {
        if (behavior === 'cleanup-failure' && changed) return { status: 500, data: null };
        const items = [...rows.values()];
        if (behavior === 'foreign-row') items.push({ id: 'real-existing', title: 'Existing imported answer' });
        return { status: 200, data: { conversations: items } };
      }
      const match = url.pathname.match(/^\/api\/gekta\/account\/conversations\/(owned-\d+)$/u);
      assert(match, 'request must target only a known run-owned fixture id, never collection DELETE');
      if (method === 'GET') return { status: rows.has(match[1]) ? 200 : 404, data: null };
      assert.equal(method, 'DELETE');
      deletions.push(match[1]);
      if (behavior !== 'delete-lost') {
        if (behavior === 'receipt-lost' && rows.has(match[1])) { receipts.delete(rows.get(match[1]).sourceId); receipts.delete('legacy'); }
        rows.delete(match[1]);
      }
      return { status: 200, data: { deleted: true } };
    },
  };
  vm.createContext(context);
  vm.runInContext(ownedFunction, context);
  if (['pass', 'foreign-row'].includes(behavior)) {
    await context.proveOwnedHistoryRemoval({});
    assert.equal(rows.size, 0);
    assert.equal(logs.length, 5);
    assert.equal(receipts.size, 2);
  } else {
    await assert.rejects(context.proveOwnedHistoryRemoval({}), /GEKTA_OWNED_HISTORY_/u);
    assert.equal(logs.length, 0, 'a failed case or cleanup cannot emit PASS');
    if (behavior === 'transport-failure' || behavior === 'duplicate') assert.equal(rows.size, 0, 'cleanup still removes only its own at-most-two fixtures');
  }
  assert(deletions.every((id) => /^owned-\d+$/u.test(id)));
}

const requestStart = source.executor.indexOf('async function pageJson(');
const requestEnd = source.executor.indexOf('function isEntitlementResponse(', requestStart);
const requestFunction = source.executor.slice(requestStart, requestEnd);
for (const behavior of ['normal', 'body-timeout', 'refresh', 'legacy', 0, 30_001, 0.5, NaN]) {
  let callback;
  let cleared = 0;
  const calls = [];
  const context = {
    AbortController,
    document: { cookie: 'pc_csrf_token=synthetic' },
    setTimeout: (fn, delay) => { assert.equal(delay, 30_000); callback = fn; return 7; },
    clearTimeout: (id) => { assert.equal(id, 7); cleared++; },
    fetch: async (pathName, init) => {
      calls.push({ pathName, init });
      const status = behavior === 'refresh' && calls.length === 1 ? 401 : 200;
      return { status, text: async () => {
        if (behavior === 'body-timeout') return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('AbortError')), { once: true });
          callback();
        });
        return '{"fixture":true}';
      } };
    },
  };
  vm.createContext(context);
  vm.runInContext(requestFunction, context);
  const page = { evaluate: (fn, args) => fn(args) };
  const init = behavior === 'legacy' ? {} : { timeoutMs: typeof behavior === 'number' ? behavior : 30_000 };
  if (typeof behavior === 'number') {
    await assert.rejects(context.pageJson(page, '/api/gekta/account/history/import', init), /GEKTA_OWNED_HISTORY_TIMEOUT_INVALID/u);
    assert.equal(calls.length, 0);
  } else if (behavior === 'body-timeout') {
    await assert.rejects(context.pageJson(page, '/api/gekta/account/history/import', init), /AbortError/u);
    assert.equal(cleared, 1);
  } else {
    const result = await context.pageJson(page, '/api/gekta/account/conversations', init);
    assert.equal(result.status, 200);
    assert.equal(result.data.fixture, true);
    assert.equal(calls.length, behavior === 'refresh' ? 3 : 1);
    assert.equal(cleared, behavior === 'legacy' ? 0 : 1);
    assert(calls.every(({ init }) => behavior === 'legacy' ? init.signal === undefined : init.signal === calls[0].init.signal));
  }
}

console.log('PASS: first-user contract and17 owned-fixture/deadline regression cases; actual live mail/MFA/history/owner grants still require the protected exact-main owner run.');
